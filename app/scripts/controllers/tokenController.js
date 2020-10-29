
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Q = require('q');

var TokenController = {};
module.exports = TokenController;

// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.getToken - begin for ' + request.user.username);

    agaveIO.getUserVerificationMetadata(request.user.username)
        .then(function(userVerificationMetadata) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata for ' + request.user.username);
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                return agaveIO.getToken(request.user);
            }
            else {
                return Q.reject(new Error('TokenController.getToken - error - unable to verify account for ' + request.user.username));
            }
        })
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata successful for ' + request.user.username);
	    webhookIO.postToSlack('VDJ-API INFO: TokenController.getToken - successful for ' + request.user.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.getToken - error - username ' + request.user.username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.refreshToken - begin for ' + request.user.username);

    agaveIO.refreshToken(request.user)
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.refreshToken - complete for ' + request.user.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.refreshToken - error - username ' + request.user.username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response);
        });
};
