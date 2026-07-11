# Онлайн-сервер «Записной Козёл».
# Контекст сборки — КОРЕНЬ репозитория (серверу нужен общий движок src/game):
#   docker build -f server/Dockerfile -t kozel-server .
#   docker run -p 8080:8080 -e AUTH_SECRET=задайте-секрет kozel-server
FROM node:22-alpine
WORKDIR /app

# Общий игровой движок (используется и клиентом, и сервером).
COPY src/game ./src/game

# Зависимости сервера.
COPY server/package*.json ./server/
RUN cd server && npm install --no-audit --no-fund

# Исходники сервера.
COPY server ./server

WORKDIR /app/server
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
