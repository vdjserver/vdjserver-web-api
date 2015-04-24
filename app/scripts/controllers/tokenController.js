
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');

var TokenController = {};
module.exports = TokenController;

// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = function(request, response) {

    agaveIO.getUserVerificationMetadata(request.user.username)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                return agaveIO.getToken(request.user);
            }
            else {
                return Q.reject(new Error('1'));
            }
        })
        .then(function(agaveToken) {
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            console.error('Error TokenController.getToken: ' + JSON.stringify(error));

            if (error.message === '1') {
                apiResponseController.sendError('Cannot fetch token for unverified account.', 403, response);
            }
            else {
                apiResponseController.sendError(error.message, 401, response);
            }
        });
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    agaveIO.refreshToken(request.user)
        .then(function(agaveToken) {
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            console.error('Error TokenController.refreshToken: ' + JSON.stringify(error));
            apiResponseController.sendError(error.message, 500, response);
        });
};
