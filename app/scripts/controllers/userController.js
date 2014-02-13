
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Utilities
var _ = require('underscore');

var UserController = {};
module.exports = UserController;


UserController.createUser = function(request, response) {

/*
    if (!request.body.username || !request.body.password || !request.body.email || !request.body.firstName || !request.body.lastName) {
        apiResponseController.sendError('Username, password, email, first name and last name are required to create new accounts.');
    }
*/
    var user = new User();

    user.username  = request.body.username;
    user.password  = request.body.password;

    user.email     = request.body.email;
    user.firstName = request.body.firstName;
    user.lastName  = request.body.lastName;
    user.city      = request.body.city;
    user.state     = request.body.state;

    var serviceAccount = new ServiceAccount();

    // 1.) get VDJAuth token
    agaveIO.getToken(serviceAccount, function(error, vdjauthToken) {

        if (error) {
            apiResponseController.sendError('Error 1 - Unable to create account for "' + user.username + '"', response);
        }
        else {

            serviceAccount.setToken(vdjauthToken);

            // 2.) create user
            agaveIO.createUser(user.getCreateUserAttributes(), serviceAccount, function(error, newUser) {

                if (error) {
                    apiResponseController.sendError('Error 2 - Unable to create account for "' + user.username + '"', response);
                }
                else {

                    // 3.) get user token
                    agaveIO.getToken(user, function(error, userToken) {

                        /*
                            Even if there's an error at this point, at least
                            the user has been created, so send success.

                            Worst case scenario is that they'll have to manually
                            update their profile.

                            They can't go back through account creation since
                            their username is already taken at this point anyway.

                            Just let them pass through.
                        */
                        if (error) {
                            apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
                        }
                        else {

                            // 4.) post user profile data
                            agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token, function(error, profile) {

                                if (error) {

                                    apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
                                }
                                else {

                                    apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
                                }
                            });
                        }
                    });
                }
            });
        }
    });

};
