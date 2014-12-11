
'use strict';

// Promises
var Q = require('q');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
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

    var projectUuid = request.body.projectUuid;

    var serviceAccount = new ServiceAccount();

    /*
       The service account should already have full pems
       So, go ahead and fetch project metadata pems
    */
    agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid)
        // Apply project pems to new file
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        serviceAccount.accessToken,
                        projectUuid
                    );
                }
            };

            for (var i = 0; i < projectUsernames.length; i++) {

                var username = projectUsernames[i];

                promises[i] = createAgaveCall(username);
            }

            return promises.reduce(Q.when, Q());
        })
        // Get file pems listing to return to user
        .then(function() {
            return agaveIO.getFilePermissions(serviceAccount.accessToken, projectUuid);
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
    var accessToken = request.user.password;

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
    var accessToken = request.user.password;

    var serviceAccount = new ServiceAccount();


    var jobMetadatas;


    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {


            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // set project file directory + subdirectory permissions recursively
        .then(function() {
            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // get file metadata pems
        .then(function() {
            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) add to file metadata pems
        .then(function(projectFileMetadataPermissions) {
            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

            var promises = [];
            for (var i = 0; i < uuids.length; i++) {
                promises.push(agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, uuids[i]));
            }

            return Q.all(promises);
        })
        // get job metadatas
        .then(function() {
            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadatas) {

            // cache for later
            jobMetadatas = tmpJobMetadatas;

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(tmpJobMetadatas);

            var promises = [];
            for (var i = 0; i < uuids.length; i++) {
                promises.push(
                    agaveIO.addUsernameToMetadataPermissions(
                        username,
                        serviceAccount.accessToken,
                        uuids[i]
                    )
                );
            }

            return Q.all(promises);
        })
        // (loop) add to job permissions
        .then(function() {

            var metadata = new MetadataPermissions();
            var uuids = metadata.getJobUuidsFromMetadataResponse(jobMetadatas);

            var promises = [];
            for (var i = 0; i < uuids.length; i++) {
                promises.push(
                    agaveIO.addUsernameToJobPermissions(
                        username,
                        serviceAccount.accessToken,
                        uuids[i]
                    )
                );
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
    var accessToken = request.user.password;

    var serviceAccount = new ServiceAccount();

    // check that token is on project
    // remove from project metadata pems
    // remove from file pems recursively
    // get file metadata pems
    // (loop) remove from file metadata pems


    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {
            return agaveIO.removeUsernameFromMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Remove project directory + subdirectory permissions recursively
        .then(function() {
            return agaveIO.removeUsernameFromFilePermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Get File Metadata pems
        .then(function() {
            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) Remove from File Metadata pems
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

PermissionsController.addPermissionsForJob = function(request, response) {

    var jobUuid = request.body.jobUuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    var serviceAccount = new ServiceAccount();

    var projectUsernames;

    // Add service account to job pems
    agaveIO.addUsernameToJobPermissions(serviceAccount.username, accessToken, jobUuid)
        // Get project users
        .then(function() {
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) add project users to job pems
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(agaveIO.addUsernameToJobPermissions(projectUsernames[i], serviceAccount.accessToken, jobUuid));
            }

            return Q.all(promises);
        })
        // (loop) set job output file permissions
        .then(function() {

            var promises = [];

            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(
                    agaveIO.addUsernameToFullFilePermissions(
                        projectUsernames[i],
                        serviceAccount.accessToken,
                        projectUuid + '/analyses'
                    )
                );
            }

            return Q.all(promises);
        })
        // get job metadatas
        .then(function() {
            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadata) {

            var jobUuid = tmpJobMetadata.uuid;

            if (!jobUuid || jobUuid.length === 0) {
                jobUuid = tmpJobMetadata[0].uuid;
            }

            var promises = [];

            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(
                    agaveIO.addUsernameToMetadataPermissions(
                        projectUsernames[i],
                        serviceAccount.accessToken,
                        jobUuid
                    )
                );
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
