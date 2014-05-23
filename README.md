#### VDJServer-Auth
An auth service for the VDJServer.org project.

Uses:
 * Node.js
 * Express.js
 * Agave 2.0

#### Installation & Setup
This assumes you already have node.js & npm installed.

```
git clone git@bitbucket.org:taccaci/vdjserver-auth.git
cd vdjserver-auth

Install NPM dependencies
npm install -d

Copy default agave settings:
cd app/scripts/config
cp agaveSettingsDefault.js agaveSettings.js
cp configDefault.js config.js

Edit agaveSettings.js and add the following:
* clientKey
* clientSecret

Edit config.js and for the following:
* config.port
* config.sessionSecret
* config.sslOptions // comment this out if SSL not needed

Make sure that the following files are available:
* app/scripts/config/vdjserver.org.certificate/vdjserver.org.key
* app/scripts/config/vdjserver.org.certificate/vdjserver.org.cer

Start App
node app/scripts/app
```


#### Documentation:
Documentation on VDJ Auth Server endpoints is currently available at: [https://docs.google.com/a/tacc.utexas.edu/spreadsheets/d/1A7uu8iMerAB8xBIcnRLLArHyxA1fuh4gqKbj1ygstTA/edit#gid=0](https://docs.google.com/a/tacc.utexas.edu/spreadsheets/d/1A7uu8iMerAB8xBIcnRLLArHyxA1fuh4gqKbj1ygstTA/edit#gid=0).

Documentation on Agave v2 is available at: [http://agaveapi.co/live-docs/](http://agaveapi.co/live-docs/).


#### Tests
Unit tests use the mocha testing framework. They can be run with the commands 'make' or 'npm test' in the app root directory.

Note: If you want to be able to run integration tests, then make sure that test internal user credentials have been added to app/config/agaveSettings.js.

#### TODO:
Project Tickets/Issues are available at: [https://trello.com/b/xTS13xH7/vdj-server](https://trello.com/b/xTS13xH7/vdj-server).
