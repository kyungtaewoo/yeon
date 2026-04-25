import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSavedIdealTargetDto } from './create-saved-ideal-target.dto';

const validPayload = {
  dayStem: '甲',
  dayBranch: '子',
  ageMin: 25,
  ageMax: 35,
  totalScore: 87.5,
  profile: { rank: 1 },
};

const validateDto = async (input: unknown) => {
  const dto = plainToInstance(CreateSavedIdealTargetDto, input);
  return validate(dto);
};

describe('CreateSavedIdealTargetDto — IsIn 한자 enum 강제', () => {
  it('한자 dayStem/dayBranch 통과', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toEqual([]);
  });

  it('한글 dayStem ("갑") 거부 — dedup 우회 방지', async () => {
    const errors = await validateDto({ ...validPayload, dayStem: '갑' });
    const dayStemErr = errors.find((e) => e.property === 'dayStem');
    expect(dayStemErr).toBeDefined();
    expect(dayStemErr!.constraints?.isIn).toMatch(/한자 천간/);
  });

  it('한글 dayBranch ("인") 거부', async () => {
    const errors = await validateDto({ ...validPayload, dayBranch: '인' });
    const branchErr = errors.find((e) => e.property === 'dayBranch');
    expect(branchErr).toBeDefined();
  });
});
