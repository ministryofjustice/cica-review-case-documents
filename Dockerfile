# If making any changes to this file, please ensure you test building and running 
# kube deployment local
# see deployment/local/README.md for instructions

# --- Stage 1: builder ---
FROM node:26.4.0-trixie-slim@sha256:a1d9d671994fc2d26e297ac56b4b1522a8bc7fa71c43b14cd1b1fe6c5116f7dc AS builder

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run sass && npm run build
RUN npm prune --omit=dev

# --- Stage 2: runtime ---
FROM node:26.4.0-trixie-slim@sha256:a1d9d671994fc2d26e297ac56b4b1522a8bc7fa71c43b14cd1b1fe6c5116f7dc

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app .

RUN rm -rf /usr/local/lib/node_modules/npm && \
	rm -f /usr/local/bin/npm /usr/local/bin/npx

RUN groupadd -g 1014 dc_user && useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user
RUN chown -R dc_user:dc_user /usr/src/app

USER 1015

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Use node directly instead of npm start to reduce runtime attack surface 
# and avoid npm lifecycle-script execution path in production containers.
CMD ["node", "./bin/www"]
