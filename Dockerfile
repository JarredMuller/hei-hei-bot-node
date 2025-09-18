FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NODE_OPTIONS=--enable-source-maps
ENV TZ=UTC

# Install deps
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

CMD ["node", "src/index.js"]
