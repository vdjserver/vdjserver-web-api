
'use strict';

// App
var express = require('express');

// Controllers
var tokenController       = require('../controllers/tokenController');
var userController        = require('../controllers/userController');
var projectController     = require('../controllers/projectController');
var apiResponseController = require('../controllers/apiResponseController');

module.exports = function(app) {

    // noValidation
    var noValidation = express.basicAuth(function(userKey, userSecret, next) {
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


    // Create a project
    app.post('/project', noValidation, projectController.createProject);

    // Errors
    app.get('*', apiResponseController.send404);
    app.post('*', apiResponseController.send404);
    app.put('*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);
};
