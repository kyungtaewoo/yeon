-- 가짜 데이터 cleanup — Build 44 베타 검증 종료 후 실행 예정
--
-- 적용 시점: Starry 가 TestFlight Build 44 검증 시나리오 1~10 통과 후
-- 적용 명령:
--   scp scripts/cleanup/seed-users-cleanup.sql ubuntu@lightsail:/tmp/
--   ssh ubuntu@lightsail "sudo -u postgres psql yeon -f /tmp/seed-users-cleanup.sql"
--
-- 안전장치:
--   - BEGIN/COMMIT 트랜잭션
--   - 종속 테이블 (matches, ideal_saju_profiles, saju_profiles, saved_ideal_targets) 먼저 정리
--   - kakaoId 화이트리스트 기반 — 실유저 보호
--
-- 대상 (2026-05-03 시점):
--   ┌──────────────────────────┬────────┬─────────────────┐
--   │ kakaoId                  │ count  │ 용도             │
--   ├──────────────────────────┼────────┼─────────────────┤
--   │ seed_test_1~5            │ 5      │ 친구 시드 Build 39│
--   │ disco_test_1~5           │ 5      │ 디스커버리 Build 41│
--   │ match_test_001           │ 1      │ 매칭 검증 (검증_미인28)│
--   └──────────────────────────┴────────┴─────────────────┘
--
-- 검증 (적용 전):
--   SELECT count(*) FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test';
--   → 11 expected
--
-- 검증 (적용 후):
--   SELECT count(*) FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test';
--   → 0 expected

BEGIN;

-- 1. matches — 시드 유저가 한쪽이라도 참여한 모든 row 제거
DELETE FROM matches
 WHERE "userAId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 )
    OR "userBId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 2. ideal_saju_profiles — 시드 유저의 이상형 프로필
DELETE FROM ideal_saju_profiles
 WHERE "userId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 3. saved_ideal_targets — 시드 유저가 저장한 천생연분 + 시드를 저장 대상으로 등록한 케이스 (이론상)
DELETE FROM saved_ideal_targets
 WHERE "userId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 4. saju_profiles
DELETE FROM saju_profiles
 WHERE "userId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 5. friends (양방향 friendships) — 친구 시드 (seed_test_1~5) 가 한쪽이라도 참여한 row
--    스키마 확인 후 활성화. 컬럼명이 다르면 ALTER 필요.
DELETE FROM friends
 WHERE "userAId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 )
    OR "userBId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 6. friend_invites — 시드 유저 발급/수락 invite (있으면)
DELETE FROM friend_invites
 WHERE "inviterUserId" IN (
   SELECT id FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test'
 );

-- 7. users — 마지막
DELETE FROM users
 WHERE "kakaoId" ~ '^(seed|disco|match)_test';

-- 검증
SELECT
  (SELECT count(*) FROM users WHERE "kakaoId" ~ '^(seed|disco|match)_test') AS leftover_users,
  (SELECT count(*) FROM saju_profiles s WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s."userId")) AS orphan_saju,
  (SELECT count(*) FROM matches m
     WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m."userAId")
        OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = m."userBId")) AS orphan_matches;

COMMIT;

-- 롤백이 필요하면 위 BEGIN 직후 까지의 ROLLBACK 으로 단일 트랜잭션 보호.
