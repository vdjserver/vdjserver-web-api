#### vdjserver-web
An auth service for the VDJServer.org project.

Uses Node.js as the server.

Uses Agave2.0 for community accounts, data IO, compute, etc...

Uses Express.js as a backend framework.

####Installation & Setup
This assumes you already have node.js & npm installed.

```
git clone git@bitbucket.org:taccaci/vdjserver-auth.git
cd vdjserver-auth


Edit app/server/agave-settings.js with the following:
* username and password to Agave API


Make sure that the following files are available:
* app/vendor/vdjserver.org.certificate/vdjserver.org.key
* app/vendor/vdjserver.org.certificate/vdjserver.org.cer


npm install -d
node app/app
```

#### Documentation:
Documentation on the v2 version of the Agave API that this project uses is available at: [https://iplant-dev.tacc.utexas.edu/v2/docs/](https://iplant-dev.tacc.utexas.edu/v2/docs/)

#### Agave Authentication:
Auth tokens should come from https://iplant-dev.tacc.utexas.edu/v2/.

#### Tests
Unit tests use the mocha testing framework. They can be run with the commands 'make' or 'npm test' in the app root directory.

#### TODO:
-also these things: https://collab.tacc.utexas.edu/projects/vdjserver/issues?query_id=58
