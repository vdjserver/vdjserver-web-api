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

RUN mkdir /vdjserver-auth

# Install npm dependencies (optimized for cache)
COPY package.json /vdjserver-auth/
RUN cd /vdjserver-auth && npm install

# Copy project source
COPY . /vdjserver-auth

# Supervisor
RUN touch /vdjserver-auth/logs/forever.log
RUN touch /vdjserver-auth/logs/stderr.log
COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

CMD /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
