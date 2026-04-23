# If making any changes to this file, please ensure you test building and running 
# kube deployment local
# see deployment/local/README.md for instructions
FROM node:24-trixie-slim

# Security: Update base image packages
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Security: Upgrade npm to get patched brace-expansion (>=5.0.5) and picomatch (>=4.0.4)
# npm@11.13.0 ships minimatch@^10.2.5 -> brace-expansion@^5.0.5 (fixes SNYK-JS-BRACEEXPANSION-15789759)
# and node-gyp with tinyglobby -> picomatch@^4.0.4 (fixes SNYK-JS-PICOMATCH-15765511/15765513)
RUN npm install -g npm@11.13.0 --ignore-scripts


WORKDIR /usr/src/app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts

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
