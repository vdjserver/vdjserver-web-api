
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Q = require('q');

var PasswordResetController = {};
module.exports = PasswordResetController;

PasswordResetController.createResetPasswordRequest = function(request, response) {

    var username = request.body.username;

    if (!username) {
        console.error('PasswordResetController.createResetPasswordRequest - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    console.log('PasswordResetController.createResetPasswordRequest - event - begin for user ' + username);

    var userProfile;

    // 1.  Get confirm username, email address from user profile
    // 2.  Generate random key by posting to metadata
    // 3.  Send email
    // 4a. Send response success
    // 4b. Send response error
    agaveIO.getUserProfile(username) // 1.
        .then(function(profile) {
            console.log('PasswordResetController.createResetPasswordRequest - event - getUserProfile for user ' + username);

            if (profile[0]) {
                userProfile = profile[0];
                return agaveIO.createPasswordResetMetadata(username); // 2.
            }
            else {
                return Q.reject(new Error('PasswordResetController.createResetPasswordRequest - error - username unknown for ' + username));
            }
        })
        .then(function(passwordReset) {
            console.log('PasswordResetController.createResetPasswordRequest - event - createPasswordResetMetadata for user ' + username);

            return emailIO.sendPasswordResetEmail(userProfile.value.email, passwordReset.uuid); // 3.
        })
        .then(function() {
            console.log('PasswordResetController.createResetPasswordRequest - event - sendPasswordResetEmail for user ' + username);

            apiResponseController.sendSuccess('Password reset email sent.', response); // 4a.
        })
        .fail(function(error) {
            console.error('PasswordResetController.createResetPasswordRequest - error - username ' + username + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response); // 4b.
        })
        ;
};

PasswordResetController.processResetPasswordRequest = function(request, response) {

    var username = request.body.username;
    var uuid = request.body.uuid;
    var newPassword = request.body.newPassword;

    if (!username) {
        console.error('PasswordResetController.processResetPasswordRequest - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!uuid) {
        console.error('PasswordResetController.processResetPasswordRequest - error - missing uuid parameter');
        apiResponseController.sendError('Password reset id required.', 400, response);
        return;
    }

    if (!newPassword) {
        console.error('PasswordResetController.processResetPasswordRequest - error - missing newPassword parameter');
        apiResponseController.sendError('New password required.', 400, response);
        return;
    }

    console.log('PasswordResetController.processResetPasswordRequest - event - begin for user ' + username);

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
            console.log('PasswordResetController.processResetPasswordRequest - event - getPasswordResetMetadata for user ' + username);

            if (username === passwordResetMetadata[0].value.username) { // 2.
                passwordReset = passwordResetMetadata[0];
                return agaveIO.getUserProfile(username); // 3.
            }
            else {
                return Q.reject(new Error('PasswordResetController.processResetPasswordRequest - error - reset metadata uuid does not match.'));
            }
        })
        .then(function(profile) {
            console.log('PasswordResetController.processResetPasswordRequest - event - getUserProfile for user ' + username);

            return agaveIO.updateUserPassword({
                'username': username,
                'email': profile[0].value.email,
                'password': newPassword
            }); // 4.
        })
        .then(function() {
            console.log('PasswordResetController.processResetPasswordRequest - event - updateUserPassword for user ' + username);

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
            console.log('PasswordResetController.processResetPasswordRequest - event - deleteMetadata for user ' + username);

            apiResponseController.sendSuccess('Password reset successfully.', response); // 6a.
        })
        .fail(function(error) {
            console.error('PasswordResetController.processResetPasswordRequest - error - username ' + username + ', error ' + error);

            apiResponseController.sendError(error.message, 500, response); // 6b.
        })
        ;
};
