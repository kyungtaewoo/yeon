-- ============================================================
-- 001_initial_schema.sql
-- 緣 (연) — 사주궁합 매칭 플랫폼 초기 스키마
-- ============================================================

-- 유저 프로필
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_date DATE NOT NULL,
  birth_time TEXT,                           -- HH:MM 또는 null (시주 불명)
  birth_calendar TEXT DEFAULT 'solar' CHECK (birth_calendar IN ('solar', 'lunar')),
  age_range_min INT DEFAULT 20,
  age_range_max INT DEFAULT 40,
  avatar_url TEXT,
  phone TEXT,
  is_onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사주 정보 (산출 결과 저장)
CREATE TABLE saju_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 사주팔자 (천간 4 + 지지 4)
  year_stem TEXT NOT NULL,     -- 연간 (甲~癸)
  year_branch TEXT NOT NULL,   -- 연지 (子~亥)
  month_stem TEXT NOT NULL,    -- 월간
  month_branch TEXT NOT NULL,  -- 월지
  day_stem TEXT NOT NULL,      -- 일간 (일주 천간 = 나의 오행)
  day_branch TEXT NOT NULL,    -- 일지 (배우자궁)
  hour_stem TEXT,              -- 시간
  hour_branch TEXT,            -- 시지

  -- 분석 결과 캐시
  dominant_element TEXT,       -- 주요 오행 (wood/fire/earth/metal/water)
  yongshin TEXT,               -- 용신
  gyeokguk TEXT,               -- 격국
  element_scores JSONB,        -- {wood: 30, fire: 20, earth: 15, metal: 20, water: 15}
  ten_gods JSONB,              -- 십성 배치
  report_data JSONB,           -- 리포트용 분석 결과 전체

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 궁합 선호도
CREATE TABLE compatibility_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 각 항목 가중치 (0~100)
  romance_weight INT DEFAULT 50 CHECK (romance_weight BETWEEN 0 AND 100),
  marriage_weight INT DEFAULT 50 CHECK (marriage_weight BETWEEN 0 AND 100),
  wealth_weight INT DEFAULT 50 CHECK (wealth_weight BETWEEN 0 AND 100),
  children_weight INT DEFAULT 50 CHECK (children_weight BETWEEN 0 AND 100),
  health_weight INT DEFAULT 50 CHECK (health_weight BETWEEN 0 AND 100),
  personality_weight INT DEFAULT 50 CHECK (personality_weight BETWEEN 0 AND 100),

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 이상적 상대 사주 프로파일 (역산출 결과)
CREATE TABLE ideal_saju_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 이상적 상대의 사주 조합
  target_day_stem TEXT NOT NULL,
  target_day_branch TEXT NOT NULL,
  target_month_stem TEXT,
  target_month_branch TEXT,
  target_year_stem TEXT,
  target_year_branch TEXT,
  target_hour_stem TEXT,
  target_hour_branch TEXT,

  -- 매칭 관련
  compatibility_score NUMERIC(5,2),        -- 종합 궁합 점수
  score_breakdown JSONB,                   -- 항목별 점수
  birth_year_range INT4RANGE,              -- 대응 출생연도 범위
  rank INT NOT NULL,                       -- Top N 순위

  is_matched BOOLEAN DEFAULT FALSE,        -- 매칭 여부
  matched_user_id UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ideal_saju_day ON ideal_saju_profiles(target_day_stem, target_day_branch);
CREATE INDEX idx_ideal_saju_user ON ideal_saju_profiles(user_id);

-- 매칭
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES profiles(id),
  user_b_id UUID NOT NULL REFERENCES profiles(id),
  ideal_profile_a_id UUID REFERENCES ideal_saju_profiles(id),
  ideal_profile_b_id UUID REFERENCES ideal_saju_profiles(id),

  compatibility_score NUMERIC(5,2),
  compatibility_report JSONB,              -- 상세 궁합 리포트 데이터

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',           -- 매칭 발견, 양쪽에 알림 발송 전
    'notified',          -- 양쪽에 알림 발송됨
    'a_accepted',        -- A만 수락
    'b_accepted',        -- B만 수락
    'both_accepted',     -- 쌍방 수락 → 결제 대기
    'payment_pending',   -- 결제 진행 중
    'completed',         -- 결제 완료 → 프로필 교환
    'rejected',          -- 한쪽 이상 거절
    'expired'            -- 7일 무응답 만료
  )),

  user_a_decision TEXT CHECK (user_a_decision IN ('pending', 'accepted', 'rejected')),
  user_b_decision TEXT CHECK (user_b_decision IN ('pending', 'accepted', 'rejected')),

  notified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matches_users ON matches(user_a_id, user_b_id);
CREATE INDEX idx_matches_status ON matches(status);

-- 결제
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  user_id UUID NOT NULL REFERENCES profiles(id),

  amount INT NOT NULL,                     -- 원 단위
  payment_key TEXT,                        -- 토스 paymentKey
  order_id TEXT NOT NULL UNIQUE,           -- 주문번호
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready', 'done', 'canceled', 'failed')),

  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 후기
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id),
  reviewer_id UUID NOT NULL REFERENCES profiles(id),

  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  is_compatible BOOLEAN,                   -- "실제로 궁합이 맞았나요?"

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saju_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE compatibility_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideal_saju_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- 프로필: 본인만 읽기/수정
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 사주: 본인만
CREATE POLICY "saju_own" ON saju_profiles FOR ALL USING (auth.uid() = user_id);

-- 선호도: 본인만
CREATE POLICY "prefs_own" ON compatibility_preferences FOR ALL USING (auth.uid() = user_id);

-- 이상적 프로파일: 본인만
CREATE POLICY "ideal_own" ON ideal_saju_profiles FOR ALL USING (auth.uid() = user_id);

-- 매칭: 관련 당사자만
CREATE POLICY "matches_own" ON matches FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
CREATE POLICY "matches_update" ON matches FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- 결제: 본인만
CREATE POLICY "payments_own" ON payments FOR ALL USING (auth.uid() = user_id);

-- 후기: 본인 작성, 매칭 당사자 열람
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM matches
    WHERE matches.id = reviews.match_id
    AND (matches.user_a_id = auth.uid() OR matches.user_b_id = auth.uid())
  )
);
