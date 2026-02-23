FROM node:20-alpine AS builder
WORKDIR /app

COPY tsconfig.base.json .
COPY packages/signalling-server/package.json packages/signalling-server/
COPY packages/signalling-server/tsconfig.json packages/signalling-server/
COPY packages/signalling-server/src packages/signalling-server/src

WORKDIR /app/packages/signalling-server
RUN npm install
RUN npx tsup src/index.ts --format cjs --clean

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/packages/signalling-server/package.json .
COPY --from=builder /app/packages/signalling-server/dist ./dist

RUN npm install --omit=dev

EXPOSE 8080
CMD ["node", "dist/index.js"]
