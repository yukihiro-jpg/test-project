# syntax=docker/dockerfile:1

# ------------- 依存パッケージインストール用ステージ -------------
FROM node:20-slim AS deps
WORKDIR /app

# sharp などのネイティブモジュールに必要なパッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

# ------------- ビルド用ステージ -------------
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 本番ビルド（standalone出力を使う）
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ------------- 実行ステージ -------------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# sharpの実行に必要な共有ライブラリ
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
  && rm -rf /var/lib/apt/lists/*

# 非rootユーザーで実行
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 nextjs

# standalone出力からファイルをコピー
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
