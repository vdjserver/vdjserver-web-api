
// App
var express = require ('express');

// Controllers
var authController         = require('../controllers/authController');
var tokenController        = require('../controllers/tokenController');
var internalUserController = require('../controllers/internalUserController');
var apiResponseController  = require('../controllers/apiResponseController');

// Models
var AppCredentials = require('../models/appCredentials');

module.exports = function(app) {


    // Verify user credentials via Agave
    var auth = express.basicAuth(function(username, password, next) {

        var appCredentials = new AppCredentials();
        appCredentials.username = username;
        appCredentials.password = password;

        authController.validateCredentials(appCredentials, function(validity) {

            if (validity === true) {
                next(null, appCredentials);
            }
            else {
                next('error');
            }

        });

    });



    // Request an Agave internalUsername token
    app.post('/token', auth, tokenController.getInternalUserToken);

    // Refresh an Agave internalUsername token
    app.put('/token/*', auth, tokenController.refreshInternalUserToken);

    // Create a new account
    app.post('/user', internalUserController.createInternalUser);

    // Update user profile
    app.post('/user/profile', auth, internalUserController.updateUserProfile);


    // Errors
    app.get(   '*', apiResponseController.send404);
    app.post(  '*', apiResponseController.send404);
    app.put(   '*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);

};
