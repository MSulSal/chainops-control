FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 4317
CMD ["node", "src/server.ts"]
