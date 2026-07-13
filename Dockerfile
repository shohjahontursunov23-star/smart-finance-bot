FROM node:20-alpine

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# better-sqlite3 native modulni standalone ga nusxalash
RUN cp -r node_modules/better-sqlite3 .next/standalone/node_modules/better-sqlite3
RUN cp -r .next/static .next/standalone/.next/
RUN cp -r public .next/standalone/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]