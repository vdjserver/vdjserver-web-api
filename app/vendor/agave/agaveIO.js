
// Settings
var agaveSettings = require('../../config/agave-settings');


var agaveIO  = {};
module.exports = agaveIO;


// Sets up request settings for internal user token requests
agaveIO.internalUserTokenRequestSettings = function(postData) {

    return {
        hostname:   agaveSettings.host,
        method:     'POST',
        auth:       agaveSettings.authenticatedUser + ':' + agaveSettings.authenticatedUserPassword,
        path:       agaveSettings.authEndpoint,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':     'application/x-www-form-urlencoded',
            'Content-Length':   postData.length 
        }
    }
};


// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.getInternalUserToken = function(internalUserAuth, callback) {

    var postData = "internalUsername=" + internalUserAuth.internalUsername;

    var requestSettings = agaveIO.internalUserTokenRequestSettings(postData);

    var request = require('https').request(requestSettings, function(response) {
        
        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var obj = JSON.parse(output);

            if (obj &&
                obj.status === "success" &&
                obj.result          &&
                obj.result.token    &&
                obj.result.username &&
                obj.result.expires) 
            {
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

        callback("error");
    });

    // Request body parameters
    request.write(postData);

    // As Picard would say, 'Make it so'.
    request.end();
};


// Sets up request settings for internal user token requests
agaveIO.createInternalUserRequestSettings = function(postData) {

    return {
        hostname:   agaveSettings.host,
        method:     'POST',
        auth:       agaveSettings.authenticatedUser + ':' + agaveSettings.authenticatedUserPassword,
        path:       agaveSettings.createInternalUserEndpoint,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':     'application/json',
            'Content-Length':   JSON.stringify(postData).length 
        }
    }
};


// Creates a new internal user through Agave based on the supplied internal user object. Returns the internal user object on success.
agaveIO.createInternalUser = function(internalUser, callback) {

    var postData = {
        "username":     internalUser.username,
        "email":        internalUser.email
    };

    var requestSettings = agaveIO.createInternalUserRequestSettings(postData);

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var obj = JSON.parse(output);

            if (obj &&
                obj.status === "success" &&
                obj.result &&
                obj.result.username === internalUser.username)
            {
                callback(null, internalUser);
            }
            else {
                callback("error");
            }

        });

    });

    request.on('error', function(error) {
        console.log("createInternalUser error: " + error);
        callback("error");
    });

    //write the JSON of the internal user
    request.write(JSON.stringify(postData));

    request.end();
};
