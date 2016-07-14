# Base Image
FROM ubuntu:16.04

MAINTAINER Walter Scarborough <wscarbor@tacc.utexas.edu>

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update && apt-get install -y \
    make \
    nodejs \
    nodejs-legacy \
    npm \
    redis-server \
    redis-tools \
    sendmail-bin \
    supervisor \
    wget \
    xz-utils

# Setup postfix
# The postfix install won't respect noninteractivity unless this config is set beforehand.
RUN mkdir /etc/postfix
RUN touch /etc/mailname
COPY docker/postfix/main.cf /etc/postfix/main.cf
COPY docker/scripts/postfix-config-replace.sh /root/postfix-config-replace.sh

# Debian vociferously complains if you try to install postfix and sendmail at the same time.
RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y -q --force-yes \
    postfix

##################
##################

RUN mkdir /vdjserver-web-api

# Setup redis
COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-web-api/
RUN cd /vdjserver-web-api && npm install

# Copy project source
COPY . /vdjserver-web-api

CMD ["/root/postfix-config-replace.sh"]
