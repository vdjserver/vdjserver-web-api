
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

    console.log('TokenController.getToken - event - begin for ' + request.user.username);

    agaveIO.getUserVerificationMetadata(request.user.username)
        .then(function(userVerificationMetadata) {
            console.log('TokenController.getToken - event - verification metadata for ' + request.user.username);
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                return agaveIO.getToken(request.user);
            }
            else {
                return Q.reject(new Error('TokenController.getToken - error - unable to verify account for ' + request.user.username));
            }
        })
        .then(function(agaveToken) {
            console.log('TokenController.getToken - event - verification metadata for ' + request.user.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            console.error('TokenController.getToken - error - ' + error);

            apiResponseController.sendError(error.message, 401, response);
        });
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    console.log('TokenController.refreshToken - event - begin for ' + request.user.username);

    agaveIO.refreshToken(request.user)
        .then(function(agaveToken) {
            console.log('TokenController.refreshToken - event - complete for ' + request.user.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            console.error('TokenController.refreshToken - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        });
};
