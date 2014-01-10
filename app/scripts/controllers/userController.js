
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Settings
var agaveSettings = require('../config/agaveSettings');

var UserController = {};
module.exports = UserController;


UserController.createUser = function(request, response) {

    console.log("request body is: " + JSON.stringify(request.body));
/*
    if (!request.body.username || !request.body.password || !request.body.email || !request.body.firstName || !request.body.lastName) {
        apiResponseController.sendError('Username, password, email, first name and last name are required to create new accounts.');
    }
*/
    var user = new User();
    /*
    user.firstName = request.body.firstName;
    user.lastName  = request.body.lastName;
    */

    user.email     = request.body.email;
    user.password  = request.body.password;
    user.username  = request.body.username;



    var serviceAccountCredentials = {
        username: agaveSettings.serviceAccountKey,
        password: agaveSettings.serviceAccountSecret
    };

    agaveIO.getToken(serviceAccountCredentials, function(error, newToken) {

        if (error) {
            apiResponseController.sendError('Error 1 - Unable to create account for "' + request.body.username + '"', response);
        }
        else {
            agaveSettings.serviceAccountToken = newToken.access_token;

            agaveIO.createUser(user, function(error, newUser) {

                if (error) {
                    apiResponseController.sendError('Error 2 - Unable to create account for "' + request.body.username + '"', response);
                }
                else {

                    var userAccountCredentials = {
                        username: user.password,
                        email: user.email
                    };
                    apiResponseController.sendSuccess(userAccountCredentials, response);
                }

            });
        }

    });



};
