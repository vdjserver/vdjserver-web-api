
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Node Libraries
var exec = require('child_process').exec;

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
            return exec(__dirname + '/../bash/create-irods-account.sh ' + user.username, function(error, stdout, stderr) {
                console.log("script stderr is: " + stderr);
                console.log("script stdout is: " + stdout);

                if (error !== null) {
                    return Q.reject(new Error('Account creation fail - iRods'));
                }

                return;
            });
        })
        .then(function() {
            return agaveIO.getToken(user);
        })
        .then(function(userToken) {
            return agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token);
        })
        .then(function(/*profileSuccess*/) {
            apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

UserController.changePassword = function(request, response) {
    var username = request.user.username,
        password = request.body.password,
        newPassword = request.body.newPassword;

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
