import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SavedIdealTargetsService,
  SAVED_IDEAL_TARGET_LIMITS,
} from './saved-ideal-targets.service';
import { SavedIdealTarget } from '../entities/saved-ideal-target.entity';
import { User } from '../../users/entities/user.entity';
import { CreateSavedIdealTargetDto } from './dto/create-saved-ideal-target.dto';
import { ApiException } from '../../common/errors/api-exception';
import { SAVED_IDEAL_TARGET_ERROR_CODES } from './error-codes';

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
  dayStem: '甲',
  dayBranch: '子',
  ageMin: 25,
  ageMax: 35,
  totalScore: 87.5,
  profile: { rank: 1 },
  ...overrides,
});

const captureError = async (promise: Promise<unknown>): Promise<ApiException> => {
  const err = await promise.catch((e) => e);
  expect(err).toBeInstanceOf(ApiException);
  return err as ApiException;
};

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
    it('비프리미엄 limit 도달 (count=3) → ApiException 409 LIMIT_EXCEEDED + details', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: false }));
      repo.count!.mockResolvedValue(SAVED_IDEAL_TARGET_LIMITS.free);

      const err = await captureError(service.create(USER_ID, buildDto()));
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.LIMIT_EXCEEDED,
        details: { current: 3, limit: 3, tier: 'free' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    // 4
    it('프리미엄 limit 도달 (count=10) → ApiException 409 LIMIT_EXCEEDED + tier=premium', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: true }));
      repo.count!.mockResolvedValue(SAVED_IDEAL_TARGET_LIMITS.premium);

      const err = await captureError(service.create(USER_ID, buildDto()));
      expect(err.getStatus()).toBe(409);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.LIMIT_EXCEEDED,
        details: { current: 10, limit: 10, tier: 'premium' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    // 5
    it('dedup 충돌 (PG 23505) → ApiException 409 DUPLICATE (details 없음)', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser());
      repo.count!.mockResolvedValue(0);
      repo.create!.mockReturnValue({} as SavedIdealTarget);
      const pgErr = Object.assign(new Error('duplicate key'), { code: '23505' });
      repo.save!.mockRejectedValue(pgErr);

      const err = await captureError(service.create(USER_ID, buildDto()));
      expect(err.getStatus()).toBe(409);
      const body = err.getResponse() as Record<string, unknown>;
      expect(body.code).toBe(SAVED_IDEAL_TARGET_ERROR_CODES.DUPLICATE);
      expect(body.details).toBeUndefined();
    });

    // 6
    it('존재하지 않는 user → ApiException 404 USER_NOT_FOUND', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const err = await captureError(service.create(USER_ID, buildDto()));
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.USER_NOT_FOUND,
      });
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
    it('ageMax < ageMin → ApiException 400 INVALID_AGE_RANGE (user 조회 전에)', async () => {
      const err = await captureError(
        service.create(USER_ID, buildDto({ ageMin: 40, ageMax: 30 })),
      );
      expect(err.getStatus()).toBe(400);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.INVALID_AGE_RANGE,
      });
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('getMyList', () => {
    // 9
    it('비프리미엄 — items + meta 구성, canAddMore=true', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: false }));
      const items = [
        { id: 'r1', savedAt: new Date('2026-04-26') },
        { id: 'r2', savedAt: new Date('2026-04-25') },
      ] as SavedIdealTarget[];
      repo.find!.mockResolvedValue(items);

      const result = await service.getMyList(USER_ID);

      expect(result).toEqual({
        items,
        meta: { count: 2, limit: 3, tier: 'free', canAddMore: true },
      });
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        order: { savedAt: 'DESC' },
      });
    });

    // 10
    it('프리미엄 limit 도달 — canAddMore=false', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: true }));
      const items = Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` } as SavedIdealTarget));
      repo.find!.mockResolvedValue(items);

      const result = await service.getMyList(USER_ID);

      expect(result.meta).toEqual({
        count: 10, limit: 10, tier: 'premium', canAddMore: false,
      });
    });

    // 11
    it('빈 wish-list — meta 는 tier/limit 채우고 canAddMore=true', async () => {
      userRepo.findOne!.mockResolvedValue(buildUser({ isPremium: false }));
      repo.find!.mockResolvedValue([]);

      const result = await service.getMyList(USER_ID);

      expect(result).toEqual({
        items: [],
        meta: { count: 0, limit: 3, tier: 'free', canAddMore: true },
      });
    });

    // 12
    it('존재하지 않는 user → ApiException 404 USER_NOT_FOUND', async () => {
      userRepo.findOne!.mockResolvedValue(null);

      const err = await captureError(service.getMyList(USER_ID));
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.USER_NOT_FOUND,
      });
      expect(repo.find).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    // 13
    it('본인 소유 항목 삭제 성공', async () => {
      repo.delete!.mockResolvedValue({ affected: 1, raw: {} });

      await expect(service.remove(USER_ID, 'target-id')).resolves.toBeUndefined();
      expect(repo.delete).toHaveBeenCalledWith({ id: 'target-id', userId: USER_ID });
    });

    // 14
    it('다른 사람 것 / 미존재 → ApiException 404 TARGET_NOT_FOUND', async () => {
      repo.delete!.mockResolvedValue({ affected: 0, raw: {} });

      const err = await captureError(service.remove(USER_ID, 'target-id'));
      expect(err.getStatus()).toBe(404);
      expect(err.getResponse()).toMatchObject({
        code: SAVED_IDEAL_TARGET_ERROR_CODES.TARGET_NOT_FOUND,
      });
    });
  });
});
