
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var FilePermissions = require('../models/filePermissions');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var PermissionsController = {};
module.exports = PermissionsController;


// Updates file permissions to match the given metadata permissions
// Intended to be used to make file pems match project metadata pems
PermissionsController.syncFilePermissionsWithProject = function(request, response) {

    var fileName    = request.params.fileName;
    var projectUuid = request.params.projectUuid;
    var accessToken = request.auth.password;

    var filePath = '/' + projectUuid + '/files/' + fileName;
    console.log("filePath is: " + fileName);
    console.log("accessToken is: " + accessToken);
    console.log("projectUuid is: " + projectUuid);


    var serviceAccount = new ServiceAccount();

    // First, make sure vdjauth has full pems
    // Use the user's accessToken to set this since vdjauth may not have full pems yet
    agaveIO.addUsernameToFullFilePermissions(serviceAccount.username, accessToken, filePath)
        // Next, fetch project metadata pems
        .then(function() {
            console.log("check 1 ok");
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // Apply project pems to new file
        .then(function(metadataPermissions) {
            console.log("permissions are: " + JSON.stringify(metadataPermissions))

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(metadataPermissions);
            console.log("projUsernames are: " + JSON.stringify(projectUsernames));
            
            for (var i = 0; i < projectUsernames.length; i++) {
                agaveIO.addUsernameToLimitedFilePermissions(projectUsernames[i], serviceAccount.accessToken, filePath);
            };

            console.log("ending long function");
        })
        // Get file pems listing to return to user
        .then(function() {
            console.log("fetching new file pems");
            return agaveIO.getFilePermissions(serviceAccount.accessToken, filePath);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            console.log("new file pems are: " + updatedFilePermissions);
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid = request.params.uuid;
    var projectUuid = request.params.projectUuid;
    var accessToken = request.auth.password;

    var filePath = '/' + projectUuid + '/files/' + fileName;
    console.log("filePath is: " + fileName);
    console.log("accessToken is: " + accessToken);
    console.log("projectUuid is: " + projectUuid);


    var serviceAccount = new ServiceAccount();
/*
    // First, make sure vdjauth has full pems
    // Use the user's accessToken to set this since vdjauth may not have full pems yet
    agaveIO.addUsernameToFullFilePermissions(serviceAccount.username, accessToken, filePath)
        // Next, fetch project metadata pems
        .then(function() {
            console.log("check 1 ok");
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // Apply project pems to new file
        .then(function(metadataPermissions) {
            console.log("permissions are: " + JSON.stringify(metadataPermissions))

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(metadataPermissions);
            console.log("projUsernames are: " + JSON.stringify(projectUsernames));
            
            for (var i = 0; i < projectUsernames.length; i++) {
                agaveIO.addUsernameToLimitedFilePermissions(projectUsernames[i], serviceAccount.accessToken, filePath);
            };

            console.log("ending long function");
        })
        // Get file pems listing to return to user
        .then(function() {
            console.log("fetching new file pems");
            return agaveIO.getFilePermissions(serviceAccount.accessToken, filePath);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            console.log("new file pems are: " + updatedFilePermissions);
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });
*/
};
