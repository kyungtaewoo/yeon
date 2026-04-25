import {
  IsInt, IsNotEmpty, IsNumber, IsObject, IsString,
  Length, Max, Min, ValidateIf,
} from 'class-validator';

export class CreateSavedIdealTargetDto {
  @IsString()
  @Length(1, 1, { message: 'dayStem 은 한 글자여야 합니다' })
  dayStem!: string;

  @IsString()
  @Length(1, 1, { message: 'dayBranch 는 한 글자여야 합니다' })
  dayBranch!: string;

  @IsInt()
  @Min(0)
  @Max(120)
  ageMin!: number;

  @IsInt()
  @Min(0)
  @Max(120)
  @ValidateIf((o: CreateSavedIdealTargetDto) => o.ageMin != null)
  ageMax!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  totalScore!: number;

  @IsObject()
  @IsNotEmpty()
  profile!: Record<string, unknown>;
}
