
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var ProjectController = {};
module.exports = ProjectController;


// Creates a project and all initial directories
ProjectController.createProject = function(request, response) {

    var projectName = request.body.projectName;
    var username    = request.body.username;

    var serviceAccount = new ServiceAccount();

    var projectMetadata;
    var uuid;

    agaveIO.createProjectMetadata(projectName)
        .then(function(_projectMetadata) {

            // Save these for later
            projectMetadata = _projectMetadata;
            uuid = projectMetadata.uuid;

            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuid);
        })
        // create project/files directory
        .then(function() {
            return agaveIO.createProjectDirectory(uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            return agaveIO.createProjectDirectory(uuid + '/analyses');
        })
        // set project directory permissions recursively
        .then(function() {
            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, uuid);
        })
        .then(function() {
            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(projectMetadata, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};
