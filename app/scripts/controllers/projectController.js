
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

    var createdProjectPlaceholder;

    agaveIO.createProject(projectName)
        .then(function(createdProject) {

            createdProjectPlaceholder = createdProject;

            var uuid = createdProject['uuid'];
            var serviceAccount = new ServiceAccount();

            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuid);
        })
/*
 * create initial project dirs?
        .then(function() {
        
        })
*/
        .then(function() {
            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(createdProjectPlaceholder, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};
