
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

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
        state:      request.body.state
    });


    agaveIO.createUser(user.getCreateUserAttributes())
        .then(function(createdUser) {
            return agaveIO.getToken(createdUser);
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
