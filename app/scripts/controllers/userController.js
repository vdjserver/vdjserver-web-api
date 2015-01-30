
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');
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
            apiResponseController.sendError(error.message, 500, response);
        });

};

UserController.changePassword = function(request, response) {
    var username = request.user.username;
    var password = request.body.password;
    var newPassword = request.body.newPassword;

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
                    'password': newPassword});
            } else {
                return Q.reject(new Error('Password change fail. User profile not found.'));
            }
        })
        .then(function() {
            apiResponseController.sendSuccess('Password changed successfully.', response); // 3a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, 500, response); // 3b.
        });
};

UserController.verifyUser = function(request, response) {

    var verificationId = request.params.verificationId;

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
            apiResponseController.sendError(error.message, 500, response);
        });
};

UserController.resendVerificationEmail = function(request, response) {

    var username = request.params.username;

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
            apiResponseController.sendError(error.message, 500, response);
        });
};
