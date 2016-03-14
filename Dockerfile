# Base Image
FROM debian:jessie

MAINTAINER Walter Scarborough <wscarbor@tacc.utexas.edu>

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update && apt-get install -y \
    nodejs \
    nodejs-legacy \
    npm \
    sendmail-bin \
    supervisor \
    vim \
    wget

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
ENV REDIS_VERSION=3.0.7
RUN cd /root \
    && wget http://download.redis.io/releases/redis-$REDIS_VERSION.tar.gz \
    && tar xvzf redis-$REDIS_VERSION.tar.gz \
    && cd redis-$REDIS_VERSION \
    && make \
    && cp src/redis-server /usr/local/bin \
    && cp src/redis-cli /usr/local/bin

COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-web-api/
RUN cd /vdjserver-web-api && npm install

# Copy project source
COPY . /vdjserver-web-api

CMD ["/root/postfix-config-replace.sh"]
