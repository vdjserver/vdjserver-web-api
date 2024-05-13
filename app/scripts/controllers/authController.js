
'use strict';

//
// authController.js
// Handle security and authorization checks
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

var AuthController = {};
module.exports = AuthController;

// API config
var config = require('../config/config');

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;
var ServiceAccount = tapisIO.serviceAccount;

// Processing
var webhookIO = require('../vendor/webhookIO');

// Extract token from header
AuthController.extractToken = function(req) {
    const context = 'AuthController.extractToken';
    //config.log.info(context, req['headers']);

    // extract the token from the authorization header
    if (! req['headers']['authorization']) {
        var msg = 'missing authorization header';
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return false;
    }
    var fields = req['headers']['authorization'].split(' ');
    if (fields.length != 2) {
        var msg = 'invalid authorization header: ' + req['headers']['authorization'];
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return false;
    }
    if (fields[0].toLowerCase() != 'bearer') {
        var msg = 'invalid authorization header: ' + req['headers']['authorization'];
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return false;
    }
    return fields[1];
}

//
// Security handlers, these are called by the openapi
// middleware. Return true if authentication is valid,
// otherwise return false. The middleware will throw
// a generic 401 error, which the errorMiddleware returns
// to the client
//

// Verify a Tapis token
// Sets the associated user profile for the token in req.user
AuthController.userAuthorization = function(req, scopes, definition) {
    const context = 'AuthController.userAuthorization';
    //config.log.info(context, 'start');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // get my profile and username from the token
    // return a promise
    return tapisIO.getTapisUserProfile(token, 'me')
        .then(function(userProfile) {
            //config.log.info(context, JSON.stringify(userProfile));
            // save the user profile
            req['user'] = userProfile['result'];

            // service account does not need the verification record
            if (req['user']['username'] == tapisSettings.serviceAccountKey) return true;

            // now check that the user account has been verified
            return tapisIO.getUserVerificationMetadata(req['user']['username'])
                .then(function(userVerificationMetadata) {
                    if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                        // valid
                        return true;
                    }
                    else {
                        var msg = 'access by unverified user: ' + req['user']['username'];
                        msg = config.log.error(context, msg);
                        webhookIO.postToSlack(msg);
                        return false;
                    }
                });
        })
        .catch(function(error) {
            var msg = 'invalid token: ' + token + ', error: ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

// Requires the user account to have admin privileges.
// Currently, only the service account has that.
AuthController.adminAuthorization = function(req, scopes, definition) {
    const context = 'AuthController.adminAuthorization';
    //config.log.info(context, 'start');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // get my profile and username from the token
    // return a promise
    return tapisIO.getTapisUserProfile(token, 'me')
        .then(function(userProfile) {
            // save the user profile
            req['user'] = userProfile['result'];

            if (req['user']['username'] == tapisSettings.serviceAccountKey) {
                // valid
                return true;
            }
            else {
                var msg = 'access by unauthorized user: ' + req['user']['username']
                    + ', route: ' + JSON.stringify(req.route.path);
                msg = config.log.error(context, msg);
                webhookIO.postToSlack(msg);
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'invalid token: ' + token + ', error: ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

// Verify a user has access to project
AuthController.projectAuthorization = function(req, scopes, definition) {
    const context = 'AuthController.projectAuthorization';
    //config.log.info(context, 'start');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // check body and params for project uuid
    var project_uuid;
    if (req.body) project_uuid = req.body.project_uuid;
    if (project_uuid == undefined)
        if (req.params) project_uuid = req.params.project_uuid;
    if (project_uuid == undefined) {
        var msg = 'missing project uuid, route ' + JSON.stringify(req.route.path);
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return false;
    }

    // verify the user token
    // return a promise
    return AuthController.userAuthorization(req, scopes, definition)
        .then(function(result) {
            if (!result) return result;

            // verify the user has access to project
            return tapisIO.getProjectMetadata(req['user']['username'], project_uuid);
        })
        .then(function(projectMetadata) {
            //config.log.info(context, JSON.stringify(projectMetadata));

            // make sure its project metadata and not some random uuid
            // TODO: should disallow old VDJServer V1 projects at some point
            if (projectMetadata && (projectMetadata.length == 1) && ((projectMetadata[0].name == 'private_project') || (projectMetadata[0].name == 'public_project') || (projectMetadata[0].name == 'project') || (projectMetadata[0].name == 'archive_project'))) {
                // save the project metadata
                req['project_metadata'] = projectMetadata[0];
                return true;
            }
            else {
                return Promise.reject(new Error('invalid project metadata'));
            }
        })
        .catch(function(error) {
            var msg = 'project: ' + project_uuid + ', route: '
                + JSON.stringify(req.route.path) + ', error: ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

//
// verify a valid and active username account
//
AuthController.verifyUser = function(username) {
    const context = 'AuthController.verifyUser';

    if (username == undefined) return false;

    // return a promise
    return tapisIO.getUserVerificationMetadata(username)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                // valid
                return true;
            }
            else {
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'error validating user: ' + username + ', error ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return false;
        })
        ;
}

//
// verify user has access to metadata entry
//
AuthController.verifyMetadataAccess = function(uuid, accessToken, username) {
    const context = 'AuthController.verifyMetadataAccess';

    if (uuid == undefined) return false;
    if (accessToken == undefined) return false;
    if (username == undefined) return false;

    return tapisIO.getMetadataPermissionsForUser(accessToken, uuid, username)
        .then(function(metadataPermissions) {
            // we can read the metadata, but do we have write permission?
            if (metadataPermissions && metadataPermissions.permission.write)
                return true;
            else {
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'uuid: ' + uuid
                + ', error validating user: ' + username + ', error ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

/*
AuthController.verifyUserFromParams = function(request, response, next) {
    return AuthController.verifyUser(request, response, next, request.params.username);
}

AuthController.verifyUserFromBody = function(request, response, next) {
    return AuthController.verifyUser(request, response, next, request.body.username);
}

//
// authenticate the user by checking the token
//
AuthController.authUser = function(request, response, next) {
    // get my profile and verify same username
    agaveIO.getAgaveUserProfile(request.user.password, 'me')
        .then(function(userProfile) {
            if (userProfile && userProfile.username == request.user.username)
                return next();
            else {
                //console.log(userProfile);
                var msg = 'VDJ-API ERROR: AuthController.authUser - route '
                    + JSON.stringify(request.route) + ', authentication token ' + request.user.password + ' provided with non-matching username: '
                    + userProfile.username + ' != ' + request.user.username;
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.send401(request, response);
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.authUser - route '
                + JSON.stringify(request.route) + ', error validating user: ' + request.user.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.send401(request, response);
        });
}

//
// verify user has access to project
//
AuthController.authForProject = function(request, response, next, projectUuid) {

    if (!projectUuid) {
        return apiResponseController.sendError('Project uuid required.', 400, response);
    }

    agaveIO.getProjectMetadata(request.user.password, projectUuid)
        .then(function(projectMetadata) {
            // make sure its project metadata and not some random uuid
            if (projectMetadata && projectMetadata.name == 'project') {
                return agaveIO.getMetadataPermissionsForUser(request.user.password, projectUuid, request.user.username);
            }
            else {
                return apiResponseController.send401(request, response);
            }
        })
        .then(function(projectPermissions) {
            // we can read the project metadata, but do we have write permission?
            if (projectPermissions && projectPermissions.permission.write)
                return next();
            else {
                return apiResponseController.send401(request, response);
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.authForProject - project: ' + projectUuid + ', route '
                + JSON.stringify(request.route) + ', error validating user: ' + request.user.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.send401(request, response);
        });
}

AuthController.authForProjectFromParams = function(request, response, next) {
    return AuthController.authForProject(request, response, next, request.params.projectUuid);
}

AuthController.authForProjectFromBody = function(request, response, next) {
    return AuthController.authForProject(request, response, next, request.body.projectUuid);
}

AuthController.authForProjectFromQuery = function(request, response, next) {
    return AuthController.authForProject(request, response, next, request.query.projectUuid);
}

//
// Unpublishing a project is special as no user has write access on a public project
// However, we leave original users on project with read access
//
AuthController.authForUnpublishProject = function(request, response, next, projectUuid) {

    if (!projectUuid) {
        return apiResponseController.sendError('Project uuid required.', 400, response);
    }

    agaveIO.getProjectMetadata(request.user.password, projectUuid)
        .then(function(projectMetadata) {
            // make sure its project metadata and not some random uuid
            if (projectMetadata && projectMetadata.name == 'publicProject') {
                return agaveIO.getMetadataPermissionsForUser(request.user.password, projectUuid, request.user.username);
            }
            else {
                return apiResponseController.send401(request, response);
            }
        })
        .then(function(projectPermissions) {
            // verify read permission for specific user
            if (projectPermissions && projectPermissions.permission.read)
                return next();
            else {
                return apiResponseController.send401(request, response);
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.authForUnpublishProject - project: ' + projectUuid + ', route '
                + JSON.stringify(request.route) + ', error validating user: ' + request.user.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.send401(request, response);
        });
}

AuthController.authForUnpublishProjectFromParams = function(request, response, next) {
    return AuthController.authForUnpublishProject(request, response, next, request.params.projectUuid);
}

//
// verify user has access to metadata entry
//
AuthController.authForMetadata = function(request, response, next, uuid) {

    if (!uuid) {
        return apiResponseController.sendError('Metadata uuid required.', 400, response);
    }

    agaveIO.getMetadataPermissionsForUser(request.user.password, uuid, request.user.username)
        .then(function(metadataPermissions) {
            // we can read the metadata, but do we have write permission?
            if (metadataPermissions && metadataPermissions.permission.write)
                return next();
            else {
                return apiResponseController.send401(request, response);
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.authForMetadata - uuid: ' + uuid + ', route '
                + JSON.stringify(request.route) + ', error validating user: ' + request.user.username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.send401(request, response);
        });
}

AuthController.authForMetadataFromBody = function(request, response, next) {
    return AuthController.authForMetadata(request, response, next, request.body.uuid);
}
*/
