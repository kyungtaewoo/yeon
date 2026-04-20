-- ============================================================
-- 003_friends_premium.sql
-- 친구 궁합 + 프리미엄 구독 시스템
-- ============================================================

-- 친구 초대
CREATE TABLE IF NOT EXISTS friend_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  invitee_id UUID REFERENCES profiles(id),

  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 초대 발송, 대기 중
    'accepted',   -- 상대가 가입 & 사주 입력 완료
    'expired'     -- 7일 무응답 만료
  )),

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invite_inviter ON friend_invites(inviter_id);
CREATE INDEX idx_invite_code ON friend_invites(invite_code);
CREATE INDEX idx_invite_status ON friend_invites(status) WHERE status = 'pending';

-- 친구 궁합 결과 (3단계)
CREATE TABLE IF NOT EXISTS friend_compatibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES friend_invites(id) ON DELETE CASCADE,
  user_a_id UUID NOT NULL REFERENCES profiles(id),
  user_b_id UUID NOT NULL REFERENCES profiles(id),

  -- 1단계: 일반 궁합 (무료)
  general_score NUMERIC(5,2),
  general_breakdown JSONB,
  general_narrative TEXT,

  -- 2단계: 연인 궁합 (프리미엄)
  romantic_score NUMERIC(5,2),
  romantic_breakdown JSONB,
  romantic_narrative TEXT,
  romantic_marriage_score NUMERIC(5,2),
  romantic_style_score NUMERIC(5,2),

  -- 3단계: 깊은 궁합 (프리미엄)
  deep_score NUMERIC(5,2),
  deep_breakdown JSONB,
  deep_narrative JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_friend_compat_invite ON friend_compatibilities(invite_id);
CREATE INDEX idx_friend_compat_users ON friend_compatibilities(user_a_id, user_b_id);

-- 프리미엄 구독
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  plan TEXT NOT NULL CHECK (plan IN ('free', 'premium')),

  -- 결제 정보
  payment_key TEXT,
  amount INT,
  billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),

  -- 기간
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,

  -- 잔여 횟수
  ideal_search_remaining INT DEFAULT 1,
  reanalysis_remaining INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_user ON subscriptions(user_id);
CREATE INDEX idx_sub_active ON subscriptions(is_active, expires_at);

-- profiles에 구독 상태 캐시
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- RLS
ALTER TABLE friend_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_compatibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_own" ON friend_invites FOR ALL
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

CREATE POLICY "friend_compat_own" ON friend_compatibilities FOR ALL
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "sub_own" ON subscriptions FOR ALL
  USING (auth.uid() = user_id);
