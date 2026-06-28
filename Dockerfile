FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY data ./data
EXPOSE 4317
CMD ["node", "src/server.ts"]
