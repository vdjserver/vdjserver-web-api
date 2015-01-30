
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Node Libraries
var Q = require('q');

var TokenController = {};
module.exports = TokenController;

// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = function(request, response) {

    agaveIO.getUserVerificationMetadata(request.user.username)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata.value.isVerified === true) {
                return agaveIO.getToken(request.user);
            }
            else {
                return Q.reject(new Error('Cannot fetch token for unverified account.'));
            }
        })
        .then(function(agaveToken) {
            apiResponseController.sendSuccess(agaveToken, response);
        }, function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    agaveIO.refreshToken(request.user)
        .then(function(agaveToken) {
            apiResponseController.sendSuccess(agaveToken, response);
        }, function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

/*
// Deletes a user token from Agave and returns it to the client
TokenController.deleteToken = function(request, response) {

    agaveIO.deleteToken(request.user)
        .then(function(agaveToken) {
            apiResponseController.sendSuccess(agaveToken, response);
        }, function(error) {
            apiResponseController.sendError(error.message, response);
        });

};
*/
