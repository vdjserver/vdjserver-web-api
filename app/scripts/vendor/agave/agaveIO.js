
// Settings
var agaveSettings = require('../../config/agave-settings');

// AgaveToken
var AgaveToken = require('../../models/agaveToken');

var agaveIO  = {};
module.exports = agaveIO;


// Sets up request settings for new token requests
agaveIO.getTokenSettings = function(postData) {

    return {
        hostname: agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     agaveSettings.authEndpoint,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    }

};

// Sets up request settings for token refresh requests
agaveIO.refreshTokenSettings = function(postData) {

    return {
        hostname: agaveSettings.hostname,
        method:   'PUT',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     agaveSettings.authEndpoint,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
        }
    }

};

// A utility method to help map token responses onto the token object in order to help stay organized and consistent
agaveIO.parseTokenResponse = function(responseObject) {

    console.log("responseObject is: " + JSON.stringify(responseObject));

    var agaveToken = new AgaveToken();

    agaveToken.token_type    = responseObject.result.token_type;
    agaveToken.expires_in    = responseObject.result.expires_in;
    agaveToken.refresh_token = responseObject.result.refresh_token;
    agaveToken.access_token  = responseObject.result.access_token;

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
}

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
agaveIO.getToken = function(auth, callback) {

    console.log('agaveIO auth is: ' + JSON.stringify(auth));

    var postData = 'grant_type=password&scope=PRODUCTION&username=' + auth.username + '&password=' + auth.password;

    var requestSettings = agaveIO.getTokenSettings(postData);

    console.log('requestSettings are: ' + JSON.stringify(requestSettings));

    var request = require('https').request(requestSettings, function(response) {

        console.log("request over");

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && IsJSON(output)) {
                responseObject = JSON.parse(output);
            }

            console.log("request over - it is: " + JSON.stringify(responseObject));

            if (responseObject && responseObject.status === "success")
            {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback("error");
            }

        });
    });

    request.on('error', function(error) {
        callback("error");
    });

    // Request body parameters
    request.write(postData);

    // As Picard would say, 'Make it so'.
    request.end();
};


// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth, callback) {

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.password;

    var requestSettings = agaveIO.refreshTokenSettings(postData);

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

            if (responseObject && responseObject.status === "success")
            {
                var agaveToken = agaveIO.parseTokenResponse(responseObject);
                callback(null, agaveToken);
            }
            else {
                callback("error");
            }

        });
    });

    request.on('error', function(error) {
        callback("error");
    });

    // As Picard would say, 'Make it so'.
    request.end();
};
