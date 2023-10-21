FROM node:18 as base

# Create app directory
WORKDIR /app

COPY package*.json ./

RUN npm i
RUN npm i pm2 -g
RUN pm2 update

FROM base as production

COPY . .

EXPOSE 80

CMD ["pm2-runtime", "./src/server/server.js"]