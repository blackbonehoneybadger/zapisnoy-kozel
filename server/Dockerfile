# Онлайн-сервер DOFFA Games (Crazy 8 — скрытый режим внутри платформы).
# Контекст сборки — КОРЕНЬ репозитория (серверу нужен движок Crazy 8
# из src/games/crazy8/engine):
#   docker build -f server/Dockerfile -t doffa-games-server .
#   docker run -p 8080:8080 -e AUTH_SECRET=задайте-секрет doffa-games-server
FROM node:22-alpine
WORKDIR /app

# Игровой движок Crazy 8 (используется и клиентом, и сервером — авторитетная
# онлайн-игра переигрывает те же ходы тем же кодом, что и офлайн-режим).
COPY src/games/crazy8/engine ./src/games/crazy8/engine

# Зависимости сервера.
COPY server/package*.json ./server/
RUN cd server && npm install --no-audit --no-fund

# Исходники сервера.
COPY server ./server

WORKDIR /app/server
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
