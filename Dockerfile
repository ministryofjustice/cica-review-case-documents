# If making any changes to this file, please ensure you test building and running 
# kube deployment local
# see deployment/local/README.md for instructions
FROM node:24-trixie-slim

# Security: Update base image packages
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

COPY . .

RUN groupadd -g 1014 dc_user && useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user
RUN chown -R dc_user:dc_user /usr/src/app

USER 1015

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

CMD ["npm", "start"]
