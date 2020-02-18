
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

    console.log('VDJ-API INFO: TokenController.getToken - begin for ' + request.body.username);

    agaveIO.getUserVerificationMetadata(request.body.username)
        .then(function(userVerificationMetadata) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata for ' + request.body.username);
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                return agaveIO.getToken(request.body);
            }
            else {
                return Q.reject(new Error('TokenController.getToken - error - unable to verify account for ' + request.body.username));
            }
        })
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.getToken - verification metadata successful for ' + request.body.username);
	    webhookIO.postToSlack('VDJ-API INFO: TokenController.getToken - successful for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.getToken - error - username ' + request.body.username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.refreshToken - begin for ' + request.body.username);

    agaveIO.refreshToken(request.body)
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.refreshToken - complete for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.refreshToken - error - username ' + request.body.username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response);
        });
};
