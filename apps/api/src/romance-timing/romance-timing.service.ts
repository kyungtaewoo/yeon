import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  analyzeRomanceTiming, findMutualRomanceYears,
  type FourPillars, type HeavenlyStem, type EarthlyBranch,
  type RomanceTimingInput, type RomanceTimingResult,
} from '@yeon/saju-engine';
import { User } from '../users/entities/user.entity';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { Match } from '../matching/entities/match.entity';

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

function birthTimeToHour(birthTime: string | null | undefined): number | null {
  if (!birthTime) return null;
  const h = parseInt(birthTime.split(':')[0], 10);
  return Number.isFinite(h) ? h : null;
}

@Injectable()
export class RomanceTimingService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
    @InjectRepository(Match)
    private readonly matchRepo: Repository<Match>,
  ) {}

  private async buildInput(userId: string): Promise<RomanceTimingInput> {
    const [user, saju] = await Promise.all([
      this.userRepo.findOne({ where: { id: userId } }),
      this.sajuRepo.findOne({ where: { userId } }),
    ]);
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');
    if (!user.birthDate) {
      throw new BadRequestException('생년월일이 등록되지 않아 연애 시기 분석이 불가능합니다');
    }
    if (!saju) {
      throw new BadRequestException('사주 프로필이 없습니다. 먼저 사주를 입력해주세요.');
    }

    const birth = new Date(user.birthDate);
    return {
      saju: profileToPillars(saju),
      gender: user.gender,
      birthYear: birth.getFullYear(),
      birthMonth: birth.getMonth() + 1,
      birthDay: birth.getDate(),
      birthHour: birthTimeToHour(user.birthTime),
    };
  }

  async getForMe(userId: string): Promise<RomanceTimingResult> {
    const input = await this.buildInput(userId);
    return analyzeRomanceTiming(input);
  }

  async getForMatch(matchId: string, currentUserId: string) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('매칭을 찾을 수 없습니다');
    if (match.userAId !== currentUserId && match.userBId !== currentUserId) {
      throw new ForbiddenException('이 매칭에 대한 권한이 없습니다');
    }

    const [inputA, inputB] = await Promise.all([
      this.buildInput(match.userAId),
      this.buildInput(match.userBId),
    ]);

    const startYear = new Date().getFullYear();
    const endYear = startYear + 10;

    const a = analyzeRomanceTiming({ ...inputA, startYear, endYear });
    const b = analyzeRomanceTiming({ ...inputB, startYear, endYear });
    const mutual = findMutualRomanceYears(
      { ...inputA, startYear, endYear },
      { ...inputB, startYear, endYear },
    );

    return {
      match: { id: match.id, userAId: match.userAId, userBId: match.userBId },
      userA: { bestYear: a.bestYear, years: a.years },
      userB: { bestYear: b.bestYear, years: b.years },
      mutualTopYears: mutual.slice(0, 5),
    };
  }
}
