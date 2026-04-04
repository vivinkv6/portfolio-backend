# Creating multi-stage build for production
FROM node:22-bookworm-slim AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential python3 pkg-config libvips-dev git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /opt/
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm install -g node-gyp \
    && npm config set fetch-retry-maxtimeout 600000 -g \
    && npm config set fetch-retries 5 -g \
    && npm config set fetch-retry-mintimeout 20000 -g \
    && npm ci --only=production

ENV PATH=/opt/node_modules/.bin:$PATH
WORKDIR /opt/app
COPY . .
RUN npm run build

# Creating final production image
FROM node:22-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends libvips-dev wget ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
WORKDIR /opt/
COPY --from=build /opt/node_modules ./node_modules
WORKDIR /opt/app
COPY --from=build /opt/app ./
ENV PATH=/opt/node_modules/.bin:$PATH

RUN chown -R node:node /opt/app
USER node
EXPOSE 1337
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:1337/_health || exit 1
CMD ["npm", "run", "start"]
