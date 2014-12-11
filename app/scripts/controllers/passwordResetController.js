
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Q = require('q');


var PasswordResetController = {};
module.exports = PasswordResetController;

PasswordResetController.createResetPasswordRequest = function(request, response) {

    var username = request.body.username, userProfile;

    // 1.  Get confirm username, email address from user profile
    // 2.  Generate random key by posting to metadata
    // 3.  Send email
    // 4a. Send response success
    // 4b. Send response error
    agaveIO.getUserProfile(username) // 1.
        .then(function(profile) {
            if (profile[0]) {
                userProfile = profile[0];
                return agaveIO.createPasswordResetMetadata(username); // 2.
            } else {
                return Q.reject(new Error('Password reset fail. Username unknown.'));
            }
        })
        .then(function(passwordReset) {
            return emailIO.sendPasswordResetEmail(userProfile.value.email, passwordReset.uuid); // 3.
        })
        .then(function() {
            apiResponseController.sendSuccess('Password reset email sent.', response); // 4a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response); // 4b.
        });
};

PasswordResetController.processResetPasswordRequest = function(request, response) {

    var username = request.body.username;
    var uuid = request.body.uuid;
    var newPassword = request.body.newPassword;
    var passwordReset;

    // 1.  Get password reset metadata for given uuid
    // 2.  Verify password reset uuid and matching username
    // 3.  Get user profile
    // 4.  Update user with new password
    // 5.  Delete password reset metadata
    // 5a. Report error if delete fails
    // 6.  Response
    // 6a. Success
    // 6b. Error
    agaveIO.getPasswordResetMetadata(uuid) // 1.
        .then(function(passwordResetMetadata) {
            if (username === passwordResetMetadata[0].value.username) { // 2.
                passwordReset = passwordResetMetadata[0];
                return agaveIO.getUserProfile(username); // 3.
            }
            else {
                return Q.reject(new Error('Password reset fail. Uuid does not match.'));
            }
        })
        .then(function(profile) {
            return agaveIO.updateUserPassword({'username': username, 'email': profile[0].value.email, 'password': newPassword}); // 4.
        })
        .then(function() {
            /*
                while metadata is deleted, service returns 500 error;
                don't let this short-circuit the process
            */
            agaveIO.deleteMetadata(passwordReset.uuid) // 5.
                .fail(function(error) { // 5a.
                    console.error(error.message, error);
                });
        })
        .then(function() {
            apiResponseController.sendSuccess('Password reset successfully.', response); // 6a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response); // 6b.
        });

};
