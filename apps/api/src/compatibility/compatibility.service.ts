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

export interface ThreeTierCompatibility {
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

@Injectable()
export class CompatibilityService {
  constructor(
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
  ) {}

  /** 두 유저 ID → 3단계 궁합 계산 */
  async calculateForUsers(userAId: string, userBId: string): Promise<ThreeTierCompatibility> {
    const [a, b] = await Promise.all([
      this.sajuRepo.findOne({ where: { userId: userAId } }),
      this.sajuRepo.findOne({ where: { userId: userBId } }),
    ]);
    if (!a) throw new NotFoundException('A 유저의 사주 프로필이 없습니다');
    if (!b) throw new NotFoundException('B 유저의 사주 프로필이 없습니다');
    return this.compute(profileToPillars(a), profileToPillars(b));
  }

  compute(sajuA: FourPillars, sajuB: FourPillars): ThreeTierCompatibility {
    return {
      general: calculateGeneralCompatibility(sajuA, sajuB),
      romantic: calculateRomanticCompatibility(sajuA, sajuB),
      deep: calculateDeepCompatibility(sajuA, sajuB),
    };
  }

  /** 매칭 리포트 조회 (캐시 없으면 계산 후 저장) */
  async getForMatch(matchId: string, currentUserId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('매칭을 찾을 수 없습니다');
    if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
      throw new ForbiddenException('이 매칭에 대한 권한이 없습니다');
    }

    if (match.compatibilityReport) {
      return { match, report: match.compatibilityReport as ThreeTierCompatibility };
    }

    const report = await this.calculateForUsers(match.userAId, match.userBId);
    match.compatibilityReport = report;
    match.compatibilityScore = report.general.totalScore;
    await this.matchRepo.save(match);
    return { match, report };
  }
}
