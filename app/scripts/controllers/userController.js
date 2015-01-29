
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
            console.log("userVerificationMeta is: " + JSON.stringify(userVerificationMetadata));
            if (userVerificationMetadata[0]) {
                var verificationId = userVerificationMetadata[0].uuid;
                console.log("verificationId is: " + verificationId);

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
            apiResponseController.sendError(error.message, response);
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
            apiResponseController.sendError(error.message, response); // 3b.
        });
};

UserController.verifyUser = function(request, response) {

    var verificationId = request.params.verificationId;

    // First, check to see if this verificationId corresponds to this username
    agaveIO.getMetadata(verificationId)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata[0] && verificationId === userVerificationMetadata[0].uuid) {
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
            apiResponseController.sendError(error.message, response);
        });
};

UserController.resendVerificationEmail = function(request, response) {

    var verificationId = request.params.verificationId;
    var profile = {};
    var username = '';

    agaveIO.getMetadata(verificationId)
        .then(function(userVerificationMetadata) {
            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].isVerified === false) {
                username = userVerificationMetadata.value.username;

                return agaveIO.getUserProfile(username);
            }
            else {
                return Q.reject(new Error('Verification metadata failed comparison.'));
            }
        })
        .then(function(profileMetadata) {
            if (profileMetadata && profileMetadata[0] && profileMetadata[0].value && profileMetadata[0].value.email) {
                profile = profileMetadata;

                return agaveIO.getUserVerificationMetadata(username);
            }
            else {
                return Q.reject(new Error('Resend verification email fail. User profile could not be found.'));
            }
        })
        .then(function(userVerificationMetadata) {
            console.log("userVerificationMeta is: " + JSON.stringify(userVerificationMetadata));

            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === false) {
                var verificationId = userVerificationMetadata[0].uuid;
                console.log("verificationId is: " + verificationId);

                return emailIO.sendWelcomeEmail(profile[0].value.email, verificationId);
            }
            else {
                return Q.reject(new Error('Resend verification email fail. Unable to find verification metadata.'));
            }
        })
        .then(function() {
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });
};
