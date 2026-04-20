-- ============================================================
-- 002_ideal_saju_v2.sql
-- 역방향 매칭 v2: 전체 사주 + 실제 생년월일시 + 나이 범위
-- ============================================================

-- ideal_saju_profiles에 v2 칼럼 추가
ALTER TABLE ideal_saju_profiles
  ADD COLUMN IF NOT EXISTS matching_dates JSONB,
  ADD COLUMN IF NOT EXISTS age_range_min INT,
  ADD COLUMN IF NOT EXISTS age_range_max INT,
  ADD COLUMN IF NOT EXISTS target_description JSONB,
  ADD COLUMN IF NOT EXISTS narrative JSONB,
  ADD COLUMN IF NOT EXISTS algorithm_version TEXT DEFAULT 'v1';

-- profiles에 선호 나이 범위 칼럼 (기존 age_range_min/max가 있으면 기본값만 변경)
ALTER TABLE profiles
  ALTER COLUMN age_range_min SET DEFAULT 25,
  ALTER COLUMN age_range_max SET DEFAULT 35;

-- 전체 사주 기준 매칭 인덱스
CREATE INDEX IF NOT EXISTS idx_ideal_saju_full_v2 ON ideal_saju_profiles(
  target_day_stem, target_day_branch,
  target_month_stem, target_month_branch,
  target_year_stem, target_year_branch
);

-- 매칭 조회 시 알고리즘 버전 필터
CREATE INDEX IF NOT EXISTS idx_ideal_saju_version ON ideal_saju_profiles(algorithm_version)
  WHERE is_matched = FALSE;

-- 프로필 생년월일 인덱스 (나이 범위 검색용)
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date ON profiles(birth_date);
