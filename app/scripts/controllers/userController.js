
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
            return agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token)
        })
        .then(function(profileSuccess) {
            apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};
