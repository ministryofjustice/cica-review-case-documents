FROM node:22.8.0-bookworm-slim AS base

WORKDIR /app

# COPY ./src .

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

EXPOSE 5000

ARG NODE_ENV=production
# Default to production. npm will ignore devDependencies in production mode
FROM base AS production

ENV NODE_ENV=production
# RUN npm install --production

# RUN npm install
# If you are building your code for production
# RUN npm ci
RUN npm ci --omit=dev
# Bundle app source
COPY . .

# the command line to run when the container is started
CMD [ "npm", "start" ]


# Dev build runs npm ci without the --production flag
# and runs the start:dev script
FROM base AS dev

ENV NODE_ENV=development

# RUN npm install
# If you are building your code for production
#USER root
RUN npm ci

# Bundle app source
COPY . .

# the command line to run when the container is started
CMD [ "npm", "start" ]
