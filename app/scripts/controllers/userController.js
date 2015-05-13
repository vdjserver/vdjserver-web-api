
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Q = require('q');

var UserController = {};
module.exports = UserController;

UserController.createUser = function(request, response) {

    var user = new User({
        username:   request.body.username,
        password:   request.body.password,
        email:      request.body.email,
        firstName:  request.body.firstName,
        lastName:   request.body.lastName,
        city:       request.body.city,
        state:      request.body.state,
        country:    request.body.country,
        affiliation: request.body.affiliation,
    });

    if (!user.username) {
        console.error('Error UserController.createUser: missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!user.password) {
        console.error('Error UserController.createUser: missing password parameter');
        apiResponseController.sendError('Password required.', 400, response);
        return;
    }

    if (!user.email) {
        console.error('Error UserController.createUser: missing email parameter');
        apiResponseController.sendError('Email required.', 400, response);
        return;
    }

    /*
    if (!user.firstName) {
        console.error('Error UserController.createUser: missing firstName parameter');
        apiResponseController.sendError('First Name required.', 400, response);
        return;
    }

    if (!user.lastName) {
        console.error('Error UserController.createUser: missing lastName parameter');
        apiResponseController.sendError('Last Name required.', 400, response);
        return;
    }

    if (!user.city) {
        console.error('Error UserController.createUser: missing city parameter');
        apiResponseController.sendError('City required.', 400, response);
        return;
    }

    if (!user.state) {
        console.error('Error UserController.createUser: missing state parameter');
        apiResponseController.sendError('State required.', 400, response);
        return;
    }

    if (!user.country) {
        console.error('Error UserController.createUser: missing country parameter');
        apiResponseController.sendError('Country required.', 400, response);
        return;
    }

    if (!user.affiliation) {
        console.error('Error UserController.createUser: missing affiliation parameter');
        apiResponseController.sendError('Affiliation required.', 400, response);
        return;
    }
    */

    agaveIO.createUser(user.getCreateUserAttributes())
        .then(function() {
            return agaveIO.getToken(user);
        })
        .then(function(userToken) {
            return agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token);
        })
        .then(function() {
            return agaveIO.createUserVerificationMetadata(user.username);
        })
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata.uuid) {
                var verificationId = userVerificationMetadata.uuid;

                return emailIO.sendWelcomeEmail(user.email, verificationId);
            }
            else {

                return Q.reject(new Error('Account creation fail. Unable to create verification metadata.'));
            }

        })
        .then(function(/*profileSuccess*/) {
            apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
        })
        .fail(function(error) {
            console.error('Error UserController.createUser: ' + JSON.stringify(error));
            apiResponseController.sendError(error.message, 500, response);
        });

};

UserController.changePassword = function(request, response) {
    var username = request.user.username;
    var password = request.body.password;
    var newPassword = request.body.newPassword;

    if (!username) {
        console.error('Error UserController.changePassword: missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!password) {
        console.error('Error UserController.changePassword: missing password parameter');
        apiResponseController.sendError('Password required.', 400, response);
        return;
    }

    if (!newPassword) {
        console.error('Error UserController.changePassword: missing newPassword parameter');
        apiResponseController.sendError('New Password required.', 400, response);
        return;
    }

    // 0.  Verify old password
    // 1.  Get user profile
    // 2.  Reset password
    // 3.  Response
    // 3a. Success
    // 3b. Fail
    var auth = {username: username, password: password};
    agaveIO.getToken(auth) // 0.
        .then(function(/*token*/) {
            // current password verified
            return agaveIO.getUserProfile(username); // 1.
        })
        .then(function(profile) {
            if (profile && profile[0] && profile[0].value && profile[0].value.email) {
                return agaveIO.updateUserPassword({ // 2.
                    'username': username,
                    'email': profile[0].value.email,
                    'password': newPassword,
                });
            }
            else {
                return Q.reject(new Error('Password change fail. User profile not found.'));
            }
        })
        .then(function() {
            apiResponseController.sendSuccess('Password changed successfully.', response); // 3a.
        })
        .fail(function(error) {
            console.error('Error UserController.changePassword: ' + JSON.stringify(error));
            apiResponseController.sendError(error.message, 500, response); // 3b.
        });
};

UserController.verifyUser = function(request, response) {

    var verificationId = request.params.verificationId;

    if (!verificationId) {
        console.error('Error UserController.verifyUser: missing verificationId parameter');
        apiResponseController.sendError('Verification Id required.', 400, response);
    }

    // First, check to see if this verificationId corresponds to this username
    agaveIO.getMetadata(verificationId)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && verificationId === userVerificationMetadata.uuid) {
                var username = userVerificationMetadata.value.username;
                return agaveIO.verifyUser(username, verificationId);
            }
            else {
                return Q.reject(new Error('Verification metadata failed comparison.'));
            }
        })
        .then(function() {
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('Error UserController.verifyUser: ' + JSON.stringify(error));
            apiResponseController.sendError(error.message, 500, response);
        });
};

UserController.resendVerificationEmail = function(request, response) {

    var username = request.params.username;

    if (!username) {
        console.error('Error UserController.resendVerificationEmail: missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
    }

    var verificationId = '';

    agaveIO.getUserVerificationMetadata(username)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === false) {
                verificationId = userVerificationMetadata[0].uuid;

                return agaveIO.getUserProfile(username);
            }
            else {
                return Q.reject(new Error('Verification metadata failed comparison.'));
            }
        })
        .then(function(profileMetadata) {
            if (profileMetadata && profileMetadata[0] && profileMetadata[0].value && profileMetadata[0].value.email) {
                return emailIO.sendWelcomeEmail(profileMetadata[0].value.email, verificationId);
            }
            else {
                return Q.reject(new Error('Resend verification email fail. User profile could not be found.'));
            }
        })
        .then(function() {
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('Error UserController.resendVerificationEmail: ' + JSON.stringify(error));
            apiResponseController.sendError(error.message, 500, response);
        });
};
