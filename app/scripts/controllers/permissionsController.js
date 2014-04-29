
'use strict';

// Promises
var Q = require('q');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var FileListing = require('../models/fileListing');
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount  = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var PermissionsController = {};
module.exports = PermissionsController;


// Updates file permissions to match the given metadata permissions
// Intended to be used to make file pems match project metadata pems
PermissionsController.syncFilePermissionsWithProject = function(request, response) {

    var fileName    = request.body.fileName;
    var projectUuid = request.body.projectUuid;

    var filePath = projectUuid + '/files/' + fileName;

    var serviceAccount = new ServiceAccount();

    /*
       The service account should already have full pems thanks to iRods.
       So, go ahead and fetch project metadata pems
    */
    agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid)
        // Apply project pems to new file
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(agaveIO.addUsernameToFullFilePermissions(projectUsernames[i], serviceAccount.accessToken, filePath));
            }

            return Q.all(promises);
        })
        // Get file pems listing to return to user
        .then(function() {
            return agaveIO.getFilePermissions(serviceAccount.accessToken, filePath);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid        = request.body.uuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.auth.password;

    var serviceAccount = new ServiceAccount();

    // First, make sure serviceAccount has full pems on the new metadata
    // Use the user's accessToken to set this since serviceAccount may not have full pems yet
    agaveIO.addUsernameToMetadataPermissions(serviceAccount.username, accessToken, uuid)
        // Next, fetch project metadata pems
        .then(function() {
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(agaveIO.addUsernameToMetadataPermissions(projectUsernames[i], serviceAccount.accessToken, uuid));
            }

            return Q.all(promises);
        })
        // Get fileMetadata pems listing to return to user
        .then(function() {
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, uuid);
        })
        // Finally send updated fileMetadata pems back to user
        .then(function(updatedFileMetadataPermissions) {
            return apiResponseController.sendSuccess(updatedFileMetadataPermissions, response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });

};

PermissionsController.addPermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.auth.password;

    var serviceAccount = new ServiceAccount();

    // check that token is on project
    // add to projectPems
    // get file listing
    // (loop) add to file pems
    // get file metadata pems
    // (loop) add to file metadata pems


    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {
            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Get file listing
        .then(function() {
            return agaveIO.getFileListings(serviceAccount.accessToken, projectUuid);
        })
        // Add new username to file pems
        .then(function(fileListingsResponse) {

            var fileListings = new FileListing();

            var paths = fileListings.getFilePaths(fileListingsResponse);


            var promises = [];
            for (var i = 0; i < paths.length; i++) {
                promises.push(agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, paths[i]));
            }

            return Q.all(promises);
        })
        .then(function() {
            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        .then(function(projectFileMetadataPermissions) {
            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

            var promises = [];
            for (var i = 0; i < uuids.length; i++) {
                promises.push(agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuids[i]));
            }

            return Q.all(promises);
        })
        .then(function() {
            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });
};

PermissionsController.removePermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.auth.password;

    var serviceAccount = new ServiceAccount();

    // check that token is on project
    // remove from projectPems
    // get file listing
    // (loop) remove from file pems
    // get file metadata pems
    // (loop) remove from file metadata pems


    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {
            return agaveIO.removeUsernameFromMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Get file listing
        .then(function() {
            return agaveIO.getFileListings(serviceAccount.accessToken, projectUuid);
        })
        // Add new username to file pems
        .then(function(fileListingsResponse) {

            var fileListings = new FileListing();

            var paths = fileListings.getFilePaths(fileListingsResponse);

            var promises = [];
            for (var i = 0; i < paths.length; i++) {
                promises.push(agaveIO.removeUsernameFromFilePermissions(username, serviceAccount.accessToken, paths[i]));
            }

            return Q.all(promises);
        })
        .then(function() {
            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        .then(function(projectFileMetadataPermissions) {
            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

            var promises = [];
            for (var i = 0; i < uuids.length; i++) {
                promises.push(agaveIO.removeUsernameFromMetadataPermissions(username, serviceAccount.accessToken, uuids[i]));
            }

            return Q.all(promises);
        })
        .then(function() {
            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response);
        });
};
