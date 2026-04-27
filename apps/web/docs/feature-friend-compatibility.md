# 緣 — 친구 궁합 매칭 기능 설계서

> **For Claude Code**: 본 문서는 緣 앱의 “카카오톡 친구 초대 → 궁합 보기” 기능 구현을 위한 설계서입니다. 이 문서를 참고하여 백엔드/프론트엔드 변경사항을 단계적으로 구현해주세요.

**작성일**: 2026-04-25  
**버전**: v1.0  
**전제 조건**: 1.0(10) 디버깅 완료 후 진행

-----

## 1. 기능 요약

사용자가 카카오톡으로 친구를 초대해 **양방향 사주 공유 후 궁합 결과를 확인**하는 기능. 친구 관계 시스템 위에 사주 공유 권한과 궁합 종류 선택을 결합한 SNS형 매칭 기능이다.

### 핵심 컨셉

- **친구가 회원가입 + 사주 입력 → 자동으로 양방향 공유**
- **친구 목록에서 사주 공유 ON/OFF 토글** (개인정보 자기결정권)
- **궁합 종류 선택** (일반 / 연인 / 사업파트너 / 가족 등)

### 수익화 방침

- 총점 + 요약 해설까지 **무료 공개**
- 게스트 모드는 도입하지 않음 (친구 = 회원이 전제)

-----

## 2. 사용자 플로우

### 2.1 메인 시나리오 (양방향 가입)

```
[Starry] 緣 앱 → 친구 초대 메뉴
   ↓
   "카카오톡으로 초대하기" 탭
   ↓
   카카오톡 공유 시트 → 친구 선택 → 메시지 전송
   ↓
[친구] 카톡 메시지의 링크 클릭
   ↓
   緣 앱 설치 (안 깔려 있으면 App Store/Play Store)
   ↓
   딥링크로 앱 실행 (초대 토큰 포함)
   ↓
   "[Starry]님이 초대했어요" 환영 화면
   ↓
   카카오 로그인 → 사주 입력 (기존 온보딩)
   ↓
   사주 입력 완료 시점에 "[Starry]님과 자동으로 친구 + 사주 공유"
   ↓
[양쪽 모두] 친구 목록에 상대방 표시 + 궁합 보기 가능
```

### 2.2 궁합 보기 플로우

```
친구 목록 → 친구 클릭
   ↓
   상대방 사주 공유 OFF 시: "사주 공유를 요청할까요?" CTA
   상대방 사주 공유 ON 시: 궁합 종류 선택 화면
   ↓
   궁합 종류 선택 (일반/연인/사업/가족)
   ↓
   계산 중 화면 (CompassMotif 재활용, 8초 최소 노출)
   ↓
   결과 화면 (총점 + 요약 + 항목별 분석)
```

### 2.3 사주 공유 토글 시나리오

```
친구 목록 → 우측 점 메뉴 → "사주 공유 설정"
   ↓
   토글 ON/OFF
   - ON: 상대방이 내 사주 기반 궁합을 볼 수 있음
   - OFF: 상대방에게는 "사주 공유가 비활성화되어 있어요" 표시
   ↓
   [중요] 변경 시 상대방에게 알림 발송 안 함 (조용히 처리)
```

-----

## 3. 데이터 모델

### 3.1 신규 테이블 3개

#### `friendships` (친구 관계)

```sql
CREATE TABLE friendships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
                  -- 'active' | 'blocked' | 'deleted'
  created_via     VARCHAR(20) NOT NULL DEFAULT 'invitation',
                  -- 'invitation' | 'manual' | 'recommendation'
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- A < B 정렬을 강제해 양방향 중복 방지
  CONSTRAINT user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT unique_pair UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX idx_friendships_user_a ON friendships(user_a_id, status);
CREATE INDEX idx_friendships_user_b ON friendships(user_b_id, status);
```

**설계 포인트:**

- 양방향 친구 관계를 한 행으로 관리 (`user_a_id < user_b_id` 강제)
- 별도의 친구 요청/수락 단계 없음 (초대 링크 = 자동 친구)
- soft delete (`status = 'deleted'`) 채택해 히스토리 보존

#### `saju_shares` (사주 공유 권한)

```sql
CREATE TABLE saju_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT no_self_share CHECK (owner_id != viewer_id),
  CONSTRAINT unique_share UNIQUE (owner_id, viewer_id)
);
CREATE INDEX idx_saju_shares_owner ON saju_shares(owner_id, is_active);
CREATE INDEX idx_saju_shares_viewer ON saju_shares(viewer_id, is_active);
```

**설계 포인트:**

- **단방향 권한** 모델 (A→B 공유와 B→A 공유는 독립)
- 친구 가입 시 양방향으로 자동 생성 (`is_active = TRUE`)
- 사용자가 ON/OFF 토글 시 `is_active` 변경
- 친구 관계와 별개라서 친구 삭제 없이도 공유만 끌 수 있음

#### `compatibility_results` (궁합 결과 캐시)

```sql
CREATE TABLE compatibility_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  compatibility_type VARCHAR(20) NOT NULL,
                  -- 'general' | 'romantic' | 'business' | 'family'
  total_score     INTEGER NOT NULL,
  detail_json     JSONB NOT NULL,
                  -- { categories: [...], summary: "...", strengths: [...], cautions: [...] }
  algorithm_version VARCHAR(10) NOT NULL DEFAULT 'v1',
  computed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT user_order CHECK (user_a_id < user_b_id),
  CONSTRAINT unique_compat UNIQUE (user_a_id, user_b_id, compatibility_type, algorithm_version)
);
CREATE INDEX idx_compat_pair ON compatibility_results(user_a_id, user_b_id);
```

**설계 포인트:**

- 같은 페어 + 같은 타입의 궁합은 한 번만 계산 후 캐싱
- 사주 변경 시 invalidation 필요 (사주 수정 시 해당 user의 모든 결과 삭제)
- algorithm_version으로 알고리즘 업데이트 시 자동 재계산 가능

### 3.2 신규 테이블 2개 (초대/딥링크)

#### `invitations` (초대 토큰)

```sql
CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token           VARCHAR(32) NOT NULL UNIQUE,
                  -- nanoid 22자 정도 권장
  invitee_user_id UUID REFERENCES users(id),
                  -- 가입 후 채워짐
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                  -- 'pending' | 'accepted' | 'expired'
  expires_at      TIMESTAMP NOT NULL,
                  -- 기본 30일
  accepted_at     TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_inviter ON invitations(inviter_id);
```

**보안 포인트:**

- 토큰은 추측 불가능한 random (nanoid 22자 = 충분한 엔트로피)
- 30일 만료
- 한 번 accepted 되면 재사용 불가

### 3.3 기존 `users` 테이블 추가 컬럼

```sql
ALTER TABLE users ADD COLUMN saju_share_default BOOLEAN NOT NULL DEFAULT TRUE;
-- 신규 친구 추가 시 자동 공유 여부 (개인정보 보수 사용자용 기본값 변경 옵션)
```

-----

## 4. API 설계

### 4.1 친구 / 초대 관련

```
POST /api/invitations
  → { token, share_url, kakao_message_template }
  
GET  /api/invitations/:token
  → { inviter_name, inviter_profile_image, expires_at, is_valid }
  
POST /api/invitations/:token/accept
  Authorization: Bearer <jwt>
  → { friendship_id, friend_user }
  
GET  /api/friends
  → [{ id, name, profile_image, saju_share_in, saju_share_out, created_at }]
       saju_share_in:  내가 친구의 사주를 볼 수 있는지
       saju_share_out: 친구가 내 사주를 볼 수 있는지

DELETE /api/friends/:friendship_id
  → 친구 삭제 (soft delete)
```

### 4.2 사주 공유 토글

```
PATCH /api/saju-shares/:viewer_user_id
  Body: { is_active: true | false }
  → { owner_id, viewer_id, is_active, updated_at }
  
GET /api/saju-shares/me
  → {
       outgoing: [{ viewer_id, viewer_name, is_active }],  // 내가 공유한 것
       incoming: [{ owner_id, owner_name, is_active }],    // 내가 받은 것
     }
```

### 4.3 궁합 계산

```
POST /api/compatibility
  Body: { 
    target_user_id: UUID,
    compatibility_type: 'general' | 'romantic' | 'business' | 'family'
  }
  → 200 OK: { 
       total_score, 
       summary, 
       categories: [
         { name: '성격 조화', score: 85, comment: '...' },
         { name: '대화 코드', score: 78, comment: '...' },
         ...
       ],
       strengths: [...],
       cautions: [...],
       computed_at
     }
  → 403 Forbidden: 사주 공유 OFF 상태인 경우
       { error: 'SAJU_SHARE_DISABLED', target_user_id }
  → 404 Not Found: 친구 관계 아닌 경우
       { error: 'NOT_FRIENDS' }

GET /api/compatibility/history
  → [{ partner_id, partner_name, type, total_score, computed_at }]
```

-----

## 5. 비즈니스 로직 핵심 규칙

### 5.1 초대 → 가입 → 친구 자동 연결

```
[Trigger] 새 사용자가 사주 입력 완료 (saju_input 단계 마지막)
   ↓
[Check] 회원가입 시 사용된 invitation token이 있는지 확인
   ↓
[If yes]
   1. invitations 테이블에서 inviter_id 조회
   2. friendships 테이블에 양방향 친구 관계 생성
      (user_a_id, user_b_id 정렬 후 INSERT)
   3. saju_shares 양방향 생성 (둘 다 is_active = TRUE)
   4. invitations.status = 'accepted', invitee_user_id 업데이트
   5. inviter에게 푸시 알림 발송
      "[친구이름]님이 초대를 수락하고 친구가 되었어요!"
```

### 5.2 사주 공유 권한 체크

```
[궁합 계산 요청 시]
   1. 두 사용자가 친구 관계인가? (friendships.status = 'active')
      → 아니면 404 NOT_FRIENDS
   2. 양쪽 모두 사주 공유 ON 상태인가?
      → owner=A, viewer=B 행이 is_active=TRUE
      → owner=B, viewer=A 행이 is_active=TRUE
      → 한쪽이라도 OFF면 403 SAJU_SHARE_DISABLED
   3. compatibility_results 캐시 확인
      → 있으면 반환
      → 없으면 새로 계산 후 INSERT
```

### 5.3 사주 변경 시 캐시 무효화

```
[Trigger] users 테이블의 사주 관련 필드 (생년월일시) UPDATE 시
   ↓
DELETE FROM compatibility_results 
WHERE user_a_id = :user_id OR user_b_id = :user_id;
```

-----

## 6. 궁합 계산 알고리즘 설계

### 6.1 4가지 궁합 종류 차이점

|종류                  |가중치   |핵심 분석 항목                             |
|--------------------|------|-------------------------------------|
|**general (일반)**    |균등    |성격 조화, 대화 코드, 가치관, 갈등 해결             |
|**romantic (연인)**   |감정 가중 |애정 궁합, 신체 궁합, 가정관, 장기 관계 안정성, 도화살    |
|**business (사업파트너)**|실리 가중 |신용도, 추진력, 의사결정 스타일, 재물 운, 갈등 시 분리 가능성|
|**family (가족)**     |안정성 가중|효도/배려, 의무감, 세대 차이, 가족 화목             |

### 6.2 점수 산출 로직 (각 카테고리별 0~100점)

기본 매칭 요소:

- **일주(日柱) 천간 합/충**: 합이면 +20, 충이면 -15
- **일주 지지 합/충**: 삼합/육합/방합 +15, 충/형/파/해 -10
- **오행 균형**: 두 사람 사주를 합쳐 오행이 골고루 분포할수록 +
- **십신 관계**: 정관/정인/식신 등 어떻게 작용하는지
- **신살(神殺)**: 도화살, 천을귀인, 역마살 등 특수 분석

### 6.3 카테고리별 가중치 예시

```typescript
const WEIGHTS = {
  general: {
    personality: 0.25,    // 성격 조화
    communication: 0.25,  // 대화 코드
    values: 0.25,         // 가치관
    conflict: 0.25,       // 갈등 해결
  },
  romantic: {
    affection: 0.30,      // 애정 궁합
    physical: 0.15,       // 신체 궁합 (도화살, 홍염살)
    family_view: 0.20,    // 가정관
    longevity: 0.20,      // 장기 안정성
    chemistry: 0.15,      // 케미 (천간 합)
  },
  business: {
    trust: 0.30,          // 신용
    drive: 0.20,          // 추진력
    decision: 0.20,       // 의사결정
    wealth: 0.20,         // 재물 운
    exit: 0.10,           // 분리 가능성
  },
  family: {
    filial: 0.30,         // 효도/배려
    duty: 0.25,           // 의무감
    generation: 0.20,     // 세대 차이
    harmony: 0.25,        // 화목
  },
};
```

### 6.4 결과 JSON 스키마 예시

```json
{
  "compatibility_type": "romantic",
  "total_score": 87,
  "summary": "두 분은 천간이 아름답게 합을 이루어, 서로 부족한 점을 채워주는 관계입니다. 특히 일주의 정인 작용으로 깊은 정서적 안정감을 느낄 수 있습니다.",
  "categories": [
    {
      "name": "애정 궁합",
      "score": 92,
      "comment": "도화살이 잘 작용해 서로를 매력적으로 느낍니다."
    },
    {
      "name": "신체 궁합",
      "score": 78,
      "comment": "..."
    }
  ],
  "strengths": [
    "천간 갑기(甲己) 합으로 서로를 보완",
    "오행 균형이 자연스러움"
  ],
  "cautions": [
    "지지 자오(子午) 충이 있어 의견 충돌 시 격해질 수 있음"
  ]
}
```

-----

## 7. 카카오톡 공유 메시지 설계

### 7.1 카카오톡 메시지 템플릿 (Feed Type)

```javascript
{
  objectType: 'feed',
  content: {
    title: '緣 - 사주 궁합 확인',
    description: '[Starry]님이 당신과의 인연을 궁금해합니다.\n생년월일을 입력하고 궁합을 확인해보세요.',
    imageUrl: 'https://yeon.app/og/invitation-cover.png',
    link: {
      mobileWebUrl: `https://yeon.app/invite/${token}`,
      webUrl: `https://yeon.app/invite/${token}`,
      androidExecutionParams: `invite_token=${token}`,
      iosExecutionParams: `invite_token=${token}`,
    },
  },
  buttons: [
    {
      title: '緣에서 인연 확인',
      link: {
        mobileWebUrl: `https://yeon.app/invite/${token}`,
        webUrl: `https://yeon.app/invite/${token}`,
        androidExecutionParams: `invite_token=${token}`,
        iosExecutionParams: `invite_token=${token}`,
      },
    },
  ],
}
```

### 7.2 딥링크 처리 (NativeBridge)

```
앱 실행 시 invite_token 파라미터 감지
   ↓
sessionStorage에 임시 저장
   ↓
온보딩 진입 시 token 함께 전달
   ↓
사주 입력 완료 후 백엔드에 token도 함께 POST
   ↓
백엔드가 친구 자동 연결 처리
```

-----

## 8. UI/UX 설계 가이드

### 8.1 신규 화면

|화면      |경로                                     |설명                 |
|--------|---------------------------------------|-------------------|
|친구 초대 시작|`/invite`                              |카톡 공유 버튼           |
|초대 환영   |`/invite/:token`                       |비로그인 상태에서 보는 환영 페이지|
|친구 목록   |`/friends`                             |친구 + 사주 공유 토글      |
|궁합 종류 선택|`/compatibility/:friendId/select`      |4종 선택              |
|궁합 결과   |`/compatibility/:friendId/result/:type`|점수 + 해설            |

### 8.2 친구 목록 카드 디자인

```
┌────────────────────────────────────┐
│ [프로필]  김친구                    │
│   ●      2025.10.12 친구됨         │
│          ─────────────────         │
│          내 사주 공유: [ON ●]      │
│          친구 사주: [공유 받음]    │
│                                    │
│          [궁합 보기 →]            │
└────────────────────────────────────┘
```

**상태별 분기:**

- **둘 다 공유 ON**: “궁합 보기” 버튼 활성화
- **내가 OFF**: “내 사주 공유부터 켜주세요” 메시지
- **친구가 OFF**: “친구가 사주 공유를 꺼두었어요” 메시지

### 8.3 궁합 종류 선택 화면

```
┌────────────────────────────────────┐
│  김친구님과 어떤 관계를 보시나요?   │
│                                    │
│  ┌────────┐  ┌────────┐           │
│  │  💛   │  │  💕   │           │
│  │ 일반  │  │ 연인  │           │
│  │ 궁합  │  │ 궁합  │           │
│  └────────┘  └────────┘           │
│                                    │
│  ┌────────┐  ┌────────┐           │
│  │  🤝   │  │  👨‍👩  │           │
│  │ 사업  │  │ 가족  │           │
│  │ 파트너│  │ 궁합  │           │
│  └────────┘  └────────┘           │
└────────────────────────────────────┘
```

### 8.4 궁합 결과 화면

```
┌────────────────────────────────────┐
│         💕 연인 궁합               │
│                                    │
│  Starry  ❤️  김친구                │
│                                    │
│       ┌──────────┐                 │
│       │   87점   │                 │
│       │  매우 좋음│                 │
│       └──────────┘                 │
│                                    │
│  두 분은 천간이 아름답게 합을      │
│  이루어, 서로 부족한 점을          │
│  채워주는 관계입니다...            │
│                                    │
│  [항목별 분석 펼치기 ▼]           │
│                                    │
│  💪 강점                           │
│  • 천간 갑기 합으로 서로를 보완    │
│  • 오행 균형이 자연스러움          │
│                                    │
│  ⚠️ 주의                           │
│  • 지지 자오 충이 있어 의견 충돌   │
│    시 격해질 수 있음               │
│                                    │
│  [공유하기]  [다른 종류 보기]     │
└────────────────────────────────────┘
```

-----

## 9. 보안 / 개인정보 고려사항

### 9.1 사주 공유 = 개인정보 처리

- 사주 공유 토글 변경 이력은 별도 로그 보관 (`saju_share_audit` 테이블)
- 공유 OFF 시점부터는 상대방이 캐싱된 결과 조회 시에도 결과 숨김
- 회원 탈퇴 시 cascade로 모든 friendships, saju_shares, compatibility_results 삭제

### 9.2 초대 토큰 보안

- 토큰 추측 방지: nanoid 22자 (~131bit 엔트로피)
- 30일 만료 + 1회용
- 토큰 노출 시에도 가입한 본인만 친구 등록됨 (인증 필수)

### 9.3 차단 기능

- 친구 목록에서 차단 옵션 제공
- 차단 시 양방향으로 사주 공유 즉시 OFF + 친구 관계 status=‘blocked’
- 차단된 사용자는 재초대 불가

-----

## 10. 구현 순서 (단계별)

### Phase 1: 백엔드 기반 (2일)

1. 신규 테이블 마이그레이션 (friendships, saju_shares, compatibility_results, invitations)
1. users 테이블 saju_share_default 컬럼 추가
1. 친구 모듈 (FriendsModule) 생성: 엔티티, 서비스, 컨트롤러
1. 초대 모듈 (InvitationsModule) 생성

### Phase 2: 궁합 알고리즘 (2일)

1. CompatibilityService 구현 (4종 타입별 가중치)
1. saju-engine 패키지에 천간 합/충, 지지 합/충 함수 추가
1. 캐시 invalidation 로직 (사주 수정 시 hook)
1. 단위 테스트 (각 궁합 타입별 샘플 케이스)

### Phase 3: 카카오톡 공유 + 딥링크 (1일)

1. 초대 토큰 생성 API + 카카오톡 메시지 템플릿
1. NativeBridge에 invite_token 파라미터 처리 추가
1. 온보딩 완료 시 자동 친구 연결 hook

### Phase 4: 프론트엔드 UI (2~3일)

1. 친구 목록 페이지 (`/friends`)
1. 사주 공유 토글 컴포넌트
1. 궁합 종류 선택 페이지
1. 궁합 결과 페이지 (CompassMotif 재활용한 로딩)
1. 카카오 공유 SDK 연동 (이미 카카오 로그인 SDK 사용 중이라 큰 추가 작업 없음)

### Phase 5: QA + 배포 (1일)

1. E2E 시나리오 테스트 (초대 → 가입 → 친구 등록 → 궁합 보기)
1. 사주 공유 OFF 케이스 검증
1. TestFlight 1.0(11) 빌드 + 내부 테스트
1. 안드로이드 베타 동시 배포

-----

## 11. 의사결정 필요한 부분 (Starry에게 확인)

다음은 구현 전 결정이 필요합니다:

1. **친구 추가 알림 푸시**
- 초대 수락 시 inviter에게만 알림? 양쪽 모두?
- 알림 클릭 시 친구 목록 / 궁합 결과 어디로?
1. **사주 공유 OFF의 의미**
- 안: 캐시된 결과는 보임 / 새 계산만 차단
- 밖: 캐시 결과도 즉시 숨김 (현재 설계는 이 쪽)
- 어느 정도 엄격하게 할지
1. **궁합 결과 공유 (사용자 → SNS)**
- 결과 화면에 “공유하기” 버튼 → 카톡으로 다시 결과 이미지 공유?
- 이건 Phase 6으로 분리할지?
1. **궁합 종류별 알고리즘 깊이**
- MVP: 4종 모두 같은 로직, 가중치만 다르게
- 정식: 각 종류별로 신살/십신 다르게 분석
- 어느 수준까지 갈지

-----

## 12. 작업 시작 시 첫 번째 단계

**Claude Code에게 권장하는 첫 작업:**

1. 본 문서를 `apps/web/docs/feature-friend-compatibility.md`로 저장
1. Phase 1 시작: 마이그레이션 파일 4개 생성
- `1xxx_create_friendships.ts`
- `1xxx_create_saju_shares.ts`
- `1xxx_create_compatibility_results.ts`
- `1xxx_create_invitations.ts`
1. TypeORM 엔티티 4개 생성 (entities 폴더)
1. 마이그레이션 dry-run으로 SQL 검증

위 4개 파일까지만 생성하고 일단 중단. Starry에게 SQL 검토 받은 후 다음 단계 진행.

-----

**문서 끝.**