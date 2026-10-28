FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY bot-engine.js ./
COPY server.js ./
ENV PORT=8081
EXPOSE 8081
CMD ["node", "server.js"]
