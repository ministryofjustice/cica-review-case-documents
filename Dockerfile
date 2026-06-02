# If making any changes to this file, please ensure you test building and running 
# kube deployment local
# see deployment/local/README.md for instructions
FROM node:26.3.0-trixie-slim@sha256:aa27a5fbf5acb298116a38133794f080406c6f8dfe52e2e2836bb55dc7cae8f0

WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts && \
	rm -rf /usr/local/lib/node_modules/npm && \
	rm -f /usr/local/bin/npm /usr/local/bin/npx

COPY . .

RUN groupadd -g 1014 dc_user && useradd -rm -d /usr/src/app -u 1015 -g dc_user dc_user
RUN chown -R dc_user:dc_user /usr/src/app

USER 1015

EXPOSE 5000

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Use node directly instead of npm start to reduce runtime attack surface 
# and avoid npm lifecycle-script execution path in production containers.
CMD ["node", "./bin/www"]
