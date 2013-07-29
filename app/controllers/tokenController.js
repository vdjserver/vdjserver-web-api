
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
TokenController.getInternalUserToken = function(request, response) {

    var tokenAuth = request.user;

    agaveIO.getInternalUserToken(tokenAuth, function(error, returnedTokenAuth) {

        if (!error) {
            console.log("token fetch - no error and tokenAuth is: " + returnedTokenAuth);
            returnedTokenAuth.password = "";
            console.log("set password to nothing. check is: " + JSON.stringify(returnedTokenAuth));
            apiResponseController.sendSuccess(returnedTokenAuth, response);
        }
        else {
            console.log("token fetch - error");
            apiResponseController.sendError("Unable to fetch Agave token for '" + request.user.username + "'", response);
        }

    });

};

TokenController.provideVdjToken = function(callback) {

    if (agaveSettings.tokenAuth) {
        
        TokenController.refreshVdjToken(function(refreshError, refreshedTokenAuth) {
            
            if (!refreshError) {
                
                callback(null, refreshedTokenAuth);

            }
            else {

                TokenController.getNewVdjToken(function(getNewError, newTokenAuth) {
                
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
        
        TokenController.getNewVdjToken(function(error, newTokenAuth) {
            
            if (!error) {
                callback(null, newTokenAuth);
            }
            else {
                callback(error);
            }

        });

    }

};

// Refreshes a vdj token with Agave IO
TokenController.refreshVdjToken = function(callback) {

    var tokenAuth = agaveSettings.tokenAuth;

    agaveIO.refreshVdjToken(tokenAuth, function(error, refreshedTokenAuth) {

        if (!error) {
            console.log("vdj token fetch - no error and tokenAuth is: " + refreshedTokenAuth);
            agaveSettings.tokenAuth = refreshedTokenAuth;

            callback(null, refreshedTokenAuth);
        }
        else {
            console.log("vdj token fetch - error");
            callback('error');
        }

    });

};

// Retrieves a vdj token from Agave IO
TokenController.getNewVdjToken = function(callback) {

    var tokenAuth = new TokenAuth.schema();

    agaveIO.getNewVdjToken(tokenAuth, function(error, newTokenAuth) {

        if (!error) {
            console.log("vdj token fetch - no error and tokenAuth is: " + newTokenAuth);
            agaveSettings.tokenAuth = newTokenAuth;

            callback(null, newTokenAuth);
        }
        else {
            console.log("vdj token fetch - error");
            callback('error');
        }

    });

};
