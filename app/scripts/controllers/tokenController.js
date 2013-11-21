
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var TokenController = {};
module.exports = TokenController;


// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = function(request, response) {

    agaveIO.getToken(request.auth, function(error, newToken) {

        if (!error && newToken.internalUsername === request.auth.username) {
            apiResponseController.sendSuccess(newToken, response);
        }
        else {
            apiResponseController.sendError('Unable to fetch Agave token for "' + request.auth.username + '"', response);
        }

    });

};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    agaveIO.refreshToken(request.auth, function(error, refreshToken) {

        if (!error && refreshToken.internalUsername === request.auth.username) {
            apiResponseController.sendSuccess(refreshToken, response);
        }
        else {
            apiResponseController.sendError('Unable to refresh agave token for "' + request.auth.username + '"', response);
        }

    });

};
