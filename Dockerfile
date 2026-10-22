FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3001 DATABASE_PATH=/app/.data/scopebook.sqlite
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && mkdir -p /app/.data && chown node:node /app/.data
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
USER node
EXPOSE 3001
VOLUME ["/app/.data"]
CMD ["node", "dist-server/index.js"]
