-- ============================================================================
-- ⚠️  사람 참조용 SQL 입니다.
--     실제 PK/FK/INDEX 이름은 TypeORM 이 자동 해시로 부여하므로
--     아래 표기된 가독성 좋은 이름들과 운영 DB 의 실제 이름은 다릅니다
--     (예: "PK_saved_ideal_targets" → 실제는 "PK_8db70518117dd1a4b253896ca26").
--     @Unique / @Check 는 명시 이름을 데코레이터에 넘겼으므로 일치합니다.
--     향후 마이그레이션 인프라 도입 시 그때의 실제 이름으로 baseline 을 잡을 예정.
--     검증 스크립트: apps/api/scripts/dump-saved-ideal-target-sql.ts
-- ============================================================================
-- saved_ideal_targets — 사용자 wish-list (이상형 사주 후보 저장)
-- ----------------------------------------------------------------------------
-- 작성일: 2026-04-26
-- 관련 PR: PR 1 (DB 스키마 검토용 dry-run SQL)
-- 엔티티: apps/api/src/matching/entities/saved-ideal-target.entity.ts
--
-- 적용 방식:
--   현재 백엔드는 TypeORM `synchronize: true` 로 운영 중 (database.config.ts:12).
--   엔티티가 TypeOrmModule.forFeature([...]) 에 등록되는 순간 NestJS 부팅 시
--   PostgreSQL 에 자동으로 CREATE TABLE 이 실행됨.
--
--   → PR 1 시점엔 모듈 등록을 의도적으로 보류하여 배포해도 DB 변경 없음.
--   → PR 2 에서 모듈 등록 + API 컨트롤러 배포 시 자동 반영.
--
--   본 SQL 은 synchronize 가 생성할 스키마와 (의미상) 동일한 내용을 명시한
--   리뷰용 문서이며, 직접 psql 로 실행하지 않아도 됩니다.
--   Phase 2 또는 친구 궁합 PR 시작 시점에 정식 마이그레이션 인프라 도입 예정,
--   이 SQL 문서는 그때 첫 마이그레이션의 시드 자료로 보관.
--
-- 컬럼 네이밍:
--   기존 엔티티 (IdealSajuProfile, Match, User) 와 동일하게 camelCase 유지.
--   PostgreSQL 은 따옴표로 감싼 식별자만 대소문자 보존.
-- ============================================================================

CREATE TABLE "saved_ideal_targets" (
    "id"            uuid           NOT NULL DEFAULT uuid_generate_v4(),
    "userId"        uuid           NOT NULL,

    -- 검색/통계/dedup 용 비정규화 컬럼 (profile JSON 안에도 동일 값 존재)
    "dayStem"       varchar(1)     NOT NULL,    -- 일간 (e.g., '갑')
    "dayBranch"     varchar(1)     NOT NULL,    -- 일지 (e.g., '자')

    -- 연령 범위 — 기존 IdealMatchProfileV2.ageRange 문자열("만 25~35세")을
    -- 클라이언트에서 파싱하여 int 두 컬럼으로 정규화. dedup 견고성 + 필터 효율.
    "ageMin"        int            NOT NULL,
    "ageMax"        int            NOT NULL,

    "totalScore"    decimal(5, 2)  NOT NULL,    -- IdealSajuProfile 와 동일 정밀도

    -- 후보 사주 전체 (IdealMatchProfileV2)
    "profile"       jsonb          NOT NULL,

    -- 'searching' | 'matched' | 'archived'
    -- 'matched' 는 Phase 2 예약값. 실제 매칭 참조 컬럼은 Phase 2 에서 ALTER 로 추가.
    "status"        varchar        NOT NULL DEFAULT 'searching',

    -- @CreateDateColumn / @UpdateDateColumn 기본값 — 기존 엔티티들과 동일하게
    -- timestamp WITHOUT time zone (PG 기본). 향후 timestamptz 통일 마이그레이션은
    -- 별도 PR 에서 모든 createdAt/updatedAt 을 일괄 변환하는 게 안전.
    "savedAt"       timestamp      NOT NULL DEFAULT now(),
    "updatedAt"     timestamp      NOT NULL DEFAULT now(),

    CONSTRAINT "PK_saved_ideal_targets" PRIMARY KEY ("id"),

    -- 회원 탈퇴 시 wish-list 자동 삭제 (DB 레벨 cascade).
    -- users.service.deleteAccount 의 트랜잭션에도 명시적 DELETE 추가 예정 (PR 4).
    CONSTRAINT "FK_saved_ideal_targets_user"
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,

    -- 같은 유저가 동일 일간/일지/연령범위 후보를 중복 저장하지 못하게.
    CONSTRAINT "uq_saved_ideal_target_dedup"
        UNIQUE ("userId", "dayStem", "dayBranch", "ageMin", "ageMax"),

    -- 연령 범위 무결성 — 음수, 역전, 비현실적 상한 차단.
    CONSTRAINT "chk_saved_ideal_target_age_range"
        CHECK ("ageMin" >= 0 AND "ageMax" >= "ageMin" AND "ageMax" <= 120)
);

-- 목록 조회 — userId 필터 후 savedAt DESC 정렬
CREATE INDEX "IDX_saved_ideal_targets_userId_savedAt"
    ON "saved_ideal_targets" ("userId", "savedAt");

-- 상태별 필터 — Phase 2 매칭 큐 조회용 (지금은 거의 'searching' 만)
CREATE INDEX "IDX_saved_ideal_targets_userId_status"
    ON "saved_ideal_targets" ("userId", "status");

-- ============================================================================
-- PR 2 메모 (이번 PR 범위 외)
--   - limit 검증 동시성: 트랜잭션 + (a) SELECT count() FOR UPDATE on user row
--     또는 (b) INSERT 시도 → unique constraint 위반 시 409, count 검사 후 롤백.
--     (b) 가 락 범위 좁아 추천. dedup unique 와 별개로 user 단위 limit 카운터는 앱 레벨.
--   - 단위 테스트 최소 커버: limit 초과(free 4번째 / premium 11번째),
--     중복 저장(409), 존재하지 않는 user(401/404).
--   - "만 25~35세" → { ageMin: 25, ageMax: 35 } / "만 30세" → { ageMin: 30, ageMax: 30 }
--     파싱 함수는 클라(PR 3) 또는 DTO transform 단계에서 처리.
-- ============================================================================
