
'use strict';

//
// tokenController.js
// User authentication and token refresh
//
// VDJServer Analysis Portal
// VDJ Web API service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var TokenController = {};
module.exports = TokenController;

var config = require('../config/config');

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var ServiceAccount = tapisIO.serviceAccount;
var GuestAccount = tapisIO.guestAccount;
var webhookIO = require('vdj-tapis-js/webhookIO');

// Controllers
var apiResponseController = require('./apiResponseController');

// Retrieves a new user token from Agave and returns it to the client
TokenController.getToken = async function(request, response) {
    const context = 'TokenController.getToken';

    config.log.info(context, 'begin for ' + request.body.username);

    // service account does not need the verification record
    if (request.body.username == tapisSettings.serviceAccountKey) {
        return tapisIO.getToken(request.body)
            .then(function(agaveToken) {
                var msg = config.log.info(context, 'successful for ' + request.body.username);
                webhookIO.postToSlack(msg);
                apiResponseController.sendSuccess(agaveToken, response);
            })
            .catch(function(error) {
                var msg = config.log.error(context, 'error - username ' + request.body.username + ', error ' + error);
                webhookIO.postToSlack(msg);
                apiResponseController.sendError(error.message, 401, response);
            });
    } else {
        return tapisIO.getUserVerificationMetadata(request.body.username)
            .then(function(userVerificationMetadata) {
                config.log.info(context, 'verification metadata for ' + request.body.username);
                if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                    return tapisIO.getToken(request.body);
                }
                else {
                    return Promise.reject(new Error('TokenController.getToken - error - unable to verify account for ' + request.body.username));
                }
            })
            .then(function(agaveToken) {
                var msg = config.log.info(context, 'successful for ' + request.body.username);
                webhookIO.postToSlack(msg);
                apiResponseController.sendSuccess(agaveToken, response);
            })
            .catch(function(error) {
                var msg = config.log.error(context, 'error - username ' + request.body.username + ', error ' + error);
                webhookIO.postToSlack(msg);
                apiResponseController.sendError(error.message, 401, response);
            });
    }
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.refreshToken - begin for ' + request.body.username);

    return tapisIO.refreshToken(request.body)
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.refreshToken - complete for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.refreshToken - error - username ' + request.body.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};

// Retrieves a new user token from Agave and returns it to the client
TokenController.getOAuthToken = async function(request, response) {
    const context = 'TokenController.getOAuthToken';
    var msg = null;

    config.log.info(context, 'begin for client:' + request.body.client_id);

    // get the client
    var client = await tapisIO.getClient(request.body.client_id)
        .catch(function(error) {
            msg = 'error attempting to get client: ' + request.body.client_id + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(client);

    var token = await tapisIO.getOAuthToken(client, request.body.code)
        .catch(function(error) {
            msg = 'error getting token for client: ' + request.body.client_id + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(token);
    let access_token = token['access_token']['access_token'];

    // get my profile and username from the token
    var tapisProfile = await tapisIO.getTapisUserProfile(access_token, 'me')
        .catch(function(error) {
            msg = 'error getting tapis profile, error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(tapisProfile);
    var username = tapisProfile['result']['username'];

    // does this user have a verification record?
    var userVerificationMetadata = await tapisIO.getUserVerificationMetadata(username)
        .catch(function(error) {
            msg = 'error getting user verification for username: ' + username + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(userVerificationMetadata);
    if (!userVerificationMetadata || userVerificationMetadata.length == 0) {
        config.log.info(context, 'first login? No user verification record, creating for user: ' + username);

        // create user verification
        // TODO: this verify needs to be shifted to email verification
        userVerificationMetadata = await tapisIO.createUserVerificationMetadata(username, true)
            .catch(function(error) {
                msg = 'verification metadata failed for user: ' + username + ', error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        config.log.info(context, 'verification metadata (' + userVerificationMetadata.uuid
                    + ') successful for user: ' + username);
    }

    // does this user have a profile?
    var userProfile = await tapisIO.getUserProfile(username)
        .catch(function(error) {
            msg = 'error getting user profile for username: ' + username + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(userProfile);
    if (!userProfile || userProfile.length == 0) {
        config.log.info(context, 'first login? No user profile record, creating for user: ' + username);

        // create user profile
        userProfile = await tapisIO.createUserProfile(null, username)
            .catch(function(error) {
                msg = 'verification metadata failed for user: ' + username + ', error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        config.log.info(context, 'create user profile (' + userProfile.uuid
                + ') successful for user: ' + username);

        // Give read access to the tapis storage system
        tapisIO.grantStorageSystemPermissions(username)
            .catch(function(error) {
                msg = 'grant storage system permission failed for user: ' + username + ', error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        config.log.info(context, 'granted read access to storage system for user: ' + username);
    }

    token['username'] = username;
    msg = config.log.info(context, 'login successful for ' + username);
    webhookIO.postToSlack(msg);
    apiResponseController.sendSuccess(token, response);
};

// Refreshes a user token from Agave and returns it to the client
TokenController.refreshOAuthToken = function(request, response) {

    console.log('VDJ-API INFO: TokenController.refreshToken - begin for ' + request.body.username);

    return tapisIO.refreshToken(request.body)
        .then(function(agaveToken) {
            console.log('VDJ-API INFO: TokenController.refreshToken - complete for ' + request.body.username);
            apiResponseController.sendSuccess(agaveToken, response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: TokenController.refreshToken - error - username ' + request.body.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 401, response);
        });
};
