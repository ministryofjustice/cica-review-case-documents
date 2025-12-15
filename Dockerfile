FROM node:25.2.1-bookworm-slim

RUN groupadd -g 1014 dc_user && useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user

USER dc_user

WORKDIR /usr/src/app

COPY package*.json ./

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

COPY . .

RUN npm ci

USER 1015

CMD [ "npm", "start" ]
