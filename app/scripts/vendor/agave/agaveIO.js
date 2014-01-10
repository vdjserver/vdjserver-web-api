
'use strict';

// Settings
var agaveSettings = require('../../config/agaveSettings');

// AgaveToken
var AgaveToken = require('../../models/agaveToken');

var agaveIO  = {};
module.exports = agaveIO;


// A utility method to help map token responses onto the token object in order to help stay organized and consistent
agaveIO.parseTokenResponse = function(responseObject) {

    var agaveToken = new AgaveToken();

    agaveToken.token_type    = responseObject.token_type;
    agaveToken.expires_in    = responseObject.expires_in;
    agaveToken.refresh_token = responseObject.refresh_token;
    agaveToken.access_token  = responseObject.access_token;

    return agaveToken;
};

var IsJSON = function(input) {
    try {
        JSON.parse(input);
    }
    catch (error) {
        return false;
    }

    return true;
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.getToken = function(auth, callback) {

    console.log("getToken auth is: " + JSON.stringify(auth));

    var postData = 'grant_type=password&scope=PRODUCTION&username=' + auth.username + '&password=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && new IsJSON(output)) {
                responseObject = JSON.parse(output);
            }

            console.log("getToken resp obj is: " + JSON.stringify(responseObject));

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};


// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth, callback) {

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'PUT',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && new IsJSON(output)) {
                responseObject = JSON.parse(output);
            }

            if (responseObject && responseObject.status === 'success')
            {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

// Deletes a token
agaveIO.deleteToken = function(auth, callback) {

    var postData = 'token=' + auth.password;
    console.log("postData is: " + JSON.stringify(postData));

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/revoke',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    };


    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            console.log("resp chunk");
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            /*
            if (output && new IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            */
            console.log("responseObject is: " + JSON.stringify(responseObject));
            console.log("output is: " + JSON.stringify(output));
            console.log("resp status code is: " + JSON.stringify(response.status));

            if (responseObject && responseObject.status === 'success')
            {
                console.log("response actual is: " + JSON.stringify(responseObject));
                //var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(error) {
        console.log("request error is: " + JSON.stringify(error));
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.createUser = function(user, callback) {

    console.log("user is: " + JSON.stringify(user));

    var postData = 'email=' + user.email 
                 + '&username=' + user.username 
                 + '&password=' + user.password;


    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/users/1.0/',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + agaveSettings.serviceAccountToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && new IsJSON(output)) {
                responseObject = JSON.parse(output);
            }

            console.log("acct create responseObj is: " + JSON.stringify(responseObject));
            console.log("acct create responseStatus is: " + response.statusCode);

            if (responseObject && responseObject.status.toLowerCase() === 'success') {
                callback(null, 'success');
            }
            else {
                callback('error');
            }

        });
    });

    request.on('error', function(/*error*/) {
        callback('error');
    });

    // Request body parameters
    request.write(postData);
    request.end();
};
