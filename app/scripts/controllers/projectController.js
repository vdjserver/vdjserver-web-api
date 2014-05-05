
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

    var createdProjectPlaceholder;

    agaveIO.createProject(projectName)
        .then(function(createdProject) {

            createdProjectPlaceholder = createdProject;

            var uuid = createdProject['uuid'];

            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuid);
        })
        // create project directory
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            return agaveIO.createProjectDirectory(uuid);
        })
        // set project directory permissions
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            //return agaveIO.createProjectDirectory(uuid);
            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, uuid);
        })
        // create project/files directory
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            return agaveIO.createProjectDirectory(uuid + '/files');
        })
        // set project/files directory permissions
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            //return agaveIO.createProjectDirectory(uuid);
            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            return agaveIO.createProjectDirectory(uuid + '/analyses');
        })
        // set project/analyses directory permissions
        .then(function() {
            var uuid = createdProjectPlaceholder['uuid'];
            //return agaveIO.createProjectDirectory(uuid);
            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, uuid + '/analyses');
        })
        .then(function() {
            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(createdProjectPlaceholder, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};
