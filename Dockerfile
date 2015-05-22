# Base Image
FROM debian:jessie

MAINTAINER Walter Scarborough <wscarbor@tacc.utexas.edu>

# Install OS Dependencies
RUN apt-get update && apt-get install -y \
    nodejs \
    nodejs-legacy \
    npm \
    supervisor \
    vim

RUN npm install -g \
    forever

RUN mkdir /vdjserver-web-api

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-web-api/
RUN cd /vdjserver-web-api && npm install

# Copy project source
COPY . /vdjserver-web-api

# Supervisor
RUN touch /vdjserver-web-api/logs/output.log
RUN touch /vdjserver-web-api/logs/error.log
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

CMD /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
