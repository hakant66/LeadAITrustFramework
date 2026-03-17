FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/mcp/package.json ./
RUN corepack enable && pnpm install

FROM node:20-alpine AS build
WORKDIR /app
COPY apps/mcp/ ./
COPY --from=deps /app/node_modules ./node_modules
RUN corepack enable && pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 8787
CMD ["node", "dist/server.js"]
