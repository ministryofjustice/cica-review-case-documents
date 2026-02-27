# If making any changes to this file, please ensure you test building and running
# kube deployment local
# see deployment/local/README.md for instructions
FROM node:24-trixie-slim AS builder

WORKDIR /usr/src/app

# Security: Update base image packages
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

# Upgrade npm to the latest version to avoid internal npm errors
RUN npm install -g npm@latest

RUN npm ci

COPY . .

RUN npm run sass

FROM node:24-trixie-slim

WORKDIR /usr/src/app

# Security: update base image packages
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm install -g npm@latest

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy built app (including compiled CSS) from builder
COPY --from=builder /usr/src/app ./

# Create non-root user
RUN groupadd -g 1014 dc_user && \
    useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user && \
    chown -R dc_user:dc_user /usr/src/app

USER 1015

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

CMD ["npm", "start"]
