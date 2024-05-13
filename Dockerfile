# Base Image
FROM ubuntu:22.04

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
    sendmail-bin \
    supervisor \
    wget \
    xz-utils

##################
##################

# node
ENV NODE_VER v18.17.1
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

# Setup supervisor
COPY docker/scripts/start_supervisor.sh /root/start_supervisor.sh
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

##################
##################

# Copy project source
RUN mkdir /vdjserver-web-api
COPY . /vdjserver-web-api

# build vdjserver-schema and airr-js from source
RUN cd /vdjserver-web-api/app/vdjserver-schema/airr-standards/lang/js && npm install --unsafe-perm
RUN cd /vdjserver-web-api/app/vdjserver-schema && npm install --unsafe-perm

#RUN cd /vdjserver-web-api/app/airr-standards/lang/js && npm install && npm run test
#RUN cd /vdjserver-web-api/app/vdjserver-schema && npm install
RUN cd /vdjserver-web-api && npm install

# ESLint
RUN cd /vdjserver-web-api && npm run eslint app/scripts app/vdj-tapis-js

CMD ["/root/start_supervisor.sh"]
