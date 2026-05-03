// TODO: ApiException 패턴으로 점진 마이그레이션 (apps/api/src/common/errors/api-exception.ts 참고)
import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  findIdealMatchesV2,
  calculateGeneralCompatibility,
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
   * 관심 표시 — 디스커버리 카드의 "관심 표시" 버튼.
   *
   * 모델 A (양방향) 흐름:
   *   - 새 매칭이면: matches row INSERT, status='a_accepted', userADecision='accepted', 상대에게 match:new emit
   *   - 이미 row 가 있으면: decide() 패턴으로 본인 decision='accepted' update (양쪽 모두 accepted 면 both_accepted)
   *   - rejected/expired 매칭이면 차단
   */
  async expressInterest(userId: string, targetId: string): Promise<Match> {
    if (userId === targetId) {
      throw new BadRequestException('본인에게는 관심을 표시할 수 없습니다');
    }

    const [target, mySaju, theirSaju] = await Promise.all([
      this.userRepo.findOne({ where: { id: targetId } }),
      this.sajuRepo.findOne({ where: { userId } }),
      this.sajuRepo.findOne({ where: { userId: targetId } }),
    ]);
    if (!target) throw new NotFoundException('상대를 찾을 수 없습니다');
    if (!mySaju || !theirSaju) {
      throw new BadRequestException('양쪽 모두 사주 입력이 필요합니다');
    }

    // 기존 row 확인 — 디스커버리 필터에서 걸러지지만 race condition 안전장치
    const existing = await this.findExistingMatch(userId, targetId);
    if (existing) {
      if (existing.status === 'rejected' || existing.status === 'expired') {
        throw new BadRequestException('종결된 매칭입니다');
      }
      const myDecisionField = existing.userAId === userId ? 'userADecision' : 'userBDecision';
      if (existing[myDecisionField] === 'accepted') {
        throw new BadRequestException('이미 관심을 표시했습니다');
      }
      // 기존 decide() 재사용 — both_accepted 전이 + emit 까지 처리
      return this.decide(existing.id, userId, 'accepted');
    }

    // 새 매칭 INSERT
    const compat = calculateGeneralCompatibility(
      profileToPillars(mySaju),
      profileToPillars(theirSaju),
    );
    const match = this.matchRepo.create({
      userAId: userId,
      userBId: targetId,
      userADecision: 'accepted',
      userBDecision: null,
      status: 'a_accepted',
      idealMatchScore: compat.totalScore,
      compatibilityScore: null,
      notifiedAt: new Date(),
    });
    const saved = await this.matchRepo.save(match);

    // 상대에게 새 매칭 알림 — 가짜 user 면 emit silently fail (정상)
    this.notifications.emitToUser(targetId, 'match:new', {
      id: saved.id,
      score: compat.totalScore,
      by: userId,
    });

    return saved;
  }

  /**
   * 호환성 기반 디스커버리.
   * - 본인 제외
   * - 반대 성별
   * - 사주 입력 완료자 (isOnboardingComplete=true)
   * - 나이 = 본인 preferredAgeMin/Max 범위
   * - 이미 matches row 가 있는 상대 전부 제외 (rejected 영구 차단 포함)
   * - 일반 호환성 70점 이상, 점수 desc, 상위 20명
   */
  async discoverCandidates(userId: string) {
    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me) throw new NotFoundException('사용자를 찾을 수 없습니다');
    const mySaju = await this.sajuRepo.findOne({ where: { userId } });
    if (!mySaju) {
      throw new BadRequestException('사주 정보를 먼저 입력해주세요');
    }

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
      return age >= me.preferredAgeMin && age <= me.preferredAgeMax;
    });

    if (ageFiltered.length === 0) return { candidates: [], total: 0 };

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
        const compat = calculateGeneralCompatibility(myPillars, theirPillars);
        const age = calculateAge(u.birthDate!);
        const flavor = scoreFlavor(compat.totalScore);
        const summary = (compat.summary ?? compat.narrative ?? '').toString();
        // 첫 문장 — "...입니다." 까지. 마침표가 없으면 전체.
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
      .filter((c): c is NonNullable<typeof c> => c !== null && c.score >= 70);

    scored.sort((a, b) => b.score - a.score);
    const limited = scored.slice(0, 20);
    return { candidates: limited, total: limited.length };
  }

  /**
   * 매칭 상세 (UI 용) — 상대방 닉네임/사주/나이까지 함께 반환.
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

    return {
      match,
      myDecision,
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
