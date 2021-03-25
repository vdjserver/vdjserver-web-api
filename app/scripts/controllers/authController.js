
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
var ServiceAccount = require('../models/serviceAccount');
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Q = require('q');

// Extract token from header
AuthController.extractToken = function(req) {
    // extract the token from the authorization header
    if (! req['headers']['authorization']) {
        var msg = 'VDJ-API ERROR: AuthController.userAuthorization - missing authorization header';
        console.error(msg);
        webhookIO.postToSlack(msg);
        return false;
    }
    var fields = req['headers']['authorization'].split(' ');
    if (fields.length != 2) {
        var msg = 'VDJ-API ERROR: AuthController.userAuthorization - invalid authorization header: ' + req['headers']['authorization'];
        console.error(msg);
        webhookIO.postToSlack(msg);
        return false;
    }
    if (fields[0].toLowerCase() != 'bearer') {
        var msg = 'VDJ-API ERROR: AuthController.userAuthorization - invalid authorization header: ' + req['headers']['authorization'];
        console.error(msg);
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
    if (config.debug) console.log('VDJ-API INFO: AuthController.userAuthorization');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // get my profile and username from the token
    // return a promise
    return agaveIO.getAgaveUserProfile(token, 'me')
        .then(function(userProfile) {
            // save the user profile
            req['user'] = userProfile;

            // now check that the user account has been verified
            return agaveIO.getUserVerificationMetadata(req['user']['username']);
        })
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
                // valid
                return true;
            }
            else {
                var msg = 'VDJ-API ERROR: AuthController.userAuthorization - access by unverified user: ' + req['user']['username'];
                console.error(msg);
                webhookIO.postToSlack(msg);
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.userAuthorization - invalid token: ' + token + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

// Requires the user account to have admin privileges.
// Currently, only the service account has that.
AuthController.adminAuthorization = function(req, scopes, definition) {
    if (config.debug) console.log('VDJ-API INFO: AuthController.adminAuthorization');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // get my profile and username from the token
    // return a promise
    return agaveIO.getAgaveUserProfile(token, 'me')
        .then(function(userProfile) {
            // save the user profile
            req['user'] = userProfile;

            if (userProfile.username == ServiceAccount.username) {
                // valid
                return true;
            }
            else {
                var msg = 'VDJ-API ERROR: AuthController.adminAuthorization - access by unauthorized user: ' + req['user']['username'];
                console.error(msg);
                webhookIO.postToSlack(msg);
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.adminAuthorization - invalid token: ' + token + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

// Verify a user has access to project
AuthController.projectAuthorization = function(req, scopes, definition) {
    if (config.debug) console.log('VDJ-API INFO: AuthController.projectAuthorization');

    var token = AuthController.extractToken(req);
    if (!token) return false;

    // check body and params for project uuid
    var project_uuid;
    if (req.body) project_uuid = req.body.project_uuid;
    if (project_uuid == undefined)
        if (req.params) project_uuid = req.params.project_uuid;
    if (project_uuid == undefined) {
        var msg = 'VDJ-API ERROR: AuthController.authForProject - missing project uuid, route ' + JSON.stringify(req.route.path);
        console.error(msg);
        webhookIO.postToSlack(msg);
        return false;
    }

    // verify the user token
    // return a promise
    return AuthController.userAuthorization(req, scopes, definition)
        .then(function(result) {
            if (!result) return result;

            // verify the user has access to project
            return agaveIO.getProjectMetadata(token, project_uuid);
        })
        .then(function(projectMetadata) {
            // make sure its project metadata and not some random uuid
            // TODO: should disallow old VDJServer V1 projects at some point
            if (projectMetadata && (projectMetadata.name == 'private_project') || (projectMetadata.name == 'public_project') || (projectMetadata.name == 'project')) {
                return agaveIO.getMetadataPermissionsForUser(token, project_uuid, req['user']['username']);
            }
            else {
                return Promise.reject(new Error('invalid project metadata'));
            }
        })
        .then(function(projectPermissions) {
            // we can read the project metadata, but do we have write permission?
            if (projectPermissions && projectPermissions.permission.write)
                return true;
            else {
                return Promise.reject(new Error('user does not have write permission for project'));
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.authForProject - project: ' + project_uuid + ', route: '
                + JSON.stringify(req.route.path) + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return false;
        });
}

//
// verify a valid and active username account
//
AuthController.verifyUser = function(username) {

    if (username == undefined) return false;

    // return a promise
    return agaveIO.getUserVerificationMetadata(username)
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
            var msg = 'VDJ-API ERROR: AuthController.verifyUser - error validating user: ' + username + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return false;
        })
        ;
}

//
// verify user has access to metadata entry
//
AuthController.verifyMetadataAccess = function(uuid, accessToken, username) {

    if (uuid == undefined) return false;
    if (accessToken == undefined) return false;
    if (username == undefined) return false;

    return agaveIO.getMetadataPermissionsForUser(accessToken, uuid, username)
        .then(function(metadataPermissions) {
            // we can read the metadata, but do we have write permission?
            if (metadataPermissions && metadataPermissions.permission.write)
                return true;
            else {
                return false;
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: AuthController.verifyMetadataAccess - uuid: ' + uuid
                + ', error validating user: ' + username + ', error ' + error;
            console.error(msg);
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
