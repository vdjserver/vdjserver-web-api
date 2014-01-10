
'use strict';

// App
var express = require('express');

// Controllers
var tokenController       = require('../controllers/tokenController');
var userController        = require('../controllers/userController');
var apiResponseController = require('../controllers/apiResponseController');

module.exports = function(app) {

    // noValidation
    var noValidation = express.basicAuth(function(userKey, userSecret, next) {
        console.log("noVal ok");
        next(null, userKey, userSecret);
    });



    // Request an Agave internalUsername token
    app.post('/token', noValidation, tokenController.getToken);

    // Refresh an Agave internalUsername token
    app.put('/token/*', noValidation, tokenController.refreshToken);

    // Delete an Agave internalUsername token
    app.delete('/token/*', noValidation, tokenController.deleteToken);


    // Create a user
    app.post('/user', userController.createUser);


    // Errors
    app.get('*', apiResponseController.send404);
    app.post('*', apiResponseController.send404);
    app.put('*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);
};
