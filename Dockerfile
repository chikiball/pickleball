FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /data
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
ENV NODE_ENV=production
ENV DB_PATH=/data/pickleball.db
CMD ["node", "server.js"]
