
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

    /*
      The service account should already have full pems
      So, go ahead and fetch project metadata pems
    */
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid)
	})
        .then(function(projectPermissions) {
	    // Apply project pems to new file
            console.log('PermissionsController.syncFilePermissionsWithProject - event - getMetadatapermissions for ' + projectUuid);

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        ServiceAccount.accessToken(),
                        projectUuid
                            + '/files'
                            + '/' + encodeURIComponent(filename),
			true
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
            return agaveIO.getFilePermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            console.log('PermissionsController.syncFilePermissionsWithProject - event - getFilePermissions for ' + projectUuid);
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            console.error('PermissionsController.syncFilePermissionsWithProject - error - projectUuid ' + projectUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid        = request.body.uuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

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
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.addUsernameToMetadataPermissions(ServiceAccount.username, accessToken, uuid);
	})
        // Next, fetch project metadata pems
	.then(function() {
            console.log('PermissionsController.syncMetadataPermissionsWithProject - event - add service account pems for project ' + projectUuid);
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
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
                    ServiceAccount.accessToken(),
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

            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), uuid);
        })
        // Finally send updated fileMetadata pems back to user
        .then(function(updatedFileMetadataPermissions) {
            console.log(
                'PermissionsController.syncMetadataPermissionsWithProject - event - complete for project ' + projectUuid
            );

            return apiResponseController.sendSuccess(updatedFileMetadataPermissions, response);
        })
        .fail(function(error) {
            console.error('PermissionsController.syncMetadataPermissionsWithProject - error - projectUuid ' + projectUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

//
// Add user to a project by giving them permissions on all of the project objects
// 1. project metadata
// 2. project files and subdirectories
// 3. project file metadata
// 4. project jobs
//
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

    var jobMetadatas;

    console.log('PermissionsController.addPermissionsForUsername - event - begin for project ' + projectUuid);

    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(accessToken, projectUuid);
	})
        // Add new username to project metadata pems
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - getMetadataPermissions for project ' + projectUuid);

            return agaveIO.addUsernameToMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
        })
        // set project file directory + subdirectory permissions recursively
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            return agaveIO.addUsernameToFullFilePermissions(username, ServiceAccount.accessToken(), projectUuid, true);
        })
        // get file metadata pems
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToFullFilePermissions for project ' + projectUuid);

            return agaveIO.getProjectFileMetadata(projectUuid);
        })
        // (loop) add to file metadata pems
        .then(function(projectFileMetadataPermissions) {
            console.log('PermissionsController.addPermissionsForUsername - event - getProjectFileMetadata for project ' + projectUuid);

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
                    ServiceAccount.accessToken(),
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // get jobs for project
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            //return agaveIO.getJobMetadataForProject(projectUuid);
            return agaveIO.getJobsForProject(projectUuid);
        })
        // (loop) add to job permissions
        .then(function(tmpJobMetadatas) {
            console.log('PermissionsController.addPermissionsForUsername - event - agaveIO.addUsernameToJobPermissions for project ' + projectUuid);

            // cache for later
            jobMetadatas = tmpJobMetadatas;

            var metadata = new MetadataPermissions();
            var uuids = metadata.getJobUuidsFromProjectResponse(jobMetadatas);

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
                    ServiceAccount.accessToken(),
                    uuids[i]
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // get all project associated metadata
        // TODO: this technically should be sufficient for all metadata except for the sole project metadata entry
        // but not currently as many old metadata entries are missing the associationId
        .then(function() {
            console.log('PermissionsController.addPermissionsForUsername - event - addUsernameToMetadataPermissions for project ' + projectUuid);

            return agaveIO.getAllProjectAssociatedMetadata(projectUuid);
        })
        // (loop) add permissions for user
        .then(function(allMetadatas) {
            console.log('PermissionsController.addPermissionsForUsername - event - getAllProjectAssociatedMetadata for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(allMetadatas);
	    //console.log(allMetadatas);
	    console.log(uuids.length);
	    console.log(uuids);

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
                    ServiceAccount.accessToken(),
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
            console.error('PermissionsController.addPermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error);
	    console.error(error.stack);
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

    console.log('PermissionsController.removePermissionsForUsername - event - begin for project ' + projectUuid);

    // check that token is on project
    // remove from project metadata pems
    // remove from file pems recursively
    // get file metadata pems
    // (loop) remove from file metadata pems

    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(accessToken, projectUuid);
	})
        // Add new username to project metadata pems
        .then(function() {
            console.log('PermissionsController.removePermissionsForUsername - event - getMetadataPermissions for project ' + projectUuid);

            return agaveIO.removeUsernameFromMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
        })
        // Remove project directory + subdirectory permissions recursively
        .then(function() {
            console.log(
                'PermissionsController.removePermissionsForUsername - event - removeUsernameFromMetadataPermissions for project ' + projectUuid
            );

            return agaveIO.removeUsernameFromFilePermissions(username, ServiceAccount.accessToken(), projectUuid);
        })
        // Get File Metadata pems
        .then(function() {
            console.log('PermissionsController.removePermissionsForUsername - event - removeUsernameFromFilePermissions for project ' + projectUuid);

            return agaveIO.getProjectFileMetadata(projectUuid);
        })
        // (loop) Remove from File Metadata pems
        .then(function(projectFileMetadataPermissions) {
            console.log('PermissionsController.removePermissionsForUsername - event - getProjectFileMetadata for project ' + projectUuid);

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
                    ServiceAccount.accessToken(),
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
            console.error('PermissionsController.removePermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error);
	    console.error(error.stack);
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

    var projectUsernames;

    console.log('PermissionsController.addPermissionsForJob - event - begin for job ' + jobUuid);

    // Add service account to job pems
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.addUsernameToJobPermissions(ServiceAccount.username, accessToken, jobUuid);
	})
        // Get project users
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
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
                    ServiceAccount.accessToken(),
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
                        path,
			true
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
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

            var jobMetaUuid = tmpJobMetadata.uuid;

            if (!jobMetaUuid || jobMetaUuid.length === 0) {
                jobMetaUuid = tmpJobMetadata[0].uuid;
            }

            var promises = [];

            function createAgaveCall(username, token, jobMetaUuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        jobMetaUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
                    jobMetaUuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('PermissionsController.addPermissionsForJob - event - addUsernameToMetadataPermissions for job ' + jobUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('PermissionsController.addPermissionsForJob - error - job ' + jobUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
