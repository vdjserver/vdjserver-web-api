
'use strict';

// Settings
var agaveSettings = require('../../config/agaveSettings');

// Models
var AgaveToken = require('../../models/agaveToken');
var ServiceAccount = require('../../models/serviceAccount');

// Promises
var Q = require('q');

var agaveIO  = {};
module.exports = agaveIO;


// A utility method to help map token responses onto the token object in order to help stay organized and consistent
agaveIO.parseTokenResponse = function(responseObject) {

    var agaveToken = new AgaveToken({
        token_type:     responseObject.token_type,
        expires_in:     responseObject.expires_in,
        refresh_token:  responseObject.refresh_token,
        access_token:   responseObject.access_token
    });

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
agaveIO.getToken = function(auth) {

    var deferred = Q.defer();

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

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                deferred.resolve(agaveToken);
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function() {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};


// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth) {

    var deferred = q.defer();

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.password;

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

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                deferred.resolve(agaveToken);
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function() {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

// Deletes a token
agaveIO.deleteToken = function(auth) {

    var deferred = Q.defer();

    var postData = 'token=' + auth.password;

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
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status === 'success')
            {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                deferred.resolve(agaveToken);
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function() {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.createUser = function(user) {

    var deferred = Q.defer();

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/subscribers/v1/',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function() {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

agaveIO.createUserProfile = function(user, userAccessToken) {

    var deferred = Q.defer();

    var postData = {
        name: 'profile',
        value: user
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + userAccessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve('success');
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

agaveIO.createProject = function(projectName) {

    var deferred = Q.defer();

    var postData = {
        name: 'project',
        value: {
            "name": projectName
        }
    };

    postData = JSON.stringify(postData);

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

agaveIO.addUsernameToMetadataPermissions = function(username, accessToken, uuid) {

    console.log("username is: " + username);
    console.log("token is: " + accessToken);
    console.log("uuid is: " + uuid);

    var deferred = Q.defer();

    var postData = "username=" + username + "&permission=READ_WRITE";

    //postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            //'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve('success');
            }
            else {
                console.log("agave says: " + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

agaveIO.getMetadataPermissions = function(accessToken, uuid) {

    console.log("inside agaveIO. token is: " + accessToken + ' and uuid is: ' + uuid);

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    console.log("requestSettings are: " + JSON.stringify(requestSettings));

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                console.log("agave response NOT json");
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                console.log("agave says: " + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        console.log("getMetaPems gen error");
        deferred.reject(new Error('Agave connection error'));
    });

    //request.write();
    request.end();

    return deferred.promise;
};

agaveIO.getFilePermissions = function(accessToken, filePath) {

    console.log("token is: " + accessToken);
    console.log("filePath is: " + filePath);

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/pems/system/vdjIrods7' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                console.log("agave says: " + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.end();

    return deferred.promise;
};

agaveIO.addUsernameToFullFilePermissions = function(username, accessToken, filePath) {

    console.log("username is: " + username);
    console.log("token is: " + accessToken);
    console.log("filePath is: " + filePath);

    var deferred = Q.defer();

    var postData = "username=" + username + "&all=true&recursive=true";

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/vdjIrods7' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                console.log("agave says: " + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};

agaveIO.addUsernameToLimitedFilePermissions = function(username, accessToken, filePath) {

    console.log("username is: " + username);
    console.log("token is: " + accessToken);

    var deferred = Q.defer();

    var postData = "username=" + username + "&read=true&execute=true&recursive=true";

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/vdjIrods7' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
        }
    };

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject.result);
            }
            else {
                console.log("agave says: " + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function(/*error*/) {
        deferred.reject(new Error('Agave connection error'));
    });

    // Request body parameters
    request.write(postData);
    request.end();

    return deferred.promise;
};
