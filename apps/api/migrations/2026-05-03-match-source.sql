-- 매칭 출처 추적 — 'discovery' | 'ideal_match'
-- 모든 기존 row 는 'discovery' 로 backfill (현재 천생연분 자동 매칭은 no-op 라 모두 탐색하기 출처).

BEGIN;

ALTER TABLE matches ADD COLUMN IF NOT EXISTS source varchar NOT NULL DEFAULT 'discovery';

-- 검증
SELECT source, count(*) FROM matches GROUP BY source;

COMMIT;
