FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
EXPOSE 4100
ENV NODE_ENV=production
CMD ["node", "src/server.js"]
