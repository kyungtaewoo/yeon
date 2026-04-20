import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
        totalScore: r.totalScore,
        profile: r,
      }),
    );

    return this.idealRepo.save(entities);
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

    return this.matchRepo.save(match);
  }
}
