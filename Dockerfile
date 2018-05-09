# Base Image
FROM ubuntu:16.04

MAINTAINER VDJServer <vdjserver@utsouthwestern.edu>

# PROXY: uncomment these if building behind UTSW proxy
#ENV http_proxy 'http://proxy.swmed.edu:3128/'
#ENV https_proxy 'https://proxy.swmed.edu:3128/'
#ENV HTTP_PROXY 'http://proxy.swmed.edu:3128/'
#ENV HTTPS_PROXY 'https://proxy.swmed.edu:3128/'

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update
RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y \
    make \
    gcc g++ \
    redis-server \
    redis-tools \
    sendmail-bin \
    supervisor \
    wget \
    xz-utils

# node
RUN wget https://nodejs.org/dist/v8.10.0/node-v8.10.0-linux-x64.tar.xz
RUN tar xf node-v8.10.0-linux-x64.tar.xz
RUN cp -rf /node-v8.10.0-linux-x64/bin/* /usr/bin
RUN cp -rf /node-v8.10.0-linux-x64/lib/* /usr/lib
RUN cp -rf /node-v8.10.0-linux-x64/include/* /usr/include
RUN cp -rf /node-v8.10.0-linux-x64/share/* /usr/share

# Setup postfix
# The postfix install won't respect noninteractivity unless this config is set beforehand.
RUN mkdir /etc/postfix
RUN touch /etc/mailname
COPY docker/postfix/main.cf /etc/postfix/main.cf
COPY docker/scripts/postfix-config-replace.sh /root/postfix-config-replace.sh

# Debian vociferously complains if you try to install postfix and sendmail at the same time.
RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y -q \
    postfix

##################
##################

RUN mkdir /vdjserver-web-api

# Setup redis
COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

# PROXY: More UTSW proxy settings
#RUN npm config set proxy http://proxy.swmed.edu:3128
#RUN npm config set https-proxy http://proxy.swmed.edu:3128

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-web-api/
RUN cd /vdjserver-web-api && npm install

# Copy project source
COPY . /vdjserver-web-api

CMD ["/root/postfix-config-replace.sh"]
