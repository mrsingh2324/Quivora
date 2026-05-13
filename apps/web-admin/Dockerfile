FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm ci

# Build-time env vars are baked into the JS bundle by Vite
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_PLAYER_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_PLAYER_URL=$VITE_PLAYER_URL

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
