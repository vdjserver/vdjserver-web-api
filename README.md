# VDJServer API

This project is a node.js middleware API for VDJServer clients and the Agave API.

It provides a variety of important services for clients including:

* authentication
* Agave webhook processing
* websocket notifications

## Service Dependencies

The VDJServer API requires a [redis](http://redis.io/) database for notification queueing. There are two ways of handling this:

## Installation & Setup via Docker

This project has been dockerized, and building it in via docker is straightforward:

```
git clone git@bitbucket.org:vdjserver/vdjserver-web-api.git

cd vdjserver-web-api

docker build -t vdjserver-web-api .
```

You will also need to set up the [VDJServer Redis](git@bitbucket.org:vdjserver/vdjserver-web-redis.git) docker container:

```
git clone git@bitbucket.org:vdjserver/vdjserver-web-redis.git

cd vdjserver-web-redis

docker build -it redis
```

Now you can start the VDJServer API:

```
docker run --link redis:redis vdjserver-web-api
```

## Running VDJServer API Without Docker

It may be faster to do iterative development on a local instance of the VDJServer API without using docker. Node.js applications need to be restarted to read changes in their codebases, and this is often done faster on a local machine than in a docker container.

```
git clone git@bitbucket.org:vdjserver/vdjserver-web-api.git

cd vdjserver-web-api/app/scripts

npm install

cp config/agaveSettings.js.defaults config/agaveSettings.js

# Add in values as needed
vim config/agaveSettings.js

cp config/config.js.defaults config/config.js

# Add in values as needed
vim config/config.js

####
#Install and start a local redis database on your machine using yum, apt-get, homebrew, etc.
# e.g. on a mac:
# brew install redis
# redis-server /usr/local/etc/redis.conf
####

# Set the correct environment vars to run as http instead of https
export NODE_ENV=development

# Start up the API
node app.js
```

#### Documentation:
Legacy documentation on VDJ Auth Server endpoints is currently available at: [https://docs.google.com/a/tacc.utexas.edu/spreadsheets/d/1A7uu8iMerAB8xBIcnRLLArHyxA1fuh4gqKbj1ygstTA/edit#gid=0](https://docs.google.com/a/tacc.utexas.edu/spreadsheets/d/1A7uu8iMerAB8xBIcnRLLArHyxA1fuh4gqKbj1ygstTA/edit#gid=0). Please note that this is currently deprecated, and is expected to be replaced by Swagger docs in the future.

Documentation on Agave v2 is available at: [http://agaveapi.co/live-docs/](http://agaveapi.co/live-docs/).


#### Tests
Unit tests use the mocha testing framework. They can be run with the commands 'make' or 'npm test' in the app root directory.

Note: If you want to be able to run integration tests, then make sure that test internal user credentials have been added to app/config/agaveSettings.js.

#### TODO:
Project Tickets/Issues are available at: [https://trello.com/b/xTS13xH7/vdj-server](https://trello.com/b/xTS13xH7/vdj-server).
