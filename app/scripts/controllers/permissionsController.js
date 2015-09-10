
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
var agaveIO = require('../vendor/agaveIO');

var PermissionsController = {};
module.exports = PermissionsController;

// Updates file permissions to match the given metadata permissions
// Intended to be used to make file pems match project metadata pems
PermissionsController.syncFilePermissionsWithProject = function(request, response) {

    var projectUuid = request.body.projectUuid;

    // TODO: change fileName to filename on backbone clients
    var filename = request.body.fileName;

    if (!projectUuid) {
        console.error('PermissionsController.syncFilePermissionsWithProject - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!filename) {
        console.error('PermissionsController.syncFilePermissionsWithProject - error - missing filename parameter');
        apiResponseController.sendError('Filename required.', 400, response);
        return;
    }

    console.log('PermissionsController.syncFilePermissionsWithProject - event - begin for ' + projectUuid);

    var serviceAccount = new ServiceAccount();

    /*
       The service account should already have full pems
       So, go ahead and fetch project metadata pems
    */
    agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid)
        // Apply project pems to new file
        .then(function(projectPermissions) {
            console.log('PermissionsController.syncFilePermissionsWithProject - event - getMetadatapermissions for ' + projectUuid);

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,

                        serviceAccount.accessToken,

                        projectUuid
                            + '/files'
                            + '/' + encodeURIComponent(filename)
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {

                var username = projectUsernames[i];

                promises[i] = createAgaveCall(username);
            }

            return promises.reduce(Q.when, new Q());
        })
        // Get file pems listing to return to user
        .then(function() {
            console.log('PermissionsController.syncFilePermissionsWithProject - event - addUsernameToFullFilePermissions for ' + projectUuid);
            return agaveIO.getFilePermissions(serviceAccount.accessToken, projectUuid);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            console.log('PermissionsController.syncFilePermissionsWithProject - event - getFilePermissions for ' + projectUuid);
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            console.error('PermissionsController.syncFilePermissionsWithProject - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid        = request.body.uuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    var serviceAccount = new ServiceAccount();

    if (!uuid) {
        console.error('PermissionsController.syncMetadataPermissionsWithProject - error - missing metadataUuid parameter');
        apiResponseController.sendError('Metadata Uuid required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('PermissionsController.syncMetadataPermissionsWithProject - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    console.log('PermissionsController.syncMetadataPermissionsWithProject - event - begin for project ' + projectUuid);

    // First, make sure serviceAccount has full pems on the new metadata
    // Use the user's accessToken to set this since serviceAccount may not have full pems yet
    agaveIO.addUsernameToMetadataPermissions(serviceAccount.username, accessToken, uuid)
        // Next, fetch project metadata pems
        .then(function() {
            console.log('PermissionsController.syncMetadataPermissionsWithProject - event - add service account pems for project ' + projectUuid);
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {
            console.log('PermissionsController.syncMetadataPermissionsWithProject - event - getMetadataPermissions for project ' + projectUuid);

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username, token, projectUuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        projectUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    serviceAccount.accessToken,
                    uuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // Get fileMetadata pems listing to return to user
        .then(function() {
            console.log(
                'PermissionsController.syncMetadataPermissionsWithProject - event - addUsernameToMetadataPermissions for project ' + projectUuid
            );

            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, uuid);
        })
        // Finally send updated fileMetadata pems back to user
        .then(function(updatedFileMetadataPermissions) {
            console.log(
                'PermissionsController.syncMetadataPermissionsWithProject - event - complete for project ' + projectUuid
            );

            return apiResponseController.sendSuccess(updatedFileMetadataPermissions, response);
        })
        .fail(function(error) {
            console.error('PermissionsController.syncMetadataPermissionsWithProject - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.addPermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!username) {
        console.error('PermissionsController.addPermissionsForUsername - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('PermissionsController.addPermissionsForUsername - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('PermissionsController.addPermissionsForUsername - error - missing accessToken parameter');
        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    var serviceAccount = new ServiceAccount();

    var jobMetadatas;

    console.log('PermissionsController.addPermissionsForUsername - event - begin for project ' + projectUuid);

    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - getMetadataPermissions for project ' + projectUuid);

            return agaveIO.addUsernameToMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // set project file directory + subdirectory permissions recursively
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            return agaveIO.addUsernameToFullFilePermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // get file metadata pems
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToFullFilePermissions for project ' + projectUuid);

            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) add to file metadata pems
        .then(function(projectFileMetadataPermissions) {
            console.log('PermissionsController.addPermissionsForUsername - event - getProjectFileMetadataPermissions for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

            var promises = [];

            function createAgaveCall(username, token, metadataUuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        metadataUuid
                    );
                };
            }

            for (var i = 0; i < uuids.length; i++) {
                promises[i] = createAgaveCall(
                    username,
                    serviceAccount.accessToken,
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // get job metadatas
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadatas) {
            console.log('PermissionsController.addPermissionsForUsername - event - getJobMetadataForProject for project ' + projectUuid);

            // cache for later
            jobMetadatas = tmpJobMetadatas;

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(tmpJobMetadatas);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var i = 0; i < uuids.length; i++) {
                promises[i] = createAgaveCall(
                    username,
                    serviceAccount.accessToken,
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // (loop) add to job permissions
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getJobUuidsFromMetadataResponse(jobMetadatas);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.addUsernameToJobPermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var i = 0; i < uuids.length; i++) {
                promises[i] = createAgaveCall(
                    username,
                    serviceAccount.accessToken,
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - complete for project ' + projectUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('PermissionsController.addPermissionsForUsername - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.removePermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!username) {
        console.error('PermissionsController.removePermissionsForUsername - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('PermissionsController.removePermissionsForUsername - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('PermissionsController.removePermissionsForUsername - error - missing accessToken parameter');
        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    var serviceAccount = new ServiceAccount();

    console.log('PermissionsController.removePermissionsForUsername - event - begin for project ' + projectUuid);

    // check that token is on project
    // remove from project metadata pems
    // remove from file pems recursively
    // get file metadata pems
    // (loop) remove from file metadata pems

    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    agaveIO.getMetadataPermissions(accessToken, projectUuid)
        // Add new username to project metadata pems
        .then(function() {
            console.log('PermissionsController.removePermissionsForUsername - event - getMetadataPermissions for project ' + projectUuid);

            return agaveIO.removeUsernameFromMetadataPermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Remove project directory + subdirectory permissions recursively
        .then(function() {
            console.log(
                'PermissionsController.removePermissionsForUsername - event - removeUsernameFromMetadataPermissions for project ' + projectUuid
            );

            return agaveIO.removeUsernameFromFilePermissions(username, serviceAccount.accessToken, projectUuid);
        })
        // Get File Metadata pems
        .then(function() {
            console.log('PermissionsController.removePermissionsForUsername - event - removeUsernameFromFilePermissions for project ' + projectUuid);

            return agaveIO.getProjectFileMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) Remove from File Metadata pems
        .then(function(projectFileMetadataPermissions) {
            console.log('PermissionsController.removePermissionsForUsername - event - getProjectFileMetadataPermissions for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.removeUsernameFromMetadataPermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var i = 0; i < uuids.length; i++) {
                promises[i] = createAgaveCall(
                    username,
                    serviceAccount.accessToken,
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log(
                'PermissionsController.removePermissionsForUsername - event - removeUsernameFromMetadataPermissions for project ' + projectUuid
            );

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('PermissionsController.removePermissionsForUsername - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.addPermissionsForJob = function(request, response) {

    var jobUuid = request.body.jobUuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!jobUuid) {
        console.error('PermissionsController.addPermissionsForJob - error - missing jobUuid parameter');

        apiResponseController.sendError('JobUuid required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('PermissionsController.addPermissionsForJob - error - missing projectUuid parameter');

        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('PermissionsController.addPermissionsForJob - error - missing accessToken parameter');

        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    var serviceAccount = new ServiceAccount();

    var projectUsernames;

    console.log('PermissionsController.addPermissionsForJob - event - begin for job ' + jobUuid);

    // Add service account to job pems
    agaveIO.addUsernameToJobPermissions(serviceAccount.username, accessToken, jobUuid)
        // Get project users
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        // (loop) add project users to job pems
        .then(function(projectPermissions) {
            console.log('PermissionsController.addPermissionsForJob - event - getMetadataPermissions for job ' + jobUuid);

            var filePermissions = new FilePermissions();

            projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username, token, jobUuid) {

                return function() {

                    return agaveIO.addUsernameToJobPermissions(
                        username,
                        token,
                        jobUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    serviceAccount.accessToken,
                    jobUuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // (loop) set job output file permissions
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);

            var promises = [];

            function createAgaveCall(username, token, path) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        token,
                        path
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    serviceAccount.accessToken,
                    projectUuid + '/analyses'
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // get job metadatas
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToFullFilePermissions for job ' + jobUuid);

            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadata) {
            console.log('PermissionsController.addPermissionsForJob - event - getJobMetadataForProject for job ' + jobUuid);

            var jobUuid = tmpJobMetadata.uuid;

            if (!jobUuid || jobUuid.length === 0) {
                jobUuid = tmpJobMetadata[0].uuid;
            }

            var promises = [];

            function createAgaveCall(username, token, jobUuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        jobUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    serviceAccount.accessToken,
                    jobUuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToMetadataPermissions for job ' + jobUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('PermissionsController.addPermissionsForJob - error - ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
