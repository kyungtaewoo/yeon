import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import {
  calculateGeneralCompatibility,
  calculateRomanticCompatibility,
  calculateDeepCompatibility,
  type FourPillars, type HeavenlyStem, type EarthlyBranch,
} from '@yeon/saju-engine';
import { SajuProfile } from '../saju/entities/saju-profile.entity';
import { FriendInvite } from './entities/friend-invite.entity';
import { FriendCompatibility } from './entities/friend-compatibility.entity';

const INVITE_TTL_DAYS = 7;

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

function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

@Injectable()
export class FriendsService {
  constructor(
    @InjectRepository(FriendInvite)
    private readonly inviteRepo: Repository<FriendInvite>,
    @InjectRepository(FriendCompatibility)
    private readonly compatRepo: Repository<FriendCompatibility>,
    @InjectRepository(SajuProfile)
    private readonly sajuRepo: Repository<SajuProfile>,
  ) {}

  /** 초대 코드 생성 */
  async createInvite(userId: string): Promise<FriendInvite> {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code = generateInviteCode();
      const exists = await this.inviteRepo.findOne({ where: { inviteCode: code } });
      if (!exists) break;
      code = '';
    }
    if (!code) throw new BadRequestException('초대 코드 생성 실패 — 다시 시도해주세요');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_TTL_DAYS);

    const invite = this.inviteRepo.create({
      inviterId: userId,
      inviteCode: code,
      expiresAt,
      status: 'pending',
    });
    return this.inviteRepo.save(invite);
  }

  /** 코드로 초대 검증 (비로그인 가능) */
  async verifyInvite(code: string) {
    const invite = await this.inviteRepo.findOne({
      where: { inviteCode: code },
      relations: ['inviter'],
    });
    if (!invite) throw new NotFoundException('초대 코드를 찾을 수 없습니다');

    const expired = invite.expiresAt.getTime() < Date.now();
    return {
      valid: !expired && invite.status !== 'expired',
      status: expired ? 'expired' : invite.status,
      inviteId: invite.id,
      inviter: { nickname: invite.inviter.nickname },
      hasInvitee: !!invite.inviteeId,
    };
  }

  /** 초대 수락 — 양쪽 사주가 있으면 즉시 계산 */
  async acceptInvite(code: string, userId: string): Promise<FriendInvite> {
    const invite = await this.inviteRepo.findOne({ where: { inviteCode: code } });
    if (!invite) throw new NotFoundException('초대 코드를 찾을 수 없습니다');
    if (invite.inviterId === userId) {
      throw new BadRequestException('본인의 초대는 수락할 수 없습니다');
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('만료된 초대입니다');
    }
    if (invite.inviteeId && invite.inviteeId !== userId) {
      throw new BadRequestException('이미 다른 유저가 수락한 초대입니다');
    }

    invite.inviteeId = userId;
    if (invite.status === 'pending') invite.status = 'joined';
    await this.inviteRepo.save(invite);

    return this.tryComputeCompatibility(invite);
  }

  /** 내가 관련된 친구 초대 리스트 */
  async listMyInvites(userId: string) {
    return this.inviteRepo.find({
      where: [{ inviterId: userId }, { inviteeId: userId }],
      order: { createdAt: 'DESC' },
      relations: ['inviter', 'invitee'],
    });
  }

  /** 초대 상세 + 저장된 궁합 */
  async getDetail(inviteId: string, userId: string) {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId },
      relations: ['inviter', 'invitee'],
    });
    if (!invite) throw new NotFoundException('초대를 찾을 수 없습니다');
    if (invite.inviterId !== userId && invite.inviteeId !== userId) {
      throw new ForbiddenException('이 초대에 대한 권한이 없습니다');
    }
    const compatibility = await this.compatRepo.findOne({ where: { inviteId } });
    return { invite, compatibility };
  }

  /** 양쪽 사주가 이제 모였을 때 수동 재계산 */
  async recompute(inviteId: string, userId: string): Promise<FriendInvite> {
    const invite = await this.inviteRepo.findOne({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('초대를 찾을 수 없습니다');
    if (invite.inviterId !== userId && invite.inviteeId !== userId) {
      throw new ForbiddenException('이 초대에 대한 권한이 없습니다');
    }
    return this.tryComputeCompatibility(invite);
  }

  /** 양쪽 사주가 있으면 3단계 궁합 계산/upsert, 상태 calculated로 전이 */
  private async tryComputeCompatibility(invite: FriendInvite): Promise<FriendInvite> {
    if (!invite.inviteeId) return invite;

    const [sajuA, sajuB] = await Promise.all([
      this.sajuRepo.findOne({ where: { userId: invite.inviterId } }),
      this.sajuRepo.findOne({ where: { userId: invite.inviteeId } }),
    ]);
    if (!sajuA || !sajuB) {
      // 한쪽이라도 사주 미입력 — 'joined' 유지
      return invite;
    }

    const pillarsA = profileToPillars(sajuA);
    const pillarsB = profileToPillars(sajuB);
    const general = calculateGeneralCompatibility(pillarsA, pillarsB);
    const romantic = calculateRomanticCompatibility(pillarsA, pillarsB);
    const deep = calculateDeepCompatibility(pillarsA, pillarsB);

    const payload = {
      inviteId: invite.id,
      userAId: invite.inviterId,
      userBId: invite.inviteeId,
      generalScore: general.totalScore,
      generalBreakdown: general,
      romanticScore: romantic.totalScore,
      romanticBreakdown: romantic,
      deepScore: deep.totalScore,
      deepBreakdown: deep,
    };

    const existing = await this.compatRepo.findOne({ where: { inviteId: invite.id } });
    if (existing) {
      await this.compatRepo.update(existing.id, payload as any);
    } else {
      await this.compatRepo.save(this.compatRepo.create(payload));
    }

    invite.status = 'calculated';
    return this.inviteRepo.save(invite);
  }
}
