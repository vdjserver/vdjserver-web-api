
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

    var username = request.auth.username;

    // Generate random key by posting to metadata
    // Get email address from user profile
    // Send email
    
    agaveIO.createPasswordResetMetadata(username)
        .then(function() {
            return agaveIO.getUserProfile(username);
        })
        .then(function(profile) {
            console.log("profile is: " + JSON.stringify(profile));
            return emailIO.sendPasswordResetEmail(profile[0].value.email, profile[0].uuid);
        })
        .then(function() {
            apiResponseController.sendSuccess('Password reset email sent.', response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

PasswordResetController.processResetPasswordRequest = function(request, response) {

    var username = request.body.username;
    var uuid = request.body.uuid;
    var newPassword = request.body.newPassword;

    // Verify random key by searching metadata for value
    // Delete metadata
    // Reset password
    agaveIO.getPasswordResetMetadata(uuid)
        .then(function(passwordResetMetadata) {
            if (username === passwordResetMetadata.value.username) {
                return agaveIO.deleteMetadata(uuid);
            }
            else {
                return Q.reject(new Error('Password reset fail. Uuid does not match.'));
            }
        })
        .then(function() {
            return agaveIO.getUserProfile(username);
        })
        .then(function(profile) {
            return agaveIO.updateUserPassword({'username': username, 'email': profile[0].value.email, 'password': newPassword});
        })
        .then(function() {
            apiResponseController.sendSuccess('Password reset successfully.', response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });
    
};
