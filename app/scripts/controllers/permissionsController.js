
'use strict';

// Promises
var Q = require('q');

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount  = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Q = require('q');
var d3 = require('d3');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var PermissionsController = {};
module.exports = PermissionsController;

// Updates file permissions to match the given metadata permissions
// Intended to be used to make file pems match project metadata pems
PermissionsController.syncFilePermissionsWithProject = function(request, response) {

    var projectUuid = request.body.projectUuid;

    // TODO: change fileName to filename on backbone clients
    var filename = request.body.fileName;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.syncFilePermissionsWithProject - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!filename) {
        console.error('VDJ-API ERROR: PermissionsController.syncFilePermissionsWithProject - error - missing filename parameter');
        apiResponseController.sendError('Filename required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: PermissionsController.syncFilePermissionsWithProject - begin for ' + projectUuid);

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
            console.log('VDJ-API INFO: PermissionsController.syncFilePermissionsWithProject - getMetadatapermissions for ' + projectUuid);

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
            console.log('VDJ-API INFO: PermissionsController.syncFilePermissionsWithProject - addUsernameToFullFilePermissions for ' + projectUuid);
            return agaveIO.getFilePermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // Finally send updated file pems back to user
        .then(function(updatedFilePermissions) {
            console.log('VDJ-API INFO: PermissionsController.syncFilePermissionsWithProject - getFilePermissions for ' + projectUuid);
            return apiResponseController.sendSuccess(updatedFilePermissions, response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.syncFilePermissionsWithProject - error - projectUuid ' + projectUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid        = request.body.uuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!uuid) {
        console.error('VDJ-API ERROR: PermissionsController.syncMetadataPermissionsWithProject - error - missing metadataUuid parameter');
        apiResponseController.sendError('Metadata Uuid required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.syncMetadataPermissionsWithProject - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - begin for project ' + projectUuid);

    // First, make sure serviceAccount has full pems on the new metadata
    // Use the user's accessToken to set this since serviceAccount may not have full pems yet
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.addUsernameToMetadataPermissions(ServiceAccount.username, accessToken, uuid);
	})
        // Next, fetch project metadata pems
	.then(function() {
            console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - add service account pems for project ' + projectUuid);
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - getMetadataPermissions for project ' + projectUuid);

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
                'VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - addUsernameToMetadataPermissions for project ' + projectUuid
            );

            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), uuid);
        })
        // Finally send updated fileMetadata pems back to user
        .then(function(updatedFileMetadataPermissions) {
            console.log(
                'VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - complete for project ' + projectUuid
            );

            return apiResponseController.sendSuccess(updatedFileMetadataPermissions, response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.syncMetadataPermissionsWithProject - error - projectUuid ' + projectUuid + ', error ' + error);
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
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForUsername - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForUsername - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForUsername - error - missing accessToken parameter');
        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - begin for project ' + projectUuid);

    // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(accessToken, projectUuid);
	})
	.then(function() {
	    var projectData = { username: username, projectUuid: projectUuid };

	    taskQueue
		.create('addUsernameToProjectTask', projectData)
		.removeOnComplete(true)
		.attempts(5)
		.backoff({delay: 60 * 1000, type: 'fixed'})
		.save()
            ;

	    return apiResponseController.sendSuccess('ok', response);
	})
        .fail(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.addPermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error);
	    //console.error(error.stack);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.removePermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    var projectUsernames;

    if (!username) {
        console.error('VDJ-API ERROR: PermissionsController.removePermissionsForUsername - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.removePermissionsForUsername - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('VDJ-API ERROR: PermissionsController.removePermissionsForUsername - error - missing accessToken parameter');
        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - begin for project ' + projectUuid);

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
        // Remove username from project metadata pems
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - getMetadataPermissions for project ' + projectUuid);

	    // save usernames for sending emails later
	    var metadataPermissions = new MetadataPermissions();
	    projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            return agaveIO.removeUsernameFromMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
        })
        // Remove project directory + subdirectory permissions recursively
        .then(function() {
            console.log(
                'VDJ-API INFO: PermissionsController.removePermissionsForUsername - removeUsernameFromMetadataPermissions for project ' + projectUuid
            );

            return agaveIO.removeUsernameFromFilePermissions(username, ServiceAccount.accessToken(), projectUuid);
        })
        // get all project associated metadata
        // TODO: this technically should be sufficient for all metadata except for the sole project metadata entry
        // but not currently as many old metadata entries are missing the associationId
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - removeUsernameToFilePermissions for project ' + projectUuid);

            return agaveIO.getAllProjectAssociatedMetadata(projectUuid);
        })
        // (loop) Remove from File Metadata pems
        .then(function(projectMetadata) {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - getAllProjectAssociatedMetadata for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getUuidsFromMetadataResponse(projectMetadata);

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
        // get jobs for project
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - removeUsernameFromMetadataPermissions for project ' + projectUuid);

            return agaveIO.getJobsForProject(projectUuid);
        })
        // (loop) remove job permissions
        .then(function(jobMetadatas) {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - getJobsForProject for project ' + projectUuid);

            var metadata = new MetadataPermissions();
            var uuids = metadata.getJobUuidsFromProjectResponse(jobMetadatas);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.removeUsernameFromJobPermissions(
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
	    // send emails
	    var promises = projectUsernames.map(function(user) {
                return function() {
		    return agaveIO.getUserProfile(user)
			.then(function(userProfileList) {
			    if (userProfileList.length == 0) return;
			    if (username == agaveSettings.guestAccountKey) return;
			    var userProfile = userProfileList[0];
			    if (!userProfile.value.disableUserEmail) {
				var vdjWebappUrl = agaveSettings.vdjBackbone
				    + '/project/' + projectUuid;
				emailIO.sendGenericEmail(userProfile.value.email,
							 'VDJServer user removed from project',
							 'VDJServer user "' + username + '" has been removed from project ' + projectUuid + '.'
							 + '<br>'
							 + 'You can view the project with the link below:'
							 + '<br>'
							 + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
							);
			    }
			});
                };
	    });

	    return promises.reduce(Q.when, new Q());
	})
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - removeUsernameFromJobPermissions for project ' + projectUuid);
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - complete for project ' + projectUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.removePermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error);
	    //console.error(error.stack);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

PermissionsController.addPermissionsForJob = function(request, response) {

    var jobUuid = request.body.jobUuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!jobUuid) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing jobUuid parameter');

        apiResponseController.sendError('JobUuid required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing projectUuid parameter');

        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing accessToken parameter');

        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    var projectUsernames;

    console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - begin for job ' + jobUuid);

    // Add service account to job pems
    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.addUsernameToJobPermissions(ServiceAccount.username, accessToken, jobUuid);
	})
        // Get project users
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // (loop) add project users to job pems
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - getMetadataPermissions for job ' + jobUuid);

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
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);

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
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToFullFilePermissions for job ' + jobUuid);

            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadata) {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - getJobMetadataForProject for job ' + jobUuid);

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
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToMetadataPermissions for job ' + jobUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - job ' + jobUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
