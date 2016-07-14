# Base Image
FROM debian:jessie

MAINTAINER Walter Scarborough <wscarbor@tacc.utexas.edu>

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update && apt-get install -y \
    make \
    sendmail-bin \
    supervisor \
    wget \
    xz-utils

ENV NODE_VERSION=4.4.7
RUN cd /root \
    && wget https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz \
    && ls \
    && tar -xf node-v$NODE_VERSION-linux-x64.tar.xz \
    && cp node-v$NODE_VERSION-linux-x64/bin/node /usr/local/bin \
    && cp -R node-v$NODE_VERSION-linux-x64/lib/node_modules /usr/local/lib \
    && ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && rm -R /root/node-v$NODE_VERSION-linux-x64

# Setup postfix
# The postfix install won't respect noninteractivity unless this config is set beforehand.
RUN mkdir /etc/postfix
RUN touch /etc/mailname
COPY docker/postfix/main.cf /etc/postfix/main.cf
COPY docker/scripts/postfix-config-replace.sh /root/postfix-config-replace.sh

# Debian vociferously complains if you try to install postfix and sendmail at the same time.
RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y -q --force-yes \
    postfix

RUN mkdir /vdjserver-web-api

# Setup redis
ENV REDIS_VERSION=3.2.1
RUN apt-get install -y gcc \
    && cd /root \
    && wget http://download.redis.io/releases/redis-$REDIS_VERSION.tar.gz \
    && tar xvzf redis-$REDIS_VERSION.tar.gz \
    && cd redis-$REDIS_VERSION \
    && make \
    && cp src/redis-server /usr/local/bin \
    && cp src/redis-cli /usr/local/bin \
    && rm -R /root/redis-$REDIS_VERSION \
    && apt-get autoremove -y gcc

COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-web-api/
RUN cd /vdjserver-web-api && npm install

# Copy project source
COPY . /vdjserver-web-api

CMD ["/root/postfix-config-replace.sh"]
