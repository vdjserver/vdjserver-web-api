#### VDJServer-Auth
An auth service for the VDJServer.org project.

Uses Node.js as the server.

Uses Agave2.0 for community accounts, data IO, compute, etc...

Uses Express.js as a backend framework.

#### Installation & Setup
This assumes you already have node.js & npm installed.

```  
git clone git@bitbucket.org:taccaci/vdjserver-auth.git
cd vdjserver-auth


Copy the agaveSettings.js.default file to agaveSettings.js:  
cd app/config  
cp agaveSettings.js.default agaveSettings.js

Edit agaveSettings.js to add the following credentials:  
* authenticatedUser  
* authenticatedUserPassword  


If you want to be able to run integration tests, then you should also add the following credentials to agaveSettings.js:  
* testInternalUser  
* testInternalUserPassword  


Make sure that the following files are available:  
* app/config/vdjserver.org.certificate/vdjserver.org.key  
* app/config/vdjserver.org.certificate/vdjserver.org.cer  


npm install -d
node app/app  
```  


#### Documentation:
Documentation on VDJ Auth Server endpoints is currently available at: [https://docs.google.com/a/tacc.utexas.edu/document/d/1rg7AsLZEY_Kt73BAkOIPauN7v40CzAhjEOKv0loQKj8/edit](https://docs.google.com/a/tacc.utexas.edu/document/d/1rg7AsLZEY_Kt73BAkOIPauN7v40CzAhjEOKv0loQKj8/edit).  

Documentation on the v2 version of the Agave API that this project uses is available at: [https://iplant-dev.tacc.utexas.edu/v2/docs/](https://iplant-dev.tacc.utexas.edu/v2/docs/).  


#### Tests
Unit tests use the mocha testing framework. They can be run with the commands 'make' or 'npm test' in the app root directory.

Note: If you want to be able to run integration tests, then make sure that test internal user credentials have been added to app/config/agaveSettings.js.

#### TODO:
https://collab.tacc.utexas.edu/projects/vdjserver/issues
