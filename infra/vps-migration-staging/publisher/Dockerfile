FROM node:20-alpine

# Güvenli PID 1 sinyal yönetimi için dumb-init ekle
RUN apk add --no-cache dumb-init

WORKDIR /app

# Bağımlılıkları yükle
COPY package*.json ./
RUN npm install --omit=dev

# Uygulama kodlarını node kullanıcısı sahipliğinde kopyala
COPY --chown=node:node . .

# Güvenlik kuralı: Root yerine standart 'node' kullanıcısı ile çalış
USER node

ENV NODE_ENV=production
ENV TZ=Europe/Istanbul

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
