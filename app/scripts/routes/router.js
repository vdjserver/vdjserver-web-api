
'use strict';

// App
var express = require('express');

// Controllers
var apiResponseController = require('../controllers/apiResponseController');
var passwordResetController = require('../controllers/passwordResetController');
var permissionsController = require('../controllers/permissionsController');
var projectController     = require('../controllers/projectController');
var tokenController       = require('../controllers/tokenController');
var userController        = require('../controllers/userController');

module.exports = function(app) {

    // noValidation
    var noValidation = express.basicAuth(function(userKey, userSecret, next) {
        next(null, userKey, userSecret);
    });

    app.get('/', apiResponseController.confirmUpStatus);

    // Create a project
    app.post('/projects', projectController.createProject);

    // Update file permissions
    app.post('/permissions/files', noValidation, permissionsController.syncFilePermissionsWithProject);

    // Update metadata permissions
    app.post('/permissions/metadata', noValidation, permissionsController.syncMetadataPermissionsWithProject);

    // Add permissions for new user
    app.post('/permissions/username', noValidation, permissionsController.addPermissionsForUsername);

    // Remove all permissions for user
    app.delete('/permissions/username', noValidation, permissionsController.removePermissionsForUsername);

    // Request an Agave internalUsername token
    app.post('/token', noValidation, tokenController.getToken);

    // Refresh an Agave internalUsername token
    app.put('/token/*', noValidation, tokenController.refreshToken);

    // Delete an Agave internalUsername token
    app.delete('/token/*', noValidation, tokenController.deleteToken);

    // Create a user
    app.post('/user', userController.createUser);

    // Initiate Password Reset
    app.post('/user/reset-password', passwordResetController.createResetPasswordRequest);

    // Verify Password Reset
    app.post('/user/reset-password/verify', passwordResetController.processResetPasswordRequest);

    // Errors
    app.get('*', apiResponseController.send404);
    app.post('*', apiResponseController.send404);
    app.put('*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);
};
