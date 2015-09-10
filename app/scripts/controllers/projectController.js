
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');

var ProjectController = {};
module.exports = ProjectController;

// Creates a project and all initial directories
ProjectController.createProject = function(request, response) {

    var projectName = request.body.projectName;
    var username    = request.body.username;

    if (!projectName) {
        console.error('ProjectController.createProject - error - missing projectName parameter');
        apiResponseController.sendError('Project name required.', 400, response);
        return;
    }

    if (!username) {
        console.error('ProjectController.createProject - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    var serviceAccount = new ServiceAccount();

    var projectMetadata;
    var uuid;

    console.log('ProjectController.createProject - event - begin for username: ' + username + ', project name: ' + projectName);

    agaveIO.createProjectMetadata(projectName)
        .then(function(_projectMetadata) {
            console.log('ProjectController.createProject - event - metadata for username: ' + username + ', project name: ' + projectName);

            // Save these for later
            projectMetadata = _projectMetadata;
            uuid = projectMetadata.uuid;

            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuid);
        })
        // create project/files directory
        .then(function() {
            console.log('ProjectController.createProject - event - metadata pems for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            console.log('ProjectController.createProject - event - files dir for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/analyses');
        })
        // create project/deleted directory
        .then(function() {
            console.log('ProjectController.createProject - event - analyses dir for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/deleted');
        })
        // set project directory permissions recursively
        .then(function() {
            console.log('ProjectController.createProject - event - dir pems for username: ' + username + ', project name: ' + projectName);

            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, uuid);
        })
        .then(function() {
            console.log('ProjectController.createProject - event - complete for username: ' + username + ', project name: ' + projectName);

            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(projectMetadata, response);
        })
        .fail(function(error) {
            console.error('ProjectController.createProject - error - username ' + username + ', project name ' + projectName + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
