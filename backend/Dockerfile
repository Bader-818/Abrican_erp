# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
# Prisma's musl engine binaries are linked against OpenSSL 3 (libssl.so.3),
# which Alpine's nodejs base image does not pull in by default.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

# ---------------------------------------------------------------------------
# development: used by docker-compose for local dev (hot reload via volumes)
# ---------------------------------------------------------------------------
FROM base AS development
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]

# ---------------------------------------------------------------------------
# build: compiles the Nest app + the seed script for production
# ---------------------------------------------------------------------------
FROM base AS build
RUN npm install
COPY . .
# Compile the app, and separately compile the TS seed to plain JS so the
# production image can seed without ts-node (a dev dependency).
RUN npx prisma generate \
  && npm run build \
  && npx tsc prisma/seed.ts --outDir dist-seed --module commonjs \
       --esModuleInterop --resolveJsonModule --skipLibCheck --target ES2021

# ---------------------------------------------------------------------------
# production: minimal runtime image
# ---------------------------------------------------------------------------
FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-seed ./dist-seed
COPY docker-entrypoint.sh ./
EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
