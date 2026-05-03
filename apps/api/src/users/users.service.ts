import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByKakaoId(kakaoId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { kakaoId } });
  }

  async findByAppleId(appleId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { appleId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id }, relations: ['sajuProfile'] });
  }

  async createFromKakao(kakaoId: string, nickname: string, gender?: string): Promise<User> {
    const user = this.userRepo.create({
      provider: 'kakao',
      kakaoId,
      nickname,
      gender: (gender as 'male' | 'female') || 'male',
    });
    return this.userRepo.save(user);
  }

  /**
   * Apple Sign In 신규 사용자 생성.
   * 성별/생년월일은 Apple 이 제공하지 않음 → 가입 후 사주 입력 단계에서 채움.
   * 닉네임도 Apple 첫 로그인에서만 제공되므로 클라이언트가 보내준 값을 그대로 저장.
   */
  async createAppleUser(input: {
    appleId: string;
    email: string | null;
    nickname: string;
  }): Promise<User> {
    const user = this.userRepo.create({
      provider: 'apple',
      appleId: input.appleId,
      email: input.email,
      nickname: input.nickname,
      // gender 는 사주 입력 단계에서 업데이트. 일단 기본값.
      gender: 'male',
    });
    return this.userRepo.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    await this.userRepo.update(id, data);
    return this.findById(id);
  }

  /**
   * 탈퇴 — 유저와 관련 데이터 모두 삭제.
   * FK 제약 회피를 위해 트랜잭션으로 의존 순서대로 삭제.
   * (앱스토어 가이드라인 5.1.1(v) 계정 삭제 요구사항 충족용으로도 필요.)
   */
  async deleteAccount(userId: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      // friend_compatibilities → friend_invites (FK 의존), 그 외엔 user 직접 참조
      await m.query(
        'DELETE FROM friend_compatibilities WHERE "userAId" = $1 OR "userBId" = $1',
        [userId],
      );
      await m.query(
        'DELETE FROM friend_invites WHERE "inviterId" = $1 OR "inviteeId" = $1',
        [userId],
      );
      await m.query('DELETE FROM subscriptions WHERE "userId" = $1', [userId]);
      await m.query('DELETE FROM ideal_saju_profiles WHERE "userId" = $1', [userId]);
      await m.query(
        'DELETE FROM matches WHERE "userAId" = $1 OR "userBId" = $1',
        [userId],
      );
      await m.query('DELETE FROM saju_profiles WHERE "userId" = $1', [userId]);
      await m.query('DELETE FROM users WHERE id = $1', [userId]);
    });
  }
}
