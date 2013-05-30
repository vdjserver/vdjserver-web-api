#### vdjserver-web
A web frontend for the VDJSserver.org project.

Uses Node.js as the server.

Uses MongoDB as the local account info store. Assumes a local,running,and available MongoDB instance.

Uses Agave2.0 for community accounts, data IO, compute, etc...

####Installation & Setup
This assumes you already have MongoDB, node.js & npm installed.

```
git clone git@bitbucket.org:taccaci/vdjserver-web.git
cd vdjserver-web

edit app/server/modules/agave-settings.js with username and password to Agave API

npm install -d
node app
```
#### TODO:
-get full Agave internal account working. I think we need to make it such that internal accounts are created with usernames that use the mongodb "_id" field from the vdjserver-accounts.accounts db. So for example: "_id" : ObjectId("51a677b58abdf2af0f000001") would yeild an account name like "vdj_51a677b58abdf2af0f000001". 
-right now the line that attempts to create an internal Agave account is commented out in:
    app/server/modules/account-manager.js
    //UNCOMMENT ME TO WORK!!                    var interUser = Agave.createInternalUser(newData);
    ...because I was just handed the new Agave functionality to query for disabled users

-also these things: https://collab.tacc.utexas.edu/projects/vdjserver/issues?query_id=58
