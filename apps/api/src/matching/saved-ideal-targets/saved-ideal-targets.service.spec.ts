import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SavedIdealTargetsService,
  SAVED_IDEAL_TARGET_LIMITS,
} from './saved-ideal-targets.service';
import { SavedIdealTarget } from '../entities/saved-ideal-target.entity';
import { User } from '../../users/entities/user.entity';
import { CreateSavedIdealTargetDto } from './dto/create-saved-ideal-target.dto';

type MockRepo<T extends object = any> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

const buildRepoMock = <T extends object>(): MockRepo<T> => ({
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
});

const USER_ID = '11111111-1111-1111-1111-111111111111';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    isPremium: false,
    ...overrides,
  } as User);

const buildDto = (overrides: Partial<CreateSavedIdealTargetDto> = {}): CreateSavedIdealTargetDto => ({
  dayStem: '갑',
  dayBranch: '자',
  ageMin: 25,
  ageMax: 35,
  totalScore: 87.5,
  profile: { rank: 1 },
  ...overrides,
});

describe('SavedIdealTargetsService', () => {
  let service: SavedIdealTargetsService;
  let repo: MockRepo<SavedIdealTarget>;
  let userRepo: MockRepo<User>;

  beforeEach(async () => {
    repo = buildRepoMock<SavedIdealTarget>();
    userRepo = buildRepoMock<User>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedIdealTargetsService,
        { provide: getRepositoryToken(SavedIdealTarget), useValue: repo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(SavedIdealTargetsService);
  });

  describe('create', () => {
    // 1
    it('비프리미엄 첫 등록 성공 (count=0, limit=3)', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: false }));
      repo.count!.mockResolvedValue(0);
      const saved = { id: 'a' } as SavedIdealTarget;
      repo.create!.mockReturnValue(saved);
      repo.save!.mockResolvedValue(saved);

      const result = await service.create(USER_ID, buildDto());

      expect(result).toBe(saved);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, status: 'searching' }),
      );
      expect(repo.save).toHaveBeenCalledWith(saved);
    });

    // 2
    it('프리미엄 첫 등록 성공 (count=0, limit=10)', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: true }));
      repo.count!.mockResolvedValue(0);
      const saved = { id: 'b' } as SavedIdealTarget;
      repo.create!.mockReturnValue(saved);
      repo.save!.mockResolvedValue(saved);

      await expect(service.create(USER_ID, buildDto())).resolves.toBe(saved);
    });

    // 3
    it('비프리미엄 limit 도달 (count=3) → ConflictException', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: false }));
      repo.count!.mockResolvedValue(SAVED_IDEAL_TARGET_LIMITS.free);

      await expect(service.create(USER_ID, buildDto())).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    // 4
    it('프리미엄 limit 도달 (count=10) → ConflictException', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: true }));
      repo.count!.mockResolvedValue(SAVED_IDEAL_TARGET_LIMITS.premium);

      await expect(service.create(USER_ID, buildDto())).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    // 5
    it('dedup 충돌 (PG 23505) → ConflictException("이미 같은 후보")', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser());
      repo.count!.mockResolvedValue(0);
      repo.create!.mockReturnValue({} as SavedIdealTarget);
      const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
      repo.save!.mockRejectedValue(pgErr);

      await expect(service.create(USER_ID, buildDto())).rejects.toMatchObject({
        message: expect.stringContaining('이미 같은 후보'),
      });
    });

    // 6
    it('존재하지 않는 user → NotFoundException', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      await expect(service.create(USER_ID, buildDto())).rejects.toThrow(NotFoundException);
      expect(repo.count).not.toHaveBeenCalled();
    });

    // 7
    it('insert가 unique 외 다른 PG 에러를 던지면 그대로 전파 (재처리 없음)', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser());
      repo.count!.mockResolvedValue(0);
      repo.create!.mockReturnValue({} as SavedIdealTarget);
      const otherErr = Object.assign(new Error('check_violation'), { code: '23514' });
      repo.save!.mockRejectedValue(otherErr);

      await expect(service.create(USER_ID, buildDto())).rejects.toBe(otherErr);
    });

    // 8
    it('ageMax < ageMin 이면 ConflictException (서비스 레벨 가드)', async () => {
      // user lookup 도달하기 전에 거부되어야 함
      await expect(
        service.create(USER_ID, buildDto({ ageMin: 40, ageMax: 30 })),
      ).rejects.toThrow(ConflictException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('findAllByUser', () => {
    // 9
    it('본인 wish-list 만 반환 (savedAt DESC, where userId)', async () => {
      const rows = [
        { id: 'r1', savedAt: new Date('2026-04-26') },
        { id: 'r2', savedAt: new Date('2026-04-25') },
      ] as SavedIdealTarget[];
      repo.find!.mockResolvedValue(rows);

      const result = await service.findAllByUser(USER_ID);

      expect(result).toBe(rows);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { savedAt: 'DESC' },
      });
    });
  });

  describe('remove', () => {
    // 10
    it('본인 소유 항목 삭제 성공', async () => {
      repo.delete!.mockResolvedValue({ affected: 1, raw: {} });

      await expect(service.remove(USER_ID, 'target-id')).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith({ id: 'target-id', userId: USER_ID });
    });

    // 11 (보너스 — affected=0 케이스도 같은 메서드 분기 검증)
    it('다른 사람 것 / 미존재 → NotFoundException (affected=0)', async () => {
      repo.delete!.mockResolvedValue({ affected: 0, raw: {} });

      await expect(service.remove(USER_ID, 'target-id')).rejects.toThrow(NotFoundException);
    });
  });
});
