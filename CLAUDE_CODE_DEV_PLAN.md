# 緣(연) — 개발 계획서 v2 (NestJS 기반)
## Claude Code / Cursor 프로젝트 스펙

---

## 1. 프로젝트 개요

**앱 이름:** 緣 (연)
**컨셉:** 사주명리학 기반 역방향 매칭 소개팅 플랫폼
**아키텍처:** Next.js (프론트) + NestJS (백엔드 API) + PostgreSQL
**선택 이유:** 놀이터 체크인과 동일 스택. 사주 엔진/매칭 로직 등 복잡한 비즈니스 로직을 NestJS에서 자유롭게 구현.

---

## 2. 기술 스택

```
┌─── Frontend ──────────────────────────────────┐
│  Next.js 14 (App Router) + TypeScript          │
│  Tailwind CSS + shadcn/ui                      │
│  Framer Motion (애니메이션)                     │
│  Zustand (상태관리)                             │
│  PWA (서비스워커)                               │
│  Deploy: Vercel                                │
└────────────────────────────────────────────────┘

┌─── Backend ───────────────────────────────────┐
│  NestJS + TypeScript                           │
│  TypeORM (PostgreSQL ORM)                      │
│  Passport.js (카카오 OAuth + JWT)              │
│  Bull (Redis 기반 큐 — 매칭/알림 비동기)       │
│  Socket.IO (실시간 매칭 알림)                   │
│  Deploy: AWS Lightsail or EC2                  │
└────────────────────────────────────────────────┘

┌─── Database & Infra ──────────────────────────┐
│  PostgreSQL 15                                 │
│  Redis (Bull 큐 + 캐싱)                        │
│  Firebase Cloud Messaging (푸시 알림)          │
│  토스페이먼츠 SDK (결제)                        │
│  카카오 JavaScript SDK (공유/로그인)            │
└────────────────────────────────────────────────┘
```

---

## 3. 디렉토리 구조

### 3.1 모노레포 구조

```
yeon/
├── apps/
│   ├── web/                          # Next.js 프론트엔드
│   └── api/                          # NestJS 백엔드
├── packages/
│   └── saju-engine/                  # 사주 분석 엔진 (공유 패키지)
├── package.json                      # workspace root
├── turbo.json                        # (선택) Turborepo
├── CLAUDE_CODE_DEV_PLAN.md
├── FEATURE_FRIEND_INVITE.md
├── FEATURE_REVERSE_MATCH_V2.md
└── FEATURE_FRIENDS_PREMIUM.md
```

### 3.2 Frontend — `apps/web/`

```
apps/web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # 랜딩
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx        # 카카오 로그인
│   │   │   └── callback/page.tsx     # OAuth 콜백
│   │   │
│   │   ├── (onboarding)/
│   │   │   ├── saju-input/page.tsx   # 생년월일시 입력
│   │   │   ├── saju-report/page.tsx  # 사주 리포트
│   │   │   ├── preferences/page.tsx  # 궁합 선호도 + 나이 범위
│   │   │   └── ideal-match/page.tsx  # 이상적 상대 결과
│   │   │
│   │   ├── (main)/
│   │   │   ├── layout.tsx            # 하단 탭바
│   │   │   ├── home/page.tsx         # 홈 대시보드
│   │   │   ├── matches/
│   │   │   │   ├── page.tsx          # 매칭 리스트
│   │   │   │   └── [id]/page.tsx     # 매칭 궁합 리포트 + 연애 시기
│   │   │   ├── friends/
│   │   │   │   ├── page.tsx          # 친구 궁합 탭
│   │   │   │   └── [inviteId]/page.tsx
│   │   │   ├── my-saju/page.tsx
│   │   │   └── profile/page.tsx
│   │   │
│   │   └── invite/
│   │       └── [code]/page.tsx       # 초대 랜딩 (게스트)
│   │
│   ├── lib/
│   │   ├── api.ts                    # API 클라이언트 (fetch wrapper)
│   │   ├── auth.ts                   # JWT 토큰 관리
│   │   └── kakao.ts                  # 카카오 SDK 초기화 & 공유
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui
│   │   ├── saju/                     # 사주 관련 컴포넌트
│   │   ├── matching/                 # 매칭 관련 컴포넌트
│   │   ├── friends/                  # 친구 궁합
│   │   ├── premium/                  # 프리미엄 UI
│   │   └── layout/                   # 레이아웃
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSocket.ts              # Socket.IO 클라이언트 훅
│   │   └── usePremium.ts
│   │
│   └── stores/
│       ├── authStore.ts
│       ├── onboardingStore.ts
│       └── matchStore.ts
│
├── public/
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

### 3.3 Backend — `apps/api/`

```
apps/api/
├── src/
│   ├── main.ts                       # NestJS 부트스트랩
│   ├── app.module.ts                 # 루트 모듈
│   │
│   ├── config/
│   │   ├── database.config.ts        # TypeORM 설정
│   │   ├── redis.config.ts           # Redis/Bull 설정
│   │   └── jwt.config.ts             # JWT 설정
│   │
│   ├── auth/                         # 인증 모듈
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts        # POST /auth/kakao, GET /auth/me
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── kakao.strategy.ts     # Passport 카카오 전략
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── premium.guard.ts      # 프리미엄 체크 가드
│   │   └── decorators/
│   │       └── current-user.decorator.ts
│   │
│   ├── users/                        # 유저/프로필 모듈
│   │   ├── users.module.ts
│   │   ├── users.controller.ts       # GET/PATCH /users/me
│   │   ├── users.service.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   │
│   ├── saju/                         # ⭐ 사주 분석 모듈
│   │   ├── saju.module.ts
│   │   ├── saju.controller.ts        # POST /saju/calculate, GET /saju/report
│   │   ├── saju.service.ts
│   │   └── entities/
│   │       └── saju-profile.entity.ts
│   │
│   ├── compatibility/                # ⭐ 궁합 모듈
│   │   ├── compatibility.module.ts
│   │   ├── compatibility.controller.ts  # POST /compatibility/calculate
│   │   ├── compatibility.service.ts     # 3단계 궁합 (일반/연인/깊은)
│   │   └── engines/
│   │       ├── general.engine.ts        # 일반 궁합
│   │       ├── romantic.engine.ts       # 연인 궁합
│   │       └── deep.engine.ts           # 깊은 궁합 (속궁합)
│   │
│   ├── matching/                     # ⭐ 매칭 모듈
│   │   ├── matching.module.ts
│   │   ├── matching.controller.ts    # GET /matching, POST /matching/:id/accept
│   │   ├── matching.service.ts
│   │   ├── matching.processor.ts     # Bull 큐 프로세서 (비동기 매칭 탐색)
│   │   ├── reverse-match.service.ts  # v2 전수 탐색 엔진
│   │   └── entities/
│   │       ├── match.entity.ts
│   │       └── ideal-saju-profile.entity.ts
│   │
│   ├── romance-timing/               # ⭐ 연애 시기 분석 모듈
│   │   ├── romance-timing.module.ts
│   │   ├── romance-timing.controller.ts  # GET /romance-timing/:userId
│   │   ├── romance-timing.service.ts
│   │   └── engines/
│   │       ├── daeun.engine.ts          # 대운 계산
│   │       ├── seun.engine.ts           # 세운 계산
│   │       └── timing-score.engine.ts   # 도화살/관성/재성 시기 분석
│   │
│   ├── friends/                      # 친구 초대 모듈
│   │   ├── friends.module.ts
│   │   ├── friends.controller.ts     # POST /friends/invite, GET /friends
│   │   ├── friends.service.ts
│   │   └── entities/
│   │       ├── friend-invite.entity.ts
│   │       └── friend-compatibility.entity.ts
│   │
│   ├── payment/                      # 결제 모듈
│   │   ├── payment.module.ts
│   │   ├── payment.controller.ts     # POST /payment/prepare, /confirm
│   │   ├── payment.service.ts
│   │   └── entities/
│   │       ├── payment.entity.ts
│   │       └── subscription.entity.ts
│   │
│   ├── notification/                 # 알림 모듈
│   │   ├── notification.module.ts
│   │   ├── notification.gateway.ts   # Socket.IO 게이트웨이
│   │   ├── notification.service.ts
│   │   └── fcm.service.ts            # Firebase 푸시
│   │
│   └── common/
│       ├── interceptors/
│       │   └── transform.interceptor.ts
│       ├── filters/
│       │   └── http-exception.filter.ts
│       └── dto/
│           └── pagination.dto.ts
│
├── ormconfig.ts                      # TypeORM CLI 설정
├── nest-cli.json
└── package.json
```

### 3.4 Saju Engine — `packages/saju-engine/`

```
packages/saju-engine/
├── src/
│   ├── index.ts                      # 모듈 exports
│   ├── types.ts                      # 사주 타입 정의
│   ├── constants.ts                  # 천간/지지/60간지 상수
│   ├── manseryeok.ts                 # 만세력 변환 (lunar-javascript)
│   ├── pillars.ts                    # 사주팔자 산출
│   ├── elements.ts                   # 오행 분석
│   ├── tenGods.ts                    # 십성 계산
│   ├── jigangjang.ts                 # 지장간 분석
│   ├── compatibility/
│   │   ├── general.ts                # 일반 궁합
│   │   ├── romantic.ts               # 연인 궁합
│   │   ├── deep.ts                   # 깊은 궁합
│   │   └── weighted.ts               # 가중 합산
│   ├── reverse-match.ts              # 역산출 v2 (전수 탐색)
│   ├── romance-timing.ts             # 연애 시기 분석
│   ├── daeun.ts                      # 대운 계산
│   ├── seun.ts                       # 세운 계산
│   ├── sinsal.ts                     # 신살 (도화살/홍염살/천을귀인 등)
│   └── report.ts                     # 리포트 텍스트 생성
├── package.json
└── tsconfig.json
```

---

## 4. DB 스키마 (TypeORM Entities)

### 4.1 User Entity

```typescript
// apps/api/src/users/entities/user.entity.ts

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  kakaoId: string;

  @Column()
  nickname: string;

  @Column({ type: 'enum', enum: ['male', 'female'] })
  gender: 'male' | 'female';

  @Column({ type: 'date' })
  birthDate: Date;

  @Column({ nullable: true })
  birthTime: string;           // "HH:MM" or null

  @Column({ default: 'solar' })
  birthCalendar: 'solar' | 'lunar';

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 25 })
  preferredAgeMin: number;

  @Column({ default: 35 })
  preferredAgeMax: number;

  @Column({ default: false })
  isOnboardingComplete: boolean;

  @Column({ default: false })
  isPremium: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  premiumExpiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => SajuProfile, (sp) => sp.user)
  sajuProfile: SajuProfile;

  @OneToOne(() => CompatibilityPreference, (cp) => cp.user)
  preferences: CompatibilityPreference;
}
```

### 4.2 SajuProfile Entity

```typescript
@Entity('saju_profiles')
export class SajuProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.sajuProfile)
  @JoinColumn()
  user: User;

  @Column() userId: string;

  // 사주팔자
  @Column() yearStem: string;
  @Column() yearBranch: string;
  @Column() monthStem: string;
  @Column() monthBranch: string;
  @Column() dayStem: string;
  @Column() dayBranch: string;
  @Column({ nullable: true }) hourStem: string;
  @Column({ nullable: true }) hourBranch: string;

  // 분석 캐시
  @Column({ nullable: true }) dominantElement: string;
  @Column({ nullable: true }) yongshin: string;
  @Column({ nullable: true }) gyeokguk: string;
  @Column({ type: 'jsonb', nullable: true }) elementScores: Record<string, number>;
  @Column({ type: 'jsonb', nullable: true }) tenGods: any;
  @Column({ type: 'jsonb', nullable: true }) reportData: any;
  @Column({ type: 'jsonb', nullable: true }) sinsalData: any;  // 도화살/홍염살 등

  @CreateDateColumn() createdAt: Date;
}
```

### 4.3 Match Entity

```typescript
@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User) @JoinColumn() userA: User;
  @Column() userAId: string;

  @ManyToOne(() => User) @JoinColumn() userB: User;
  @Column() userBId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  compatibilityScore: number;

  @Column({ type: 'jsonb', nullable: true })
  compatibilityReport: any;       // 3단계 궁합 상세

  @Column({ type: 'jsonb', nullable: true })
  romanceTimingReport: any;       // 연애 시기 분석

  @Column({
    type: 'enum',
    enum: ['pending', 'notified', 'a_accepted', 'b_accepted',
           'both_accepted', 'payment_pending', 'completed', 'rejected', 'expired'],
    default: 'pending'
  })
  status: string;

  @Column({ nullable: true }) userADecision: 'pending' | 'accepted' | 'rejected';
  @Column({ nullable: true }) userBDecision: 'pending' | 'accepted' | 'rejected';

  @Column({ type: 'timestamptz', nullable: true }) notifiedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) completedAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date;

  @CreateDateColumn() createdAt: Date;
}
```

### 4.4 FriendInvite & FriendCompatibility

```typescript
@Entity('friend_invites')
export class FriendInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User) @JoinColumn() inviter: User;
  @Column() inviterId: string;

  @Column({ unique: true }) inviteCode: string;

  @ManyToOne(() => User, { nullable: true }) @JoinColumn() invitee: User;
  @Column({ nullable: true }) inviteeId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'joined' | 'saju_complete' | 'calculated' | 'expired';

  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn() createdAt: Date;
}

@Entity('friend_compatibilities')
export class FriendCompatibility {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FriendInvite) @JoinColumn() invite: FriendInvite;
  @Column() inviteId: string;

  @Column() userAId: string;
  @Column() userBId: string;

  // 3단계 궁합
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) generalScore: number;
  @Column({ type: 'jsonb', nullable: true }) generalBreakdown: any;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) romanticScore: number;
  @Column({ type: 'jsonb', nullable: true }) romanticBreakdown: any;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) deepScore: number;
  @Column({ type: 'jsonb', nullable: true }) deepBreakdown: any;
  @Column({ type: 'jsonb', nullable: true }) deepNarrative: any;

  @CreateDateColumn() createdAt: Date;
}
```

### 4.5 Subscription & Payment

```typescript
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User) @JoinColumn() user: User;
  @Column() userId: string;

  @Column({ default: 'free' }) plan: 'free' | 'premium';
  @Column({ nullable: true }) billingKey: string;  // 토스 빌링키
  @Column({ nullable: true }) amount: number;
  @Column({ nullable: true }) billingCycle: 'monthly' | 'yearly';

  @Column({ type: 'timestamptz', nullable: true }) expiresAt: Date;
  @Column({ default: true }) isActive: boolean;

  @Column({ default: 1 }) idealSearchRemaining: number;
  @Column({ default: 0 }) reanalysisRemaining: number;

  @CreateDateColumn() createdAt: Date;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true }) matchId: string;
  @Column() userId: string;
  @Column() amount: number;
  @Column({ unique: true }) orderId: string;
  @Column({ nullable: true }) paymentKey: string;
  @Column({ default: 'ready' }) status: 'ready' | 'done' | 'canceled' | 'failed';

  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date;
  @CreateDateColumn() createdAt: Date;
}
```

---

## 5. API 엔드포인트 설계

### 인증

```
POST   /auth/kakao          카카오 OAuth 콜백 → JWT 발급
GET    /auth/me              현재 유저 정보
POST   /auth/refresh         토큰 갱신
```

### 유저

```
GET    /users/me             내 프로필
PATCH  /users/me             프로필 수정
PATCH  /users/me/preferences 궁합 선호도 & 나이 범위 수정
```

### 사주

```
POST   /saju/calculate       생년월일시 → 사주팔자 산출 & 저장
GET    /saju/report          내 사주 리포트
GET    /saju/sinsal           내 신살 정보 (도화살/홍염살 등)
```

### 궁합

```
POST   /compatibility/calculate     두 유저 간 궁합 계산 (3단계)
GET    /compatibility/:matchId      매칭 궁합 리포트 조회
```

### 매칭

```
POST   /matching/find-ideal         이상적 상대 사주 서치 (v2 전수 탐색)
GET    /matching                    내 매칭 리스트
GET    /matching/:id                매칭 상세
POST   /matching/:id/accept         매칭 수락
POST   /matching/:id/reject         매칭 거절
```

### 연애 시기

```
GET    /romance-timing/me           내 연애 시기 분석
GET    /romance-timing/match/:id    매칭 상대와의 최적 만남 시기
```

### 친구

```
POST   /friends/invite              초대 코드 생성
GET    /friends/invite/:code/verify 초대 코드 검증
GET    /friends                     친구 목록 + 궁합 점수
GET    /friends/:inviteId           친구 궁합 상세
```

### 결제

```
POST   /payment/prepare             결제 준비 (orderId 생성)
POST   /payment/confirm             결제 승인 (토스 paymentKey 확인)
POST   /payment/subscription        프리미엄 구독 시작
DELETE /payment/subscription        구독 해지
GET    /payment/subscription/status 구독 상태
```

### 알림 (Socket.IO)

```
EVENT  match:new                    새 매칭 발견 알림
EVENT  match:accepted               상대 수락 알림
EVENT  match:completed              매칭 성사 알림
EVENT  friend:joined                초대 친구 가입 알림
EVENT  friend:compatibility         친구 궁합 결과 알림
```

---

## 6. 카카오 OAuth 플로우 (NestJS)

```
[프론트]                          [NestJS]                    [카카오]
   │                                 │                           │
   ├─ 카카오 로그인 버튼 클릭 ──→    │                           │
   │  window.location =              │                           │
   │  kakao auth URL                 │                           │
   │                                 │                           │
   │  ←── 카카오 인증 후 ──────────────────── 인가코드 리턴 ──→  │
   │  /auth/callback?code=xxx        │                           │
   │                                 │                           │
   ├─ POST /auth/kakao ────────→     │                           │
   │  { code: "xxx" }               │── 인가코드로 토큰 요청 ──→ │
   │                                 │                           │
   │                                 │←── access_token 리턴 ──── │
   │                                 │                           │
   │                                 │── 유저 정보 조회 ────────→ │
   │                                 │←── 닉네임/이메일/생일 ──── │
   │                                 │                           │
   │                                 │── DB에 유저 생성/조회      │
   │                                 │── JWT 토큰 생성            │
   │                                 │                           │
   │  ←── { accessToken, user } ──── │                           │
   │                                 │                           │
   │  localStorage에 JWT 저장        │                           │
   │  이후 모든 API 요청에            │                           │
   │  Authorization: Bearer xxx      │                           │
```

---

## 7. 개발 페이즈

### Phase 1 — MVP (3주)

```
Week 1: 기반 설정
□ 모노레포 구조 셋업 (apps/web + apps/api + packages/saju-engine)
□ NestJS 프로젝트 초기화 (TypeORM + PostgreSQL 연결)
□ Next.js 프로젝트 초기화 (Tailwind + shadcn/ui)
□ 카카오 OAuth 구현 (NestJS Passport + JWT)
□ User, SajuProfile 엔티티 + 마이그레이션
□ 랜딩 페이지

Week 2: 사주 엔진 + 온보딩
□ saju-engine 패키지: manseryeok, pillars, elements, tenGods
□ saju-engine: compatibility (general, romantic, deep), jigangjang
□ saju-engine: reverse-match v2 (전수 탐색)
□ saju-engine: sinsal (도화살, 홍염살, 천을귀인)
□ NestJS: /saju, /compatibility API
□ 프론트: 온보딩 4단계 (사주입력→리포트→선호도→이상적상대)

Week 3: 매칭 + 메인 UI
□ saju-engine: romance-timing (대운, 세운, 연애시기)
□ NestJS: /matching, /romance-timing API
□ NestJS: Socket.IO 게이트웨이 (매칭 알림)
□ NestJS: Bull 큐 (신규가입 시 매칭 탐색 비동기)
□ Match 엔티티 + 매칭 수락/거절 플로우
□ 프론트: 홈, 매칭 리스트, 매칭 상세 (궁합 리포트 + 연애 시기)
□ 프론트: 하단 탭바, 전체 네비게이션
```

### Phase 2 — 친구 + 결제 + 프리미엄 (2주)

```
Week 4: 친구 & 프리미엄
□ FriendInvite, FriendCompatibility 엔티티
□ NestJS: /friends API (초대, 궁합 계산, 목록)
□ 카카오링크 공유 연동
□ 프론트: 친구 탭 (초대, 목록, 3단계 궁합 카드)
□ 게스트 모드 (초대 랜딩)
□ Subscription, Payment 엔티티
□ NestJS: Premium Guard (프리미엄 체크)

Week 5: 결제 + PWA
□ 토스페이먼츠 결제 연동 (단건 + 정기결제)
□ 프리미엄 잠금 UI (연인궁합/깊은궁합 블러)
□ PWA 설정 (manifest, service worker, 아이콘)
□ FCM 푸시 알림 연동
□ 전체 E2E 테스트
```

### Phase 3 — 확장 (이후)

```
□ 오프라인 소개팅 이벤트
□ 대운/세운 기반 "올해의 인연" 정기 알림
□ ML 보정 모델 (후기 데이터 학습)
□ React Native 네이티브 앱 전환
□ 일본/대만 현지화
```

---

## 8. 환경변수

### `apps/api/.env`

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=yeon

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# 카카오 OAuth
KAKAO_CLIENT_ID=your_kakao_rest_api_key
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_CALLBACK_URL=http://localhost:4000/auth/kakao/callback

# 토스페이먼츠
TOSS_CLIENT_KEY=test_ck_...
TOSS_SECRET_KEY=test_sk_...

# Firebase (푸시)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### `apps/web/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_KAKAO_JS_KEY=your_kakao_javascript_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_...
```

---

## 9. 디자인 토큰

```css
:root {
  --brand-gold: #c9a84c;
  --brand-gold-light: #e8d5a0;
  --brand-red: #8b2f3a;
  --brand-rose: #c4757e;
  --brand-purple: #8b6cc9;

  --bg-primary: #f7f2eb;
  --bg-dark: #0d0a0e;

  --text-primary: #1a1216;
  --text-secondary: #5a4e44;
  --text-muted: #a89e91;

  --element-wood: #4a7c59;
  --element-fire: #c4493c;
  --element-earth: #c9a84c;
  --element-metal: #8a8a8a;
  --element-water: #2d5f8a;

  --font-serif: 'Noto Serif KR', serif;
  --font-sans: 'Noto Sans KR', sans-serif;
}
```

---

## 10. 실행 명령어

### 로컬 개발

```bash
# PostgreSQL & Redis (Docker)
docker-compose up -d

# Backend (NestJS)
cd apps/api
npm install
npm run migration:run
npm run start:dev          # → http://localhost:4000

# Frontend (Next.js)
cd apps/web
npm install
npm run dev                # → http://localhost:3000

# Saju Engine (빌드)
cd packages/saju-engine
npm install
npm run build
```

### Docker Compose (로컬 DB)

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: yeon
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - '6379:6379'

volumes:
  pgdata:
```

---

## 11. Cursor 실행 가이드

### 프로젝트 시작

```
이 프로젝트는 CLAUDE_CODE_DEV_PLAN.md (v2, NestJS 기반)을 따릅니다.
모노레포 구조: apps/web (Next.js), apps/api (NestJS), packages/saju-engine

Phase 1 Week 1을 시작합니다.

1. 모노레포 구조를 셋업해줘 (npm workspaces)
2. apps/api에 NestJS 프로젝트를 생성하고 TypeORM + PostgreSQL 연결
3. apps/web에 Next.js 프로젝트를 생성하고 Tailwind + shadcn/ui 설정
4. docker-compose.yml로 로컬 PostgreSQL + Redis 셋업
5. User 엔티티와 첫 번째 마이그레이션을 만들어줘
```

### 사주 엔진 구현

```
packages/saju-engine을 구현해줘.
FEATURE_REVERSE_MATCH_V2.md와 FEATURE_FRIENDS_PREMIUM.md를 참고해서:
- lunar-javascript 기반 만세력 변환
- 사주팔자 산출
- 3단계 궁합 (일반/연인/깊은)
- 지장간 분석
- 역산출 v2 (전수 탐색)
- 연애 시기 분석 (대운/세운/도화살)
- 신살 판별 (도화살/홍염살/천을귀인)
```

### 카카오 OAuth 구현

```
apps/api의 auth 모듈을 구현해줘.
NestJS Passport + 카카오 Strategy + JWT 발급.
프론트에서는 카카오 JS SDK로 인가코드를 받아서
POST /auth/kakao로 보내는 플로우.
놀이터 체크인 앱과 동일한 패턴이야.
```