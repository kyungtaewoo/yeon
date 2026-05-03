-- 모델 C (제안-승낙) 전환 마이그레이션
-- 적용: ssh ubuntu@lightsail "psql ... -f /tmp/model-c.sql"
--
-- 변경 요약:
--   users:
--     + kakaoTalkId (text, nullable)
--     + dailyProposalCount (int, default 0)
--     + dailyProposalResetAt (timestamptz, nullable)
--   matches:
--     + contactMethods (jsonb)
--     + proposalMessage (text)
--     + kakaoTalkIdShared (text)
--     + kakaoTalkIdResponse (text)
--     + openChatPassword (varchar(16))
--     + proposedAt (timestamptz)
--     + respondedAt (timestamptz)
--     status: 모델 A 잔재 ('pending' | 'notified' | 'a_accepted' | 'b_accepted' |
--             'both_accepted' | 'payment_pending' | 'completed') → 'expired' 일괄 처리.
--             기본값을 'proposed' 로 변경.

BEGIN;

-- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS "kakaoTalkId" text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyProposalCount" int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "dailyProposalResetAt" timestamptz;

-- matches
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "contactMethods" jsonb;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "proposalMessage" text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "kakaoTalkIdShared" text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "kakaoTalkIdResponse" text;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "openChatPassword" varchar(16);
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "proposedAt" timestamptz;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS "respondedAt" timestamptz;

-- 모델 A 잔재 status 정리 — 'expired' 로
UPDATE matches
   SET status = 'expired'
 WHERE status IN (
   'pending','notified','a_accepted','b_accepted',
   'both_accepted','payment_pending','completed'
 );

-- default 변경
ALTER TABLE matches ALTER COLUMN status SET DEFAULT 'proposed';

COMMIT;
