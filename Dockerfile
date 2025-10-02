FROM node:22.8.0-bookworm-slim

WORKDIR /usr/src/app

COPY package*.json ./

EXPOSE 5000

ARG NODE_ENV=production

RUN npm ci --omit=dev

COPY . .

USER 1015

CMD [ "npm", "start" ]
