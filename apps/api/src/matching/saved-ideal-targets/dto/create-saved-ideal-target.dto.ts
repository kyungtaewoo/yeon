import {
  IsIn, IsInt, IsNotEmpty, IsNumber, IsObject,
  Max, Min,
} from 'class-validator';
import { HEAVENLY_STEMS, EARTHLY_BRANCHES } from '@yeon/saju-engine';

/**
 * dayStem / dayBranch 는 한자 (CJK 표의문자) 로만 저장.
 * 한글 (e.g., '갑', '인') 이 흘러들면 unique 제약이 동일 사주를 다른 행으로
 * 인식해 dedup 우회 — 그래서 enum 강제.
 */
export class CreateSavedIdealTargetDto {
  @IsIn(HEAVENLY_STEMS as readonly string[], {
    message: 'dayStem 은 한자 천간이어야 합니다 (甲乙丙丁戊己庚辛壬癸)',
  })
  dayStem!: string;

  @IsIn(EARTHLY_BRANCHES as readonly string[], {
    message: 'dayBranch 는 한자 지지여야 합니다 (子丑寅卯辰巳午未申酉戌亥)',
  })
  dayBranch!: string;

  @IsInt()
  @Min(0)
  @Max(120)
  ageMin!: number;

  @IsInt()
  @Min(0)
  @Max(120)
  ageMax!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  totalScore!: number;

  @IsObject()
  @IsNotEmpty()
  profile!: Record<string, unknown>;
}
