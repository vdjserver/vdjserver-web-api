# Base Image
FROM debian:jessie

MAINTAINER Walter Scarborough <wscarbor@tacc.utexas.edu>

# Install OS Dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    nodejs-legacy \
    npm \
    supervisor \
    vim \
    wget

RUN npm install -g \
    forever

RUN mkdir /vdjserver-web-api

# Setup redis
ENV REDIS_VERSION=3.0.3
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

CMD /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
