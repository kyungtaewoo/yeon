import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  calculateGeneralCompatibility,
  calculateRomanticCompatibility,
  calculateDeepCompatibility,
  type FourPillars,
  type HeavenlyStem,
  type EarthlyBranch,
  type GeneralCompatibilityResult,
  type RomanticCompatibilityResult,
  type DeepCompatibilityResult,
} from '@yeon/saju-engine';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match } from '../matching/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { isPremiumUser } from '../common/premium.util';

export interface ThreeTierCompatibility {
  general: GeneralCompatibilityResult;
  romantic: RomanticCompatibilityResult | null;
  deep: DeepCompatibilityResult | null;
}

export interface FullThreeTier {
  general: GeneralCompatibilityResult;
  romantic: RomanticCompatibilityResult;
  deep: DeepCompatibilityResult;
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

function maskForFree(full: FullThreeTier): ThreeTierCompatibility {
  return {
    general: full.general,
    romantic: null,
    deep: null,
  };
}

@Injectable()
export class CompatibilityService {
  constructor(
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async calculateForUsers(userAId: string, userBId: string): Promise<FullThreeTier> {
    const [a, b] = await Promise.all([
      this.sajuRepo.findOne({ where: { userId: userAId } }),
      this.sajuRepo.findOne({ where: { userId: userBId } }),
    ]);
    if (!a) throw new NotFoundException('A 유저의 사주 프로필이 없습니다');
    if (!b) throw new NotFoundException('B 유저의 사주 프로필이 없습니다');
    return this.compute(profileToPillars(a), profileToPillars(b));
  }

  compute(sajuA: FourPillars, sajuB: FourPillars): FullThreeTier {
    return {
      general: calculateGeneralCompatibility(sajuA, sajuB),
      romantic: calculateRomanticCompatibility(sajuA, sajuB),
      deep: calculateDeepCompatibility(sajuA, sajuB),
    };
  }

  /** 현재 유저의 프리미엄 여부로 3단계 리포트를 마스킹 */
  private async maskByPremium(
    currentUserId: string,
    full: FullThreeTier,
  ): Promise<{ report: ThreeTierCompatibility; isPremium: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: currentUserId } });
    const premium = isPremiumUser(user);
    return {
      report: premium ? full : maskForFree(full),
      isPremium: premium,
    };
  }

  /** 현재 유저 기준으로 상대방과의 궁합 즉시 계산 (프리미엄 마스킹 적용) */
  async calculateForCurrentUser(currentUserId: string, otherUserId: string) {
    const full = await this.calculateForUsers(currentUserId, otherUserId);
    return this.maskByPremium(currentUserId, full);
  }

  /**
   * 매칭 리포트 조회. 캐시 없으면 계산 후 저장.
   * 프리미엄이 아니면 romantic/deep 마스킹 처리하여 반환.
   */
  async getForMatch(matchId: string, currentUserId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('매칭을 찾을 수 없습니다');
    if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
      throw new ForbiddenException('이 매칭에 대한 권한이 없습니다');
    }

    // 캐시된 full 리포트 (or 새 계산)
    let full: FullThreeTier;
    if (match.compatibilityReport) {
      full = match.compatibilityReport as FullThreeTier;
    } else {
      full = await this.calculateForUsers(match.userAId, match.userBId);
      match.compatibilityReport = full;
      match.compatibilityScore = full.general.totalScore;
      await this.matchRepo.save(match);
    }

    const { report, isPremium } = await this.maskByPremium(currentUserId, full);
    return { match, report, isPremium };
  }
}
