
'use strict';

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

var AuthController = {};
module.exports = AuthController;

//
// verify a valid and active username account
//
AuthController.verifyUser = function(request, response, next, username) {

    if (!username) {
        return apiResponseController.sendError('Username required.', 400, response);
    }

    agaveIO.getUserVerificationMetadata(username)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === true) {
		// valid
                return next();
            }
            else {
		apiResponseController.sendError('Invalid username.', 400, response);
            }
        })
        .fail(function(error) {
	    var msg = 'VDJ-API ERROR: AuthController.verifyUser - error validating user: ' + username + ', error ' + error;
            console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 500, response);
        })
        ;
}

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
		console.log(userProfile);
		var msg = 'VDJ-API ERROR: AuthController.authUser - route '
		    + JSON.stringify(request.route) + ', authentication token ' + request.user.password + ' provided with non-matching username: '
		    + userProfile.username + ' != ' + request.user.username;
		console.error(msg);
		webhookIO.postToSlack(msg);
		return apiResponseController.send401(request, response);
	    }
	})
        .fail(function(error) {
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
        .fail(function(error) {
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