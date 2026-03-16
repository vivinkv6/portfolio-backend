# -----------------------------
# Stage 1 — Install dependencies
# -----------------------------
FROM node:22-alpine AS deps

WORKDIR /opt

RUN apk add --no-cache \
    build-base \
    python3 \
    pkgconfig \
    vips-dev \
    zlib-dev \
    libpng-dev

COPY package.json package-lock.json ./

RUN npm ci --omit=dev && npm cache clean --force


# -----------------------------
# Stage 2 — Build Strapi
# -----------------------------
FROM node:22-alpine AS build

WORKDIR /opt/app

COPY --from=deps /opt/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npm run build


# -----------------------------
# Stage 3 — Production Runtime
# -----------------------------
FROM node:22-alpine AS runner

WORKDIR /opt/app

RUN apk add --no-cache vips

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

COPY --from=build /opt/app/package.json ./
COPY --from=build /opt/app/node_modules ./node_modules
COPY --from=build /opt/app/dist ./dist
COPY --from=build /opt/app/public ./public
COPY --from=build /opt/app/config ./config
COPY --from=build /opt/app/database ./database

ENV PATH="/opt/app/node_modules/.bin:$PATH"

RUN addgroup -S strapi && adduser -S strapi -G strapi \
    && chown -R strapi:strapi /opt/app

USER strapi

EXPOSE 1337

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:1337/_health || exit 1

CMD ["npm", "start"]
 