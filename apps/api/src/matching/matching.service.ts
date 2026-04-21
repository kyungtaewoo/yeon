import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  findIdealMatchesV2,
  type CompatibilityWeights,
  type FourPillars,
  type HeavenlyStem,
  type EarthlyBranch,
} from '@yeon/saju-engine';
import { User } from '../users/entities/user.entity';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match, MatchDecision } from './entities/match.entity';
import { IdealSajuProfile } from './entities/ideal-saju-profile.entity';
import { NotificationGateway } from '../notification/notification.gateway';
import { PaymentService } from '../payment/payment.service';

function calculateAge(birthDate: Date): number {
  const now = new Date();
  const birth = new Date(birthDate);
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function profileToPillars(p: SajuProfile): FourPillars {
  return {
    year: { stem: p.yearStem as HeavenlyStem, branch: p.yearBranch as EarthlyBranch },
    month: { stem: p.monthStem as HeavenlyStem, branch: p.monthBranch as EarthlyBranch },
    day: { stem: p.dayStem as HeavenlyStem, branch: p.dayBranch as EarthlyBranch },
    hour: p.hourStem
      ? { stem: p.hourStem as HeavenlyStem, branch: p.hourBranch as EarthlyBranch }
      : null,
  };
}

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(IdealSajuProfile)
    private readonly idealRepo: Repository<IdealSajuProfile>,
    private readonly notifications: NotificationGateway,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * 이상적 상대 사주 전수 탐색 (v2) — 동기 실행, 결과를 DB에 upsert
   */
  async findIdeal(
    userId: string,
    weights: CompatibilityWeights,
    topN = 10,
  ): Promise<IdealSajuProfile[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const saju = await this.sajuRepo.findOne({ where: { userId } });
    if (!saju) {
      throw new BadRequestException('사주 프로필이 없습니다. 먼저 사주를 입력해주세요.');
    }

    // 무료 쿼터 체크 (프리미엄은 통과)
    await this.paymentService.consumeIdealSearch(userId);

    const results = findIdealMatchesV2({
      mySaju: profileToPillars(saju),
      weights,
      ageRange: { min: user.preferredAgeMin, max: user.preferredAgeMax },
      topN,
    });

    // 기존 이상형 프로필 삭제 후 새로 저장
    await this.idealRepo.delete({ userId });

    const entities = results.map((r) =>
      this.idealRepo.create({
        userId,
        rank: r.rank,
        dayStem: r.pillars.day.stem,
        dayBranch: r.pillars.day.branch,
        totalScore: r.totalScore,
        profile: r,
      }),
    );

    const saved = await this.idealRepo.save(entities);

    // 이상형 프로필이 새로 생겼으므로 역방향 매칭 스캔
    await this.scanAndCreateMatches(userId);

    return saved;
  }

  /**
   * 새 유저의 사주/이상형이 저장된 직후 호출.
   * 양방향으로 일주(dayStem+dayBranch)가 일치하고
   * 성별이 반대이며 나이 범위가 맞는 경우 Match 생성 (status=notified).
   *
   * Direction A: 기존 유저들의 IdealSajuProfile → 이 유저의 SajuProfile
   * Direction B: 이 유저의 IdealSajuProfile → 기존 유저들의 SajuProfile
   */
  async scanAndCreateMatches(userId: string): Promise<Match[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.birthDate) return [];

    const [saju, myIdeals] = await Promise.all([
      this.sajuRepo.findOne({ where: { userId } }),
      this.idealRepo.find({ where: { userId } }),
    ]);

    const userAge = calculateAge(user.birthDate);
    const created: Match[] = [];

    // ── Direction A: 기존 유저들의 이상형이 내 사주의 일주와 일치 ──
    if (saju) {
      const candidateIdeals = await this.idealRepo
        .createQueryBuilder('ideal')
        .where('ideal.userId != :userId', { userId })
        .andWhere('ideal.dayStem = :ds', { ds: saju.dayStem })
        .andWhere('ideal.dayBranch = :db', { db: saju.dayBranch })
        .getMany();

      if (candidateIdeals.length > 0) {
        const searcherIds = [...new Set(candidateIdeals.map((i) => i.userId))];
        const searchers = await this.userRepo.find({ where: { id: In(searcherIds) } });
        const searcherMap = new Map(searchers.map((u) => [u.id, u]));

        for (const ideal of candidateIdeals) {
          const searcher = searcherMap.get(ideal.userId);
          if (!searcher) continue;
          if (searcher.gender === user.gender) continue;
          if (userAge < searcher.preferredAgeMin || userAge > searcher.preferredAgeMax) continue;

          const existing = await this.findExistingMatch(searcher.id, user.id);
          if (existing) continue;

          const m = await this.matchRepo.save(
            this.matchRepo.create({
              userAId: searcher.id,
              userBId: user.id,
              idealMatchScore: ideal.totalScore,
              status: 'notified',
              notifiedAt: new Date(),
            }),
          );
          created.push(m);
          this.emitMatchNew(m);
        }
      }
    }

    // ── Direction B: 내 이상형이 기존 유저들의 사주 일주와 일치 ──
    for (const ideal of myIdeals) {
      const candidates = await this.sajuRepo
        .createQueryBuilder('s')
        .where('s.userId != :userId', { userId })
        .andWhere('s.dayStem = :ds', { ds: ideal.dayStem })
        .andWhere('s.dayBranch = :db', { db: ideal.dayBranch })
        .getMany();

      if (candidates.length === 0) continue;

      const candUsers = await this.userRepo.find({
        where: { id: In(candidates.map((c) => c.userId)) },
      });
      const candMap = new Map(candUsers.map((u) => [u.id, u]));

      for (const cand of candidates) {
        const candUser = candMap.get(cand.userId);
        if (!candUser || !candUser.birthDate) continue;
        if (candUser.gender === user.gender) continue;
        const candAge = calculateAge(candUser.birthDate);
        if (candAge < user.preferredAgeMin || candAge > user.preferredAgeMax) continue;

        const existing = await this.findExistingMatch(user.id, candUser.id);
        if (existing) continue;

        const m = await this.matchRepo.save(
          this.matchRepo.create({
            userAId: user.id,
            userBId: candUser.id,
            idealMatchScore: ideal.totalScore,
            status: 'notified',
            notifiedAt: new Date(),
          }),
        );
        created.push(m);
        this.emitMatchNew(m);
      }
    }

    return created;
  }

  private emitMatchNew(m: Match) {
    const payload = {
      id: m.id,
      idealMatchScore: m.idealMatchScore,
      status: m.status,
      createdAt: m.createdAt,
    };
    this.notifications.emitToUser(m.userAId, 'match:new', payload);
    this.notifications.emitToUser(m.userBId, 'match:new', payload);
  }

  private findExistingMatch(aId: string, bId: string): Promise<Match | null> {
    return this.matchRepo
      .createQueryBuilder('m')
      .where(
        '(m.userAId = :a AND m.userBId = :b) OR (m.userAId = :b AND m.userBId = :a)',
        { a: aId, b: bId },
      )
      .getOne();
  }

  /** 저장된 이상형 프로필 조회 */
  async getIdealProfiles(userId: string): Promise<IdealSajuProfile[]> {
    return this.idealRepo.find({
      where: { userId },
      order: { rank: 'ASC' },
    });
  }

  /** 내 매칭 리스트 */
  async listMyMatches(userId: string): Promise<Match[]> {
    return this.matchRepo.find({
      where: [{ userAId: userId }, { userBId: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  /** 매칭 상세 (참여자만) */
  async getMatch(matchId: string, currentUserId: string): Promise<Match> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('매칭을 찾을 수 없습니다');
    if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
      throw new ForbiddenException('이 매칭에 대한 권한이 없습니다');
    }
    return match;
  }

  accept(matchId: string, userId: string): Promise<Match> {
    return this.decide(matchId, userId, 'accepted');
  }

  reject(matchId: string, userId: string): Promise<Match> {
    return this.decide(matchId, userId, 'rejected');
  }

  private async decide(
    matchId: string,
    userId: string,
    decision: Exclude<MatchDecision, 'pending'>,
  ): Promise<Match> {
    const match = await this.getMatch(matchId, userId);

    if (match.status === 'completed' || match.status === 'expired') {
      throw new BadRequestException(`이미 ${match.status} 상태인 매칭입니다`);
    }

    const isUserA = match.userAId === userId;
    if (isUserA) match.userADecision = decision;
    else match.userBDecision = decision;

    if (decision === 'rejected') {
      match.status = 'rejected';
    } else {
      const aAccepted = match.userADecision === 'accepted';
      const bAccepted = match.userBDecision === 'accepted';
      if (aAccepted && bAccepted) match.status = 'both_accepted';
      else if (aAccepted) match.status = 'a_accepted';
      else if (bAccepted) match.status = 'b_accepted';
    }

    const saved = await this.matchRepo.save(match);

    // 상대방에게 알림
    const counterpartId = isUserA ? match.userBId : match.userAId;
    const event = decision === 'rejected'
      ? 'match:rejected'
      : saved.status === 'both_accepted'
        ? 'match:completed'
        : 'match:accepted';
    this.notifications.emitToUser(counterpartId, event, {
      id: saved.id,
      status: saved.status,
      by: userId,
    });

    return saved;
  }
}
