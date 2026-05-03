-- Apple Sign In 지원 — Apple Guideline 4.8 준수.
--
-- 변경:
--   users.provider — 'kakao' (default, 기존 유저 backfill) | 'apple'
--   users.appleId  — Apple sub (UNIQUE, nullable). 카카오 가입자는 null.
--   users.email    — Apple private email 또는 일반 email (nullable).
--   users.kakaoId  — NOT NULL 해제 (Apple 가입자는 null 가능).

BEGIN;

-- 1. 새 컬럼
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider varchar NOT NULL DEFAULT 'kakao';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "appleId" varchar;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email varchar;

-- 2. appleId 유니크 (nullable 이므로 partial index 와 동일 효과)
CREATE UNIQUE INDEX IF NOT EXISTS users_apple_id_unique ON users ("appleId") WHERE "appleId" IS NOT NULL;

-- 3. kakaoId NOT NULL 해제 — Apple 가입자는 채울 수 없음
ALTER TABLE users ALTER COLUMN "kakaoId" DROP NOT NULL;

-- 4. 검증
SELECT provider, count(*) FROM users GROUP BY provider;

COMMIT;
