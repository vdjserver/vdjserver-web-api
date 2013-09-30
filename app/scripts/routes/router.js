
// App
var express = require ('express');

// Controllers
var authController         = require('../controllers/authController');
var tokenController        = require('../controllers/tokenController');
var internalUserController = require('../controllers/internalUserController');
var profileController      = require('../controllers/profileController');
var apiResponseController  = require('../controllers/apiResponseController');

module.exports = function(app) {


    // Verify user credentials via Agave
    var passwordAuth = express.basicAuth(function(username, password, next) {

        authController.validateCredentials(username, password, function(validity) {

            if (validity === true) {
                next(null, username);
            }
            else {
                next('error');
            }

        });

    });

    // tokenAuth
    var tokenAuth = express.basicAuth(function(username, token, next) {

        authController.validateToken(username, token, function(validity) {

            if (validity === true) {
                next(null, username, token);
            }
            else {
                next('error');
            }

        });

    });

    // tokenAuthNoValidation
    var tokenAuthNoValidation = express.basicAuth(function(username, token, next) {
        next(null, username, token);
    });

    // Create a new account
    app.post('/user', internalUserController.createInternalUser);



    // Request an Agave internalUsername token
    app.post('/token', passwordAuth, tokenController.createInternalUserToken);

    // Refresh an Agave internalUsername token
    app.put('/token/*', tokenAuthNoValidation, tokenController.refreshInternalUserToken);

    // Delete an Agave internalUsername token
    //app.delete('/token/*', tokenAuthNoValidation, tokenController.deleteInternalUserToken);



    // View user profile
    app.get('/user/profile', tokenAuth, profileController.getUserProfile);

    // Update user profile
    app.post('/user/profile', tokenAuth, profileController.updateUserProfile);


    // Errors
    app.get(   '*', apiResponseController.send404);
    app.post(  '*', apiResponseController.send404);
    app.put(   '*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);

};
