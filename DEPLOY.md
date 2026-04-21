# 緣 — 배포 체크리스트

## 아키텍처 개요

```
[사용자]
    │
    ├── https://yeon.app ─────────► Vercel (apps/web, static export)
    │                                 │
    │                                 ▼
    └── https://api.yeon.app ───────► AWS Lightsail + Nginx
                                        │
                                        ├── Docker: NestJS (:4000)
                                        └── PostgreSQL (:5432, localhost)
```

- **Frontend**: Next.js 16 static export → Vercel
- **Backend**: NestJS + TypeORM → Lightsail 인스턴스에서 Docker로 구동
- **DB**: Lightsail 인스턴스 로컬 PostgreSQL (MVP) / 필요 시 Lightsail Managed DB로 분리
- **Realtime**: Socket.IO (백엔드 포트 4000)

---

## Step 1 · AWS Lightsail 인스턴스

1. Lightsail 콘솔 → **Create instance**
   - OS: Ubuntu 22.04 LTS
   - Plan: $10/mo (2GB RAM 이상 권장 — TypeORM + find-ideal 전수 탐색용)
   - Name: `yeon-api`
2. **Networking** 탭 → **Create static IP** 후 인스턴스에 attach
3. **Firewall** → 다음 포트 오픈:
   - 22 (SSH, 기본)
   - 80 (HTTP)
   - 443 (HTTPS)
   - ※ 4000은 **열지 말 것** (Nginx 뒤에만 둠)
4. SSH 키 다운로드, `~/.ssh/lightsail-yeon.pem` 권한 600으로 저장

```bash
chmod 600 ~/.ssh/lightsail-yeon.pem
ssh -i ~/.ssh/lightsail-yeon.pem ubuntu@<static-ip>
```

---

## Step 2 · 인스턴스 초기 셋업

```bash
# 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# Docker + Docker Compose
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
# 재로그인 필수 (그래야 docker 명령 sudo 없이 실행 가능)
exit
ssh -i ~/.ssh/lightsail-yeon.pem ubuntu@<static-ip>

# PostgreSQL 15 설치
sudo apt install -y postgresql-15 postgresql-client-15

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## Step 3 · PostgreSQL 세팅

```bash
sudo -u postgres psql <<EOF
CREATE DATABASE yeon;
CREATE USER yeon WITH PASSWORD '<강력한_비밀번호>';
GRANT ALL PRIVILEGES ON DATABASE yeon TO yeon;
\c yeon
GRANT ALL ON SCHEMA public TO yeon;
EOF
```

`/etc/postgresql/15/main/postgresql.conf`:
- `listen_addresses = 'localhost'` (외부 노출 금지)

```bash
sudo systemctl enable postgresql
sudo systemctl restart postgresql
```

---

## Step 4 · 코드 배포 + Docker 실행

```bash
cd ~
git clone <repo-url> yeon
cd yeon

# apps/api/.env 작성
cat > apps/api/.env <<EOF
DB_HOST=host.docker.internal
DB_PORT=5432
DB_USERNAME=yeon
DB_PASSWORD=<Step3의 비밀번호>
DB_DATABASE=yeon

JWT_SECRET=<openssl rand -hex 32 로 생성>
JWT_EXPIRES_IN=7d

KAKAO_CLIENT_ID=<카카오 REST API 키>
KAKAO_CLIENT_SECRET=
KAKAO_CALLBACK_URL=https://api.yeon.app/auth/kakao/callback

TOSS_SECRET_KEY=<토스 시크릿 키 — live_sk_ 또는 test_sk_>

FRONTEND_URL=https://yeon.app
CORS_ORIGINS=https://yeon.app,https://www.yeon.app
EOF

# 이미지 빌드 (컨텍스트는 레포 루트)
docker build -f apps/api/Dockerfile -t yeon-api:latest .

# 컨테이너 실행 (host 네트워크로 Postgres 접근)
docker run -d \
  --name yeon-api \
  --restart unless-stopped \
  --network host \
  --env-file apps/api/.env \
  yeon-api:latest
```

> `--network host`를 쓰면 `DB_HOST=localhost`로 변경해도 됩니다.
> bridge 네트워크를 쓰면 `host.docker.internal` 대신 호스트 IP 명시 필요.

동작 확인:
```bash
curl http://localhost:4000/saju/calculate -X POST \
  -H "Content-Type: application/json" \
  -d '{"year":1995,"month":3,"day":15}'
```

---

## Step 5 · Nginx 리버스 프록시 + HTTPS

`/etc/nginx/sites-available/yeon-api`:

```nginx
server {
    listen 80;
    server_name api.yeon.app;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;

        # Socket.IO WebSocket 업그레이드
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 이상형 전수 탐색이 5~10초 걸릴 수 있음
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/yeon-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Let's Encrypt 인증서
sudo certbot --nginx -d api.yeon.app
```

자동 갱신:
```bash
sudo systemctl enable certbot.timer
```

---

## Step 6 · Vercel (frontend)

1. Vercel 대시보드 → **Add New Project** → GitHub 연동
2. 프로젝트 설정:
   - **Root Directory**: `apps/web`
   - **Framework**: Next.js (자동 감지)
   - Build 설정은 `vercel.json`이 처리
3. **Environment Variables** (Production):
   ```
   NEXT_PUBLIC_API_URL=https://api.yeon.app
   NEXT_PUBLIC_KAKAO_CLIENT_ID=<카카오 JavaScript 키>
   NEXT_PUBLIC_TOSS_CLIENT_KEY=<토스 클라이언트 키 — live_ck_ 또는 test_ck_>
   NEXT_PUBLIC_APP_URL=https://yeon.app
   ```
4. **Domains** → `yeon.app` 연결 (DNS A 레코드 Vercel 값으로)

---

## Step 7 · Kakao OAuth 콘솔 업데이트

Kakao Developers → 내 애플리케이션 → 플랫폼:
- **Web**: `https://yeon.app`
- **카카오 로그인 Redirect URI**: `https://api.yeon.app/auth/kakao/callback`
- **동의항목**: 닉네임, 성별 (생일은 선택)

---

## Step 8 · 토스페이먼츠

developers.tosspayments.com → 내 개발정보:
- 테스트 환경: `test_ck_...` / `test_sk_...` — 별도 계정 없이 카드 결제 시뮬 가능
- 운영 환경: 사업자 등록 후 `live_ck_...` / `live_sk_...` 발급
- **successUrl/failUrl**: 우리 프론트는 `https://yeon.app/payment/{success,fail}` — 토스 콘솔에서 화이트리스트 등록

---

## Step 9 · DNS

도메인 등록업체에서:
- `yeon.app` A 레코드 → Vercel의 A 값 (`76.76.21.21` 등 Vercel이 안내)
- `api.yeon.app` A 레코드 → Lightsail static IP

---

## 배포 워크플로우

### 프론트
- `main` 브랜치 push → Vercel이 자동 빌드+배포
- 프리뷰: 다른 브랜치 push → Vercel이 자동으로 `<branch>-yeon.vercel.app` 배포

### 백엔드
수동 배포 (MVP):
```bash
ssh -i ~/.ssh/lightsail-yeon.pem ubuntu@<static-ip>
cd ~/yeon
git pull
docker build -f apps/api/Dockerfile -t yeon-api:latest .
docker stop yeon-api && docker rm yeon-api
docker run -d --name yeon-api --restart unless-stopped --network host \
  --env-file apps/api/.env yeon-api:latest
docker logs -f yeon-api  # 정상 부팅 확인 후 Ctrl+C
```

자동화하려면 GitHub Actions로 SSH deploy 하면 됨 (추후).

---

## 배포 후 체크리스트

- [ ] `https://yeon.app` 접속 → 랜딩 페이지
- [ ] `/login` → 카카오 로그인 → `/saju-input` 이동
- [ ] 사주 입력 → 리포트 생성
- [ ] 선호도 → `/ideal-match` 결과 표시
- [ ] `/home`, `/matches`, `/my-saju`, `/profile` 정상 렌더
- [ ] Socket.IO 연결 (DevTools Network → WS 확인)
- [ ] `/premium` → 구독 선택 → 토스 결제창 뜸
- [ ] Service Worker 등록 (DevTools Application → Service Workers)
- [ ] PWA 설치 프롬프트 (모바일 Safari/Chrome)
- [ ] `https://api.yeon.app/saju/calculate` POST → 200

---

## 운영 중 알아둘 것

### 로그
```bash
docker logs -f --tail=200 yeon-api
sudo tail -f /var/log/nginx/access.log
sudo journalctl -u nginx -f
```

### DB 백업 (권장: 일 1회 cron)
```bash
pg_dump -U yeon yeon > backup-$(date +%F).sql
```

### 리소스 모니터링
Lightsail 대시보드 → 인스턴스 → Metrics (CPU, RAM, 네트워크)

### TypeORM synchronize 주의
`database.config.ts`의 `synchronize: true`는 **개발용**. 프로덕션에선 스키마 변경이 자동 반영되므로 데이터 손실 위험.
- MVP: 그대로 둬도 됨 (엔티티 추가는 대부분 안전)
- 안정기 진입 시 migrations로 전환 필요

### 환경 변수 변경 시
```bash
docker stop yeon-api && docker rm yeon-api
# .env 수정
docker run ... (위와 동일)
```

---

## 아직 배포에 포함 안 된 것

- **Redis** (Bull 큐용) — 동기 구현 유지 중이라 불필요. 부하 증가 시 Lightsail Managed Redis 추가.
- **FCM 푸시** — `sw.js`에 push 핸들러는 있지만 Firebase 프로젝트 연결 전. 배포 후 작업.
- **CI/CD** — 지금은 수동 배포. GitHub Actions로 `docker build + ssh deploy` 자동화가 다음 개선.
- **CDN/이미지 최적화** — 아이콘이 svg라 현재는 불필요.
- **모니터링/Sentry** — 에러 추적은 추후.
