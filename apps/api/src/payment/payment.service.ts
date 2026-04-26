// TODO: ApiException 패턴으로 점진 마이그레이션 (apps/api/src/common/errors/api-exception.ts 참고)
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';
import { Subscription, BillingCycle } from './entities/subscription.entity';
import { isPremiumUser } from '../common/premium.util';

const PRICING: Record<BillingCycle, { amount: number; days: number }> = {
  monthly: { amount: 9900, days: 30 },
  yearly: { amount: 79900, days: 365 },
};

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    private readonly config: ConfigService,
  ) {}

  /**
   * 결제 준비 — orderId 생성 + Payment 'ready' 레코드 저장.
   * 클라이언트는 이 orderId + amount로 토스 SDK를 띄운다.
   */
  async prepare(
    userId: string,
    body: { billingCycle: BillingCycle; matchId?: string },
  ) {
    const pricing = PRICING[body.billingCycle];
    if (!pricing) throw new BadRequestException('잘못된 billingCycle');

    const orderId = `yeon_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        userId,
        orderId,
        amount: pricing.amount,
        status: 'ready',
        plan: 'premium',
        billingCycle: body.billingCycle,
        matchId: body.matchId ?? null,
      }),
    );

    return {
      orderId: payment.orderId,
      amount: payment.amount,
      plan: payment.plan,
      billingCycle: payment.billingCycle,
    };
  }

  /**
   * 결제 승인 — 토스 API에 paymentKey 검증 후 Payment 'done' 전이.
   * 단건 결제는 이 단계에서 끝; 구독 활성화는 /payment/subscription이 담당.
   */
  async confirm(
    userId: string,
    body: { paymentKey: string; orderId: string; amount: number },
  ): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({ where: { orderId: body.orderId } });
    if (!payment) throw new NotFoundException('주문을 찾을 수 없습니다');
    if (payment.userId !== userId) throw new BadRequestException('다른 유저의 주문입니다');
    if (payment.status === 'done') return payment;
    if (payment.status !== 'ready') {
      throw new BadRequestException(`결제 상태가 ${payment.status}이라 승인할 수 없습니다`);
    }
    if (Number(payment.amount) !== Number(body.amount)) {
      throw new BadRequestException('금액이 일치하지 않습니다');
    }

    const secretKey = this.config.get<string>('TOSS_SECRET_KEY');
    if (!secretKey) throw new BadRequestException('TOSS_SECRET_KEY 미설정');

    const auth = Buffer.from(`${secretKey}:`).toString('base64');
    const res = await fetch(`${TOSS_API_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        amount: body.amount,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      payment.status = 'failed';
      payment.failureReason = data?.message || `HTTP ${res.status}`;
      payment.tossResponse = data;
      await this.paymentRepo.save(payment);
      this.logger.warn(`토스 승인 실패 orderId=${payment.orderId}: ${payment.failureReason}`);
      throw new BadRequestException(`결제 승인 실패: ${payment.failureReason}`);
    }

    payment.status = 'done';
    payment.paymentKey = body.paymentKey;
    payment.paidAt = new Date();
    payment.tossResponse = data;
    return this.paymentRepo.save(payment);
  }

  /**
   * 구독 활성화 — 결제가 완료된 orderId를 받아 Subscription 생성/갱신 +
   * User.isPremium/premiumExpiresAt 업데이트.
   */
  async activateSubscription(userId: string, body: { orderId: string }): Promise<Subscription> {
    const payment = await this.paymentRepo.findOne({ where: { orderId: body.orderId } });
    if (!payment) throw new NotFoundException('주문을 찾을 수 없습니다');
    if (payment.userId !== userId) throw new BadRequestException('다른 유저의 주문입니다');
    if (payment.status !== 'done') {
      throw new BadRequestException('승인되지 않은 주문입니다. 먼저 /payment/confirm을 호출해주세요');
    }
    if (!payment.billingCycle || !(payment.billingCycle in PRICING)) {
      throw new BadRequestException('구독 결제가 아닙니다');
    }

    const cycle = payment.billingCycle as BillingCycle;
    const days = PRICING[cycle].days;
    const now = new Date();

    // 기존 활성 구독이 있으면 연장, 없으면 생성
    let sub = await this.subRepo.findOne({ where: { userId, isActive: true } });
    const baseDate =
      sub?.expiresAt && sub.expiresAt.getTime() > now.getTime() ? sub.expiresAt : now;
    const newExpires = new Date(baseDate);
    newExpires.setDate(newExpires.getDate() + days);

    if (sub) {
      sub.plan = 'premium';
      sub.amount = payment.amount;
      sub.billingCycle = cycle;
      sub.expiresAt = newExpires;
      sub.isActive = true;
    } else {
      sub = this.subRepo.create({
        userId,
        plan: 'premium',
        amount: payment.amount,
        billingCycle: cycle,
        expiresAt: newExpires,
        isActive: true,
      });
    }
    sub = await this.subRepo.save(sub);

    await this.userRepo.update(userId, {
      isPremium: true,
      premiumExpiresAt: newExpires,
    });

    return sub;
  }

  /** 구독 해지 — 다음 만기일까지 사용권 유지, 자동 갱신만 중단 */
  async cancelSubscription(userId: string): Promise<Subscription | null> {
    const sub = await this.subRepo.findOne({ where: { userId, isActive: true } });
    if (!sub) throw new NotFoundException('활성 구독이 없습니다');
    sub.isActive = false;
    return this.subRepo.save(sub);
  }

  /**
   * 이상형 재탐색 쿼터 소모 — 프리미엄은 무제한 통과,
   * 무료는 Subscription.idealSearchRemaining 차감 (없으면 기본 1로 시작).
   * 쿼터 소진 시 403.
   *
   * TestFlight 단계에서는 ENABLE_IDEAL_QUOTA 가 true 가 아니면 쿼터 체크를 건너뛴다.
   * 프리미엄 플로우 정식 출시 시 env 로 활성화.
   */
  async consumeIdealSearch(userId: string): Promise<void> {
    if (process.env.ENABLE_IDEAL_QUOTA !== 'true') return;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    if (isPremiumUser(user)) return;

    let sub = await this.subRepo.findOne({ where: { userId } });
    if (!sub) {
      sub = await this.subRepo.save(
        this.subRepo.create({
          userId,
          plan: 'free',
          isActive: true,
          idealSearchRemaining: 1,
        }),
      );
    }
    if (sub.idealSearchRemaining <= 0) {
      throw new ForbiddenException(
        '이상형 재탐색 무료 횟수를 모두 사용했습니다. 프리미엄 구독 후 이용해주세요.',
      );
    }
    sub.idealSearchRemaining -= 1;
    await this.subRepo.save(sub);
  }

  /** 구독 현황 조회 */
  async getSubscriptionStatus(userId: string) {
    const [user, sub] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.subRepo.findOne({
        where: { userId },
        order: { createdAt: 'DESC' },
      }),
    ]);
    const now = Date.now();
    const premiumValid = !!(user?.isPremium && user.premiumExpiresAt && user.premiumExpiresAt.getTime() > now);
    const remainingDays =
      user?.premiumExpiresAt
        ? Math.max(0, Math.ceil((user.premiumExpiresAt.getTime() - now) / 86_400_000))
        : 0;

    return {
      isPremium: premiumValid,
      plan: sub?.plan ?? 'free',
      billingCycle: sub?.billingCycle ?? null,
      expiresAt: user?.premiumExpiresAt ?? null,
      remainingDays,
      isActive: sub?.isActive ?? false,
    };
  }
}
