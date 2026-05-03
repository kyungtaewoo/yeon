// TODO: ApiException 패턴으로 점진 마이그레이션 (apps/api/src/common/errors/api-exception.ts 참고)
import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  findIdealMatchesV2,
  calculateGeneralCompatibility,
  calculateRomanticCompatibility,
  calculateDeepCompatibility,
  type CompatibilityWeights,
  type FourPillars,
  type HeavenlyStem,
  type EarthlyBranch,
} from '@yeon/saju-engine';
import { User } from '../users/entities/user.entity';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match, MatchDecision, ContactMethods } from './entities/match.entity';
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

/** 점수 → 이모지 + 라벨. FriendDetail.tsx 의 scoreFlavor 와 동일 매핑 (5단계). */
function scoreFlavor(score: number): { emoji: string; label: string } {
  if (score >= 95) return { emoji: '🌟', label: '환상적' };
  if (score >= 85) return { emoji: '💛', label: '마음 통함' };
  if (score >= 70) return { emoji: '🤝', label: '안정적' };
  if (score >= 55) return { emoji: '⚡', label: '다름이 매력' };
  return { emoji: '🌪️', label: '노력 필요' };
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
    return saved;
  }

  /**
   * @deprecated 모델 A 잔재 — Model C 도입 후 자동 매칭 row 생성 폐기.
   * 정밀 매칭 (이상형 후보 가입 알림) 은 후속 PR 에서 별도 이벤트로 재구현.
   */
  async scanAndCreateMatches(_userId: string): Promise<Match[]> {
    return [];
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

  /** 매칭 상세 (참여자만) — 내부용 raw entity */
  async getMatch(matchId: string, currentUserId: string): Promise<Match> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('매칭을 찾을 수 없습니다');
    if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
      throw new ForbiddenException('이 매칭에 대한 권한이 없습니다');
    }
    return match;
  }

  /**
   * 모델 C — 제안하기 (sender → receiver).
   *
   * Q1: 일일 5건 (free) / 무제한 (premium)
   * Q3: 자유 텍스트 메시지 (max 500자, 옵션)
   * Q4: 7일 만료
   * Q5: 모델 A 양방향 폐기, 단방향 propose
   *
   * 사전 체크:
   *   - 본인에게 제안 X
   *   - 양쪽 사주 입력 완료
   *   - 기존 row 존재 시 차단 (rejected/expired/proposed/accepted 모두)
   *   - 일일 한도 (free 만)
   *   - contactMethods 1개 이상 + 해당 정보 필수
   *   - 메시지 500자 제한
   */
  async propose(
    senderId: string,
    targetId: string,
    input: {
      contactMethods: ContactMethods;
      message?: string | null;
      kakaoTalkIdShared?: string | null;
      openChatRoomUrl?: string | null;
      openChatPassword?: string | null;
    },
  ): Promise<Match> {
    if (senderId === targetId) {
      throw new BadRequestException('본인에게는 제안할 수 없어요');
    }

    const [sender, target, mySaju, theirSaju] = await Promise.all([
      this.userRepo.findOne({ where: { id: senderId } }),
      this.userRepo.findOne({ where: { id: targetId } }),
      this.sajuRepo.findOne({ where: { userId: senderId } }),
      this.sajuRepo.findOne({ where: { userId: targetId } }),
    ]);
    if (!sender) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (!target) throw new NotFoundException('상대를 찾을 수 없습니다');
    if (!mySaju || !theirSaju) {
      throw new BadRequestException('양쪽 모두 사주 입력이 필요해요');
    }

    // contactMethods 검증
    const cm = input.contactMethods ?? {};
    const wantsKakaoId = !!cm.kakaoId;
    const wantsOpenChat = !!cm.openChat;
    if (!wantsKakaoId && !wantsOpenChat) {
      throw new BadRequestException('연락 방법을 1개 이상 선택해야 해요');
    }
    if (wantsKakaoId && !input.kakaoTalkIdShared?.trim()) {
      throw new BadRequestException('카카오톡 ID 를 입력해 주세요');
    }
    if (wantsOpenChat) {
      const url = input.openChatRoomUrl?.trim() ?? '';
      const pwd = input.openChatPassword?.trim() ?? '';
      if (!url) throw new BadRequestException('오픈채팅 링크를 입력해 주세요');
      if (!/^https?:\/\/(open\.kakao\.com|qr\.kakao\.com)\//i.test(url)) {
        throw new BadRequestException('카카오 오픈채팅 링크만 등록할 수 있어요');
      }
      if (!pwd) throw new BadRequestException('오픈채팅 비밀번호를 입력해 주세요');
      if (!/^[0-9]{4}$/.test(pwd)) {
        throw new BadRequestException('비밀번호는 4자리 숫자로 설정해 주세요');
      }
    }

    // 메시지 길이
    const message = input.message?.trim() || null;
    if (message && message.length > 500) {
      throw new BadRequestException('메시지는 500자 이내여야 해요');
    }

    // 기존 row 존재 시 — 모든 status 에 대해 차단 (영구 차단 포함)
    const existing = await this.findExistingMatch(senderId, targetId);
    if (existing) {
      if (existing.status === 'rejected') {
        throw new BadRequestException('이미 거절된 상대예요');
      }
      if (existing.status === 'accepted') {
        throw new BadRequestException('이미 매칭된 상대예요');
      }
      if (existing.status === 'proposed') {
        throw new BadRequestException('이미 진행 중인 제안이 있어요');
      }
      // expired 는 재제안 허용 — 기존 row 폐기 후 새로
      await this.matchRepo.delete(existing.id);
    }

    // 일일 한도 (free 만) — KST 자정 리셋
    if (!sender.isPremium) {
      const now = new Date();
      const kstNow = new Date(now.getTime() + 9 * 3600_000);
      const kstMidnight = new Date(Date.UTC(
        kstNow.getUTCFullYear(),
        kstNow.getUTCMonth(),
        kstNow.getUTCDate(),
      ) - 9 * 3600_000);
      const lastReset = sender.dailyProposalResetAt ?? new Date(0);
      if (lastReset < kstMidnight) {
        sender.dailyProposalCount = 0;
        sender.dailyProposalResetAt = kstMidnight;
      }
      if (sender.dailyProposalCount >= 5) {
        throw new BadRequestException(
          '오늘은 더 이상 제안할 수 없어요. 내일 다시 시도하거나 프리미엄으로 무제한 사용하세요.',
        );
      }
      sender.dailyProposalCount += 1;
      await this.userRepo.save(sender);
    }

    // 호환성 점수 — 일반 궁합 기준
    const compat = calculateGeneralCompatibility(
      profileToPillars(mySaju),
      profileToPillars(theirSaju),
    );

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 3600_000);

    const match = this.matchRepo.create({
      userAId: senderId,
      userBId: targetId,
      idealMatchScore: compat.totalScore,
      compatibilityScore: null,
      status: 'proposed',
      userADecision: 'accepted', // 제안 = 암묵 수락
      userBDecision: null,
      contactMethods: { kakaoId: wantsKakaoId, openChat: wantsOpenChat },
      proposalMessage: message,
      kakaoTalkIdShared: wantsKakaoId ? input.kakaoTalkIdShared!.trim() : null,
      openChatRoomUrl: wantsOpenChat ? input.openChatRoomUrl!.trim() : null,
      openChatPassword: wantsOpenChat ? input.openChatPassword!.trim() : null,
      openChatCreatedBy: wantsOpenChat ? senderId : null,
      openChatCreatedAt: wantsOpenChat ? now : null,
      proposedAt: now,
      respondedAt: null,
      notifiedAt: now,
      expiresAt,
    });
    const saved = await this.matchRepo.save(match);

    this.notifications.emitToUser(targetId, 'match:proposed', {
      id: saved.id,
      score: compat.totalScore,
      from: senderId,
      message,
    });

    return saved;
  }

  /**
   * 받는쪽 응답 — 수락 또는 거절.
   *   - accepted: status='accepted', respondedAt set, 양쪽 알림
   *   - rejected: status='rejected', 영구 차단, 제안자 알림
   * 받는쪽이 수락 시 본인 카톡 ID 추가 공유 가능 (옵션).
   */
  async respondToProposal(
    matchId: string,
    userId: string,
    decision: 'accepted' | 'rejected',
    extra?: { kakaoTalkIdResponse?: string | null },
  ): Promise<Match> {
    const match = await this.getMatch(matchId, userId);
    if (match.userBId !== userId) {
      throw new ForbiddenException('받는 쪽만 응답할 수 있어요');
    }
    if (match.status !== 'proposed') {
      throw new BadRequestException(`이미 ${match.status} 상태인 제안이에요`);
    }
    // lazy expiry
    if (match.expiresAt && match.expiresAt < new Date()) {
      match.status = 'expired';
      await this.matchRepo.save(match);
      throw new BadRequestException('제안이 만료됐어요 (7일 경과)');
    }

    match.userBDecision = decision;
    match.respondedAt = new Date();

    if (decision === 'accepted') {
      match.status = 'accepted';
      const cleanId = extra?.kakaoTalkIdResponse?.trim();
      if (cleanId) match.kakaoTalkIdResponse = cleanId;
    } else {
      match.status = 'rejected';
    }

    const saved = await this.matchRepo.save(match);

    const event = decision === 'accepted' ? 'match:accepted' : 'match:rejected';
    this.notifications.emitToUser(match.userAId, event, {
      id: saved.id,
      status: saved.status,
      by: userId,
    });
    if (decision === 'accepted') {
      this.notifications.emitToUser(match.userBId, 'match:accepted', {
        id: saved.id,
        status: saved.status,
        by: userId,
      });
    }

    return saved;
  }

  /** 일일 제안 카운트 조회 — free 한도 표시용. */
  async getProposalQuota(userId: string): Promise<{ used: number; limit: number; isPremium: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    if (user.isPremium) return { used: 0, limit: -1, isPremium: true };

    const now = new Date();
    const kstNow = new Date(now.getTime() + 9 * 3600_000);
    const kstMidnight = new Date(Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
    ) - 9 * 3600_000);
    const lastReset = user.dailyProposalResetAt ?? new Date(0);
    if (lastReset < kstMidnight) {
      return { used: 0, limit: 5, isPremium: false };
    }
    return { used: user.dailyProposalCount, limit: 5, isPremium: false };
  }

  /**
   * 호환성 기반 디스커버리.
   * - 본인 제외, 반대 성별, 사주 입력 완료자
   * - 옵션 필터: ageMin/Max, tier(general|romantic|deep), minScore
   *   default — me.preferredAgeMin/Max, 'romantic', 50
   * - 이미 matches row 가 있는 상대 전부 제외 (rejected 영구 차단 포함)
   * - 점수 desc, 상위 20명
   */
  async discoverCandidates(
    userId: string,
    opts?: {
      ageMin?: number;
      ageMax?: number;
      tier?: 'general' | 'romantic' | 'deep';
      minScore?: number;
    },
  ) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me) throw new NotFoundException('사용자를 찾을 수 없습니다');
    const mySaju = await this.sajuRepo.findOne({ where: { userId } });
    if (!mySaju) {
      throw new BadRequestException('사주 정보를 먼저 입력해주세요');
    }

    const tier = opts?.tier ?? 'romantic';
    const minScore = opts?.minScore ?? 50;
    const ageMin = opts?.ageMin ?? me.preferredAgeMin;
    const ageMax = opts?.ageMax ?? me.preferredAgeMax;

    const calc =
      tier === 'general'
        ? calculateGeneralCompatibility
        : tier === 'deep'
          ? calculateDeepCompatibility
          : calculateRomanticCompatibility;

    const oppositeGender = me.gender === 'male' ? 'female' : 'male';
    const myPillars = profileToPillars(mySaju);

    // 매칭/거절 이력 — 모든 status 제외 (중복 방지 + 영구 차단)
    const existingMatches = await this.matchRepo.find({
      where: [{ userAId: userId }, { userBId: userId }],
    });
    const excludeIds = new Set<string>([
      userId,
      ...existingMatches.map((m) => (m.userAId === userId ? m.userBId : m.userAId)),
    ]);

    // 1차 fetch — 반대 성별 + 사주 입력 완료
    const candidates = await this.userRepo.find({
      where: { gender: oppositeGender, isOnboardingComplete: true },
    });

    const ageFiltered = candidates.filter((u) => {
      if (excludeIds.has(u.id)) return false;
      if (!u.birthDate) return false;
      const age = calculateAge(u.birthDate);
      return age >= ageMin && age <= ageMax;
    });

    if (ageFiltered.length === 0) {
      return { candidates: [], total: 0, tier, minScore };
    }

    // 사주 일괄 fetch (N+1 방지)
    const sajus = await this.sajuRepo.find({
      where: { userId: In(ageFiltered.map((u) => u.id)) },
    });
    const sajuByUserId = new Map(sajus.map((s) => [s.userId, s]));

    const scored = ageFiltered
      .map((u) => {
        const saju = sajuByUserId.get(u.id);
        if (!saju) return null;
        const theirPillars = profileToPillars(saju);
        const compat = calc(myPillars, theirPillars);
        const age = calculateAge(u.birthDate!);
        const flavor = scoreFlavor(compat.totalScore);
        // deep 의 narrative 는 객체 — summary 우선, 없으면 narrative.summary, 그것도 없으면 ''.
        const rawSummary =
          (compat as any).summary ??
          ((compat as any).narrative && typeof (compat as any).narrative === 'object'
            ? (compat as any).narrative.summary
            : (compat as any).narrative) ??
          '';
        const summary = String(rawSummary);
        const firstSentenceMatch = summary.match(/^[^.!?]+[.!?]/);
        const summaryOneLiner = firstSentenceMatch ? firstSentenceMatch[0].trim() : summary;
        return {
          id: u.id,
          nickname: u.nickname,
          score: compat.totalScore,
          emoji: flavor.emoji,
          label: flavor.label,
          dayPillar: `${saju.dayStem}${saju.dayBranch}`,
          gender: u.gender,
          ageRange: `${Math.floor(age / 10) * 10}대`,
          summaryOneLiner,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null && c.score >= minScore);

    scored.sort((a, b) => b.score - a.score);
    const limited = scored.slice(0, 20);
    return { candidates: limited, total: limited.length, tier, minScore };
  }

  /**
   * 매칭 상세 (UI 용) — 상대방 닉네임/사주/나이 + 오픈채팅 메타까지 함께 반환.
   * 클라이언트가 추가 호출 없이 디테일 화면을 그릴 수 있도록 enrich.
   */
  async getMatchDetail(matchId: string, currentUserId: string) {
    const match = await this.getMatch(matchId, currentUserId);
    const counterpartId = match.userAId === currentUserId ? match.userBId : match.userAId;

    const [counterpart, saju] = await Promise.all([
      this.userRepo.findOne({ where: { id: counterpartId } }),
      this.sajuRepo.findOne({ where: { userId: counterpartId } }),
    ]);

    const myDecision = match.userAId === currentUserId ? match.userADecision : match.userBDecision;
    const openChatCreatedByMe =
      match.openChatCreatedBy != null && match.openChatCreatedBy === currentUserId;
    const isProposer = match.userAId === currentUserId;
    const isReceiver = match.userBId === currentUserId;

    // lazy expiry — proposed 상태이고 7일 지나면 expired 처리 후 반환
    if (match.status === 'proposed' && match.expiresAt && match.expiresAt < new Date()) {
      match.status = 'expired';
      await this.matchRepo.save(match);
    }

    return {
      match,
      myDecision,
      openChatCreatedByMe,
      isProposer,
      isReceiver,
      counterpart: counterpart
        ? {
            id: counterpart.id,
            nickname: counterpart.nickname,
            gender: counterpart.gender,
            birthDate: counterpart.birthDate,
            age: counterpart.birthDate ? calculateAge(counterpart.birthDate) : null,
          }
        : null,
      counterpartSaju: saju
        ? {
            yearStem: saju.yearStem, yearBranch: saju.yearBranch,
            monthStem: saju.monthStem, monthBranch: saju.monthBranch,
            dayStem: saju.dayStem, dayBranch: saju.dayBranch,
            hourStem: saju.hourStem, hourBranch: saju.hourBranch,
            dominantElement: saju.dominantElement,
          }
        : null,
    };
  }

  /**
   * 사용자가 본인 카카오톡 ID 를 프로필에 등록 (제안 화면에서 호출).
   * 다음 제안부터 자동 prefill 가능.
   */
  async setMyKakaoTalkId(userId: string, kakaoTalkId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');
    const trimmed = (kakaoTalkId || '').trim();
    if (!trimmed) throw new BadRequestException('ID 가 비어있어요');
    if (trimmed.length > 64) throw new BadRequestException('ID 가 너무 길어요');
    user.kakaoTalkId = trimmed;
    return this.userRepo.save(user);
  }

  /**
   * @deprecated 모델 A — accept/reject 는 모델 C respondToProposal 로 대체.
   * 호환성 위해 alias 유지: userBId 라면 respondToProposal 로 라우팅.
   */
  async accept(matchId: string, userId: string): Promise<Match> {
    return this.respondToProposal(matchId, userId, 'accepted');
  }

  async reject(matchId: string, userId: string): Promise<Match> {
    return this.respondToProposal(matchId, userId, 'rejected');
  }
}
