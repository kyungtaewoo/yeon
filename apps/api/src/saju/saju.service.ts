import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SajuProfile } from './entities/saju-profile.entity';
import { MatchingService } from '../matching/matching.service';
import { UsersService } from '../users/users.service';
import {
  calculatePillars,
  generateReport,
  calculateElementScores,
  getDominantElement,
  estimateYongshin,
  findIdealMatchesV2,
  type FourPillars,
  type CompatibilityWeights,
  type SajuReport,
  ELEMENT_NAMES,
} from '@yeon/saju-engine';

interface CalculateInput {
  year: number;
  month: number;
  day: number;
  hour?: number | null;
  isLunar?: boolean;
}

interface IdealMatchInput {
  year: number;
  month: number;
  day: number;
  hour?: number | null;
  isLunar?: boolean;
  weights: CompatibilityWeights;
  ageRangeMin: number;
  ageRangeMax: number;
  topN?: number;
}

@Injectable()
export class SajuService {
  constructor(
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
    private readonly matchingService: MatchingService,
    private readonly usersService: UsersService,
  ) {}

  /** 사주팔자 산출 + 리포트 생성 (비로그인도 가능) */
  calculateAndReport(input: CalculateInput) {
    const pillars = calculatePillars({
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      isLunar: input.isLunar,
    });

    const report = generateReport(pillars);
    return { pillars, report };
  }

  /** 사주팔자 산출 + DB 저장 (로그인 유저) */
  async calculateAndSave(userId: string, input: CalculateInput) {
    const { pillars, report } = this.calculateAndReport(input);
    const elScores = calculateElementScores(pillars);
    const dominant = getDominantElement(elScores);
    const yongshin = estimateYongshin(pillars, elScores);

    // upsert
    let profile = await this.sajuRepo.findOne({ where: { userId } });

    const data = {
      userId,
      yearStem: pillars.year.stem,
      yearBranch: pillars.year.branch,
      monthStem: pillars.month.stem,
      monthBranch: pillars.month.branch,
      dayStem: pillars.day.stem,
      dayBranch: pillars.day.branch,
      hourStem: pillars.hour?.stem ?? undefined,
      hourBranch: pillars.hour?.branch ?? undefined,
      dominantElement: dominant,
      yongshin: ELEMENT_NAMES[yongshin].ko,
      gyeokguk: report.gyeokguk.name,
      elementScores: elScores,
      reportData: report,
    };

    if (profile) {
      await this.sajuRepo.update(profile.id, data as any);
    } else {
      const entity = this.sajuRepo.create(data as any);
      await this.sajuRepo.save(entity);
    }

    const saved = await this.sajuRepo.findOne({ where: { userId } });

    // 사주가 저장됐으므로 온보딩 완료로 표시 (사주가 핵심 온보딩 데이터)
    await this.usersService.update(userId, { isOnboardingComplete: true });

    // 사주가 방금 저장/갱신됐으므로 양방향 매칭 스캔
    await this.matchingService.scanAndCreateMatches(userId);

    return { pillars, report, profile: saved };
  }

  /** 저장된 사주 리포트 조회 */
  async getReport(userId: string) {
    const profile = await this.sajuRepo.findOne({ where: { userId } });
    if (!profile) return null;
    return {
      pillars: {
        year: { stem: profile.yearStem, branch: profile.yearBranch },
        month: { stem: profile.monthStem, branch: profile.monthBranch },
        day: { stem: profile.dayStem, branch: profile.dayBranch },
        hour: profile.hourStem ? { stem: profile.hourStem, branch: profile.hourBranch } : null,
      },
      report: profile.reportData,
      profile,
    };
  }

  /** 이상적 상대 사주 서치 (v2 전수 탐색) */
  findIdealMatches(input: IdealMatchInput) {
    const pillars = calculatePillars({
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      isLunar: input.isLunar,
    });

    return findIdealMatchesV2({
      mySaju: pillars,
      weights: input.weights,
      ageRange: { min: input.ageRangeMin, max: input.ageRangeMax },
      topN: input.topN || 10,
    });
  }
}
