
var Agave  = {};
module.exports = Agave;


// Models
var InternalUserAuth = require('../models/internalUserAuth');


// Settings
var AgaveSettings = require('./agave-settings');



var token = '';

// Includes general settings for internal user token requests
Agave.internalUserTokenRequestSettings = function(internalUsername) {

    var postData = "internalUsername=" + internalUsername;

    return {
        hostname:   AgaveSettings.agaveAuthHost,
        method:     'POST',
        auth:       AgaveSettings.agaveUser + ':' + AgaveSettings.agavePass,
        path:       AgaveSettings.agaveAuth,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':     'application/x-www-form-urlencoded',
            'Content-Length':   postData.length 
        }
    }
};


// Fetches an internal user token based on supplied credentials and returns an InternalUserAuth object on success
Agave.getInternalUserToken = function(internalUsername, password, callback) {

    var request = require('https').request(Agave.internalUserTokenRequestSettings(internalUsername), function(response) {
        
        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var obj = JSON.parse(output);

            if (obj.status === "success" &&
                obj.result          &&
                obj.result.token    &&
                obj.result.username &&
                obj.result.expires) 
            {
                internalUserAuth = new InternalUserAuth.schema();
                
                internalUserAuth.internalUsername = internalUsername;
                internalUserAuth.token            = obj.result.token;
                internalUserAuth.authUsername     = obj.result.username;
                internalUserAuth.expires          = obj.result.expires;
            
                callback(null, internalUserAuth);
            }
            else {
                callback("error");
            }

        });
    });

    request.on('error', function(error) {
        console.log("getInternalUserToken error: " + error);
    });

    // Request body parameters
    request.write("internalUsername=" + internalUsername);

    request.end();
};

Agave.createInternalUser = function(newAccount, callback) {

    console.log('Agave.createInternalUser called with ' + JSON.stringify(newAccount));

    Agave.getToken(function(token) {

        console.log("Got token with " + token);

        var newUserJson = {
            "username":     newAccount.username,
            "email":        newAccount.email,
            "firstName":    newAccount.firstname,
            "lastName":     newAccount.lastname,
            "country":      newAccount.country
        };


        var postOptions = Agave.postOptionsToken(AgaveSettings.agaveVersion + '/profiles'
                                                               + '/'
                                                               + AgaveSettings.agaveUser
                                                               + '/users'
                                                               + '/',
                                              token);

        console.log("postOptions: " + JSON.stringify(postOptions));

        var request = require('https').request(postOptions, function(response) {

            console.log("inside request. options are: " + JSON.stringify(postOptions));
            //console.log("inside request. response is: " + JSON.stringify(response));

            var output = '';

            response.on('data', function(chunk) {
                console.log("response output is: " + JSON.stringify(output));
                console.log("chunk is: " + JSON.stringify(chunk));
                output += chunk;
            });

            response.on('end', function() {
                var obj = JSON.parse(output);

                console.log("obj is: " + JSON.stringify(obj));

                if (obj &&
                    obj.status &&
                    obj.result &&
                    obj.result.username)
                {
                    console.log("Obj is: "   + JSON.stringify(obj));
                    console.log("Status: "   + obj.status);
                    console.log("Username: " + obj.result.username);
                }
                else {
                    console.log("agave registration error. obj is: " + JSON.stringify(obj));
                }


                callback("", obj.status);
                return obj;
            });

        });


        request.on('error', function(error) {
            console.log("Error w/createInternalUser: " + postOptions + "\n" + error.message);
            console.log( error.stack );

            callback(error, "");

            return false;
        });

        //write the JSON of the internal user
        request.write(JSON.stringify(newUserJson));
        request.end();

        console.log("endOf createInternalUser");
    });

};
