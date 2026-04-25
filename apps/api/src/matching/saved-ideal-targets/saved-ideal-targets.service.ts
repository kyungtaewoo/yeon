import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavedIdealTarget } from '../entities/saved-ideal-target.entity';
import { User } from '../../users/entities/user.entity';
import { CreateSavedIdealTargetDto } from './dto/create-saved-ideal-target.dto';

/**
 * 회원 등급별 wish-list 등록 가능 개수 — 서버가 source of truth.
 * 클라이언트 (apps/web/src/stores/savedMatchesStore.ts) 의 SAVED_MATCH_LIMITS 와
 * 동일 값을 유지해야 함. 정책 변경 시 양쪽 모두 수정.
 */
export const SAVED_IDEAL_TARGET_LIMITS = {
  free: 3,
  premium: 10,
} as const;

export type SavedIdealTargetTier = keyof typeof SAVED_IDEAL_TARGET_LIMITS;

export interface SavedIdealTargetListResponse {
  items: SavedIdealTarget[];
  meta: {
    count: number;
    limit: number;
    tier: SavedIdealTargetTier;
    canAddMore: boolean;
  };
}

/** PostgreSQL unique violation SQLSTATE. */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class SavedIdealTargetsService {
  constructor(
    @InjectRepository(SavedIdealTarget)
    private readonly repo: Repository<SavedIdealTarget>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * wish-list 추가.
   *
   * 동시성 옵션 (b) — count → insert → unique violation 처리.
   *   1) user 조회 (+ tier 확인)
   *   2) count 검사 → limit 초과 시 409
   *   3) insert → unique 제약 위반 시 409 (dedup)
   *
   * 같은 유저가 짧은 간격에 동시 호출하면 step 2 통과 후 step 3 둘 다 성공해
   * limit + 1 개가 될 수 있음 — UI 단일 클릭 흐름 가정한 MVP 한계.
   * Phase 2 에서 실제 매칭 큐 도입 시 user 행 SELECT FOR UPDATE 로 강화 예정.
   */
  async create(userId: string, dto: CreateSavedIdealTargetDto): Promise<SavedIdealTarget> {
    if (dto.ageMax < dto.ageMin) {
      // class-validator 가 cross-field 검증을 안 해서 서비스에서 가드.
      throw new BadRequestException('ageMax 는 ageMin 보다 작을 수 없습니다');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');

    const limit = user.isPremium
      ? SAVED_IDEAL_TARGET_LIMITS.premium
      : SAVED_IDEAL_TARGET_LIMITS.free;

    const count = await this.repo.count({ where: { userId } });
    if (count >= limit) {
      throw new ConflictException(`매칭 대상은 최대 ${limit}개까지 등록 가능합니다`);
    }

    try {
      const entity = this.repo.create({
        userId,
        dayStem: dto.dayStem,
        dayBranch: dto.dayBranch,
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        totalScore: dto.totalScore,
        profile: dto.profile,
        status: 'searching',
      });
      return await this.repo.save(entity);
    } catch (err: unknown) {
      if (isPgUniqueViolation(err)) {
        throw new ConflictException('이미 같은 후보가 저장되어 있습니다');
      }
      throw err;
    }
  }

  /**
   * 본인 wish-list — items + meta (limit/tier/canAddMore) 동시 반환.
   * 클라가 별도 user API 호출 없이 추가 버튼 disable 여부를 즉시 판단 가능.
   */
  async getMyList(userId: string): Promise<SavedIdealTargetListResponse> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다');

    const items = await this.repo.find({
      where: { userId },
      order: { savedAt: 'DESC' },
    });

    const tier: SavedIdealTargetTier = user.isPremium ? 'premium' : 'free';
    const limit = SAVED_IDEAL_TARGET_LIMITS[tier];
    const count = items.length;

    return {
      items,
      meta: { count, limit, tier, canAddMore: count < limit },
    };
  }

  /** 본인 소유 항목 1개 삭제. 다른 사람 것 / 미존재 시 404. */
  async remove(userId: string, id: string): Promise<void> {
    const result = await this.repo.delete({ id, userId });
    if (!result.affected) {
      throw new NotFoundException('해당 매칭 대상이 없습니다');
    }
  }
}

function isPgUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
