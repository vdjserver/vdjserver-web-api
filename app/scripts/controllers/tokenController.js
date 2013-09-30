
// Models
var TokenAuth = require('../models/tokenAuth');

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// VDJ Token Storage
var agaveSettings = require('../config/agave-settings');


var TokenController = {};
module.exports = TokenController;


// Retrieves an internal user token from Agave IO and returns it to the client
TokenController.createInternalUserToken = function(request, response) {

    agaveIO.createInternalUserToken(request.auth.username, function(error, returnedTokenAuth) {

        if (!error && returnedTokenAuth.internalUsername === request.auth.username) {
            //returnedTokenAuth.password = "";
            apiResponseController.sendSuccess(returnedTokenAuth, response);
        }
        else {
            apiResponseController.sendError("Unable to fetch Agave token for '" + request.user.username + "'", response);
        }

    });

};

// Refreshes an internal user token and returns to client
TokenController.refreshInternalUserToken = function(request, response) {

    agaveIO.refreshToken(request.auth.password, function(error, refreshedTokenAuth) {

        if (!error && refreshedTokenAuth.internalUsername === request.auth.username) {
            apiResponseController.sendSuccess(refreshedTokenAuth, response);
        }
        else {
            apiResponseController.sendError("Unable to refresh agave token for '" + request.auth.username + "'", response);
        }

    });

};





// Refreshes a vdj token with Agave IO
TokenController.refreshVdjToken = function(tokenAuth, callback) {

    agaveIO.refreshToken(tokenAuth.token, function(error, refreshedTokenAuth) {

        if (!error) {

            callback(null, refreshedTokenAuth);
        }
        else {
            callback('error');
        }

    });

};

// Retrieves a vdj token from Agave IO
TokenController.createVdjToken = function(callback) {

    agaveIO.createVdjToken(function(error, newTokenAuth) {

        if (!error) {
            agaveSettings.tokenAuth = newTokenAuth;

            callback(null, newTokenAuth);
        }
        else {
            callback('get new token error');
        }

    });

};

/* 
    Attempts to refresh the current VDJ token and verify that it's available for use.
    If the refresh fails, then it automatically fetches a new one.
*/
TokenController.provideVdjToken = function(callback) {

    if (agaveSettings.tokenAuth) {

        TokenController.refreshVdjToken(agaveSettings.tokenAuth, function(refreshError, refreshedTokenAuth) {

            if (!refreshError) {

                agaveSettings.tokenAuth = refreshedTokenAuth;
                callback(null, refreshedTokenAuth);

            }
            else {

                TokenController.createVdjToken(function(getNewError, newTokenAuth) {

                    if (getNewError) {
                        callback(getNewError);
                    }
                    else {
                        callback(null, newTokenAuth);
                    }

                });

            }

        });

    }
    else {

        TokenController.createVdjToken(function(error, newTokenAuth) {

            if (!error) {
                callback(null, newTokenAuth);
            }
            else {
                callback(error);
            }

        });

    }

};
