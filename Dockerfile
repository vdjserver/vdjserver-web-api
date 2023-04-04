# Base Image
FROM ubuntu:18.04

MAINTAINER VDJServer <vdjserver@utsouthwestern.edu>

# PROXY: uncomment these lines if building behind UTSW proxy
# PROXY: DO NOT COMMIT WITH PROXY ON
# PROXY: look for other lines below marked PROXY:
#ENV http_proxy 'http://proxy.swmed.edu:3128/'
#ENV https_proxy 'https://proxy.swmed.edu:3128/'
#ENV HTTP_PROXY 'http://proxy.swmed.edu:3128/'
#ENV HTTPS_PROXY 'https://proxy.swmed.edu:3128/'

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update && DEBIAN_FRONTEND='noninteractive' apt-get install -y \
    make \
    gcc g++ \
    redis-server \
    redis-tools \
    sendmail-bin \
    supervisor \
    wget \
    xz-utils \
    python3 \
    python3-pip

RUN pip3 install \
    requests \
    python-dotenv

# TODO: Redis should be moved out to docker-compose
# Turn off THP for redis, warning mentioned latency and memory usage issues when on
# RUN echo never > /sys/kernel/mm/transparent_hugepage/enabled

##################
##################

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

# node
ENV NODE_VER v12.18.3
RUN wget https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz
RUN tar xf node-$NODE_VER-linux-x64.tar.xz
RUN cp -rf /node-$NODE_VER-linux-x64/bin/* /usr/bin
RUN cp -rf /node-$NODE_VER-linux-x64/lib/* /usr/lib
RUN cp -rf /node-$NODE_VER-linux-x64/include/* /usr/include
RUN cp -rf /node-$NODE_VER-linux-x64/share/* /usr/share

# PROXY: More UTSW proxy settings
#RUN npm config set proxy http://proxy.swmed.edu:3128
#RUN npm config set https-proxy http://proxy.swmed.edu:3128

##################
##################

# setup vdj user
RUN echo "vdj:x:816290:803419:VDJServer,,,:/home/vdj:/bin/bash" >> /etc/passwd
RUN echo "G-803419:x:803419:vdj" >> /etc/group
RUN mkdir /home/vdj
RUN chown vdj /home/vdj
RUN chgrp G-803419 /home/vdj

# Setup redis
COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

##################
##################

# Copy project source
RUN mkdir /vdjserver-web-api
COPY . /vdjserver-web-api
RUN cd /vdjserver-web-api && npm install

# ESLint
RUN cd /vdjserver-web-api && npm run eslint app/scripts app/vdj-tapis-js app/vdjserver-schema

# Install the local airr-standards
RUN cd /vdjserver-web-api/app/airr-standards/lang/python && pip3 install .

CMD ["/root/postfix-config-replace.sh"]
