# syntax=docker/dockerfile:1.7
# 빌드 컨텍스트는 monorepo 루트 (docker build -f apps/api/Dockerfile .)

# ──────────────────────────────────────────────────────────────
# Stage 1: deps — npm ci로 모든 의존성 설치 (saju-engine 포함)
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/saju-engine/package.json packages/saju-engine/package.json

RUN npm ci

# ──────────────────────────────────────────────────────────────
# Stage 2: builder — saju-engine + api 빌드
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/apps/api/package.json ./apps/api/
COPY --from=deps /app/packages/saju-engine/package.json ./packages/saju-engine/

COPY packages/saju-engine ./packages/saju-engine
COPY apps/api ./apps/api

RUN npm run build --workspace=packages/saju-engine \
 && npm run build --workspace=apps/api

# ──────────────────────────────────────────────────────────────
# Stage 3: runner — 프로덕션 의존성 + dist만
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/saju-engine/package.json ./packages/saju-engine/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/saju-engine/dist ./packages/saju-engine/dist

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
