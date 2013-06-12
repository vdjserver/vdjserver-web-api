#### vdjserver-web
A web frontend for the VDJSserver.org project.

Uses Node.js as the server.

Uses MongoDB as the local account info store. Assumes a local,running,and available MongoDB instance.

Uses Agave2.0 for community accounts, data IO, compute, etc...

Uses Express.js as a backend framework.

####Installation & Setup
This assumes you already have MongoDB, node.js & npm installed.

```
git clone git@bitbucket.org:taccaci/vdjserver-web.git
cd vdjserver-web


edit app/server/modules/agave-settings.js with the following:
* username and password to Agave API


edit app/server/modules/app-settings.js with the following:
* vdjCert
* vdjKey


npm install -d
node app/app
```

#### Documentation:
Documentation on the v2 version of the Agave API that this project uses is available at: https://iplant-dev.tacc.utexas.edu/v2/docs/

#### Agave Authentication:
Auth tokens should come from https://iplant-vm.tacc.utexas.edu/auth-v2/.
iplant-dev.tacc.utexas.edu will be used during development and testing. It should be able to read the tokens given by iplant-vm.tacc.utexas.edu.

#### TODO:
-get full Agave internal account working. I think we need to make it such that internal accounts are created with usernames that use the mongodb "_id" field from the vdjserver-accounts.accounts db. So for example: "_id" : ObjectId("51a677b58abdf2af0f000001") would yeild an account name like "vdj_51a677b58abdf2af0f000001". 
-right now the line that attempts to create an internal Agave account is commented out in:
    app/server/modules/account-manager.js
    //UNCOMMENT ME TO WORK!!                    var interUser = Agave.createInternalUser(newData);
    ...because I was just handed the new Agave functionality to query for disabled users

-also these things: https://collab.tacc.utexas.edu/projects/vdjserver/issues?query_id=58
