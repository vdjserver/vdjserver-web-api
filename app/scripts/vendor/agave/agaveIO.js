
// Settings
var agaveSettings = require('../../config/agave-settings');

// TokenAuth
var TokenAuth = require('../../models/tokenAuth');

var agaveIO  = {};
module.exports = agaveIO;


// Sets up request settings for new token requests
agaveIO.createTokenSettings = function(postData) {

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

// Sets up request settings for token refresh requests
agaveIO.tokenRefreshSettings = function(token) {

    return {
        hostname:   agaveSettings.host,
        method:     'PUT',
        auth:       agaveSettings.authenticatedUser + ':' + agaveSettings.authenticatedUserPassword,
        path:       agaveSettings.authEndpoint + 'tokens' + '/' + token,
        rejectUnauthorized: false
    }

};

// Sets up request settings for token validation requests
agaveIO.internalUserTokenValidateSettings = function(token) {

    return {
        hostname:   agaveSettings.host,
        method:     'GET',
        auth:       agaveSettings.authenticatedUser + ':' + agaveSettings.authenticatedUserPassword,
        path:       agaveSettings.authEndpoint + 'tokens' + '/' + token,
        rejectUnauthorized: false
    }

};

// Sets up request settings for internal user creation requests
agaveIO.createInternalUserRequestSettings = function(postData) {

    return {
        hostname:   agaveSettings.host,
        method:     'POST',
        auth:       agaveSettings.authenticatedUser + ':' + agaveSettings.tokenAuth.token,
        path:       agaveSettings.createInternalUserEndpoint,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':     'application/json',
            'Content-Length':   JSON.stringify(postData).length
        }
    }
};

// A utility method to help map token responses onto the token object in order to help stay organized and consistent
agaveIO.parseTokenResponse = function(responseObject) {

    var tokenAuth = new TokenAuth();
    tokenAuth.token         = responseObject.result.token;
    tokenAuth.username      = responseObject.result.username;
    tokenAuth.created       = responseObject.result.created;
    tokenAuth.expires       = responseObject.result.expires;
    tokenAuth.renewed       = responseObject.result.renewed;
    tokenAuth.remainingUses = responseObject.result.remainingUses;

    if (responseObject.result.internalUsername) {
        tokenAuth.internalUsername = responseObject.result.internalUsername;
    }

    return tokenAuth;
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
agaveIO.createInternalUserToken = function(internalUsername, callback) {

    // NOTE: lifetime should go into agave settings
    var postData = "internalUsername=" + internalUsername + '&lifetime=10800';

    var requestSettings = agaveIO.createTokenSettings(postData);

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
                var tokenAuth = agaveIO.parseTokenResponse(responseObject);
                callback(null, tokenAuth);
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

// Validates an auth user token and returns true/false depending on validation
agaveIO.validateInternalUserToken = function(token, callback) {

    var requestSettings = agaveIO.internalUserTokenValidateSettings(token);

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
                var tokenAuth = agaveIO.parseTokenResponse(responseObject);
                callback(null, tokenAuth);
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

// Refreshes a token and returns it on success
agaveIO.refreshToken = function(token, callback) {

    var requestSettings = agaveIO.tokenRefreshSettings(token);

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
                var tokenAuth = agaveIO.parseTokenResponse(responseObject);
                callback(null, tokenAuth);
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

// Creates a new internal user through Agave based on the supplied internal user object. Returns the internal user object on success.
agaveIO.createInternalUser = function(internalUser, callback) {

    var postData = {
        "username": internalUser.username,
        "email":    internalUser.profile[0].email
    };

    var requestSettings = agaveIO.createInternalUserRequestSettings(postData);

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

            if (responseObject && responseObject.status === "success") {
                callback(null, internalUser);
            }
            else {
                callback("error");
            }

        });

    });

    request.on('error', function(error) {
        callback("error");
    });


    //write the JSON of the internal user
    request.write(JSON.stringify(postData));

    request.end();
};



// Fetches an auth user token and returns it on success
agaveIO.createVdjToken = function(callback) {

    var postData = "lifetime=10800";

    var requestSettings = agaveIO.createTokenSettings(postData);

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
                var tokenAuth = agaveIO.parseTokenResponse(responseObject);
                callback(null, tokenAuth);
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

    request.end();
};
