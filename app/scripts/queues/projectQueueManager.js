
'use strict';

//
// projectQueueManager.js
// Manage project tasks
//
// VDJServer Analysis Portal
// VDJ Web API service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var ProjectQueueManager = {};
module.exports = ProjectQueueManager;

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Models
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');
var Job = require('../models/job');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var jsonApprover = require('json-approver');
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

ProjectQueueManager.processProjects = function() {

/*
    // Publishing a project to community data
    //
    // 1. Move project files to community data
    // 2. Move job output files to community data
    // 3. Set permissions on metadata
    // 4. Update project metadata to public

    taskQueue.process('publishProjectMoveFilesTask', function(task, done) {
	// 1. Move project files to community data

	// This assumes that moving a file on the storage system does not
	// change the UUID thus the metadata entries do not need to be updated.
	// This seems to be true if moving individual files, but does not hold
	// for moving directories.
	//
	// Permissions are set when the file is moved.

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectMoveFilesTask.');

        // create community/files directory
	agaveIO.createCommunityDirectory(projectUuid + '/files')
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.publishProject, created files directory for community data uuid: ' + projectUuid);

		// create community/analyses directory
		return agaveIO.createCommunityDirectory(projectUuid + '/analyses');
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.publishProject, created analyses directory for community data uuid: ' + projectUuid); 

		return agaveIO.getProjectFiles(projectUuid);
            })
            .then(function(projectFiles) {
		console.log('VDJ-API INFO: ProjectController.publishProject, moving project files (' + projectFiles.length + ' files) for community data uuid: ' + projectUuid);
		var promises = projectFiles.map(function(entry) {
                    return function() {
			return agaveIO.moveProjectFileToCommunity(projectUuid, entry.value.name, true);
		    }
		});

		return promises.reduce(Q.when, new Q());
	    })
            .then(function() {
                taskQueue
                    .create('publishProjectMoveJobsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectMoveFilesTask.');
                done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - publishProjectMoveFilesTask - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            })
            ;
    });

    taskQueue.process('publishProjectMoveJobsTask', function(task, done) {
	// 2. Move job output files to community data

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectMoveJobsTask.');

        // get jobs (this leaves behind the archived jobs)
	agaveIO.getJobMetadataForProject(projectUuid)
            .then(function(jobMetadata) {
		console.log('VDJ-API INFO: ProjectController.publishProject, moving job data (' + jobMetadata.length + ' jobs) for community data uuid: ' + projectUuid);
		var promises = jobMetadata.map(function(entry) {
                    return function() {
			return agaveIO.moveJobToCommunity(projectUuid, entry.value.jobUuid, true);
		    }
		});

		return promises.reduce(Q.when, new Q());
            })
            .then(function() {
                taskQueue
                    .create('publishProjectSetMetadataPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectMoveJobsTask.');
                done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - publishProjectMoveJobsTask - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            })
            ;
    });

    taskQueue.process('publishProjectSetMetadataPermissionsTask', function(task, done) {
	// 3. Set permissions on metadata

        var projectUuid = task.data;
	var msg;

	console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectSetMetadataPermissionsTask.');

	agaveIO.setCommunityMetadataPermissions(projectUuid, true)
            .then(function() {
                taskQueue
                    .create('publishProjectFinishTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectSetMetadataPermissionsTask.');
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('publishProjectFinishTask', function(task, done) {
	// 4. Update project metadata to public

        var projectUuid = task.data;
	var projectName = '';

	var msg;
	ServiceAccount.getToken()
            .then(function(token) {
		return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
	    .then(function(projectMetadata) {
		projectName = projectMetadata.value.name;
		if (projectMetadata.name == 'projectPublishInProcess') {
		    projectMetadata.name = 'publicProject';
		    projectMetadata.value.showArchivedJobs = false;
		    return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
		} else {
		    msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' is not in state: projectPublishInProcess.';
		    return Q.reject(new Error(msg));
		}
	    })
	    .then(function() {
		return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	    })
            .then(function(projectPermissions) {
		// send emails
		var metadataPermissions = new MetadataPermissions();
		var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

		var promises = projectUsernames.map(function(username) {
                    return function() {
			return agaveIO.getUserProfile(username)
			    .then(function(userProfileList) {
				if (userProfileList.length == 0) return;
				if (username == agaveSettings.guestAccountKey) return;
				var userProfile = userProfileList[0];
				if (!userProfile.value.disablePublishEmail) {
				    var vdjWebappUrl = agaveSettings.vdjBackbone
					+ '/community/' + projectUuid;
				    emailIO.sendGenericEmail(userProfile.value.email,
							     'VDJServer project has been published',
							     'The VDJServer project "' + projectName + '" has been published to community data.'
							     + '<br>'
							     + 'You can view the project in community data with the link below:'
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
		console.log('VDJ-API INFO: ProjectController.publishProject - done, project ' + projectUuid + ' has been published.');
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    // Unpublishing a project from community data
    //
    // 1. Move project files from community data
    // 2. Move job output files from community data
    // 3. Set permissions on metadata
    // 4. Update project metadata to private

    taskQueue.process('unpublishProjectMoveFilesTask', function(task, done) {
	// 1. Move project files from community data

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectMoveFilesTask.');

        agaveIO.getProjectFiles(projectUuid)
            .then(function(projectFiles) {
		console.log('VDJ-API INFO: ProjectController.unpublishProject, moving community data files back to project uuid: ' + projectUuid);
		var promises = projectFiles.map(function(entry) {
                    return function() {
			return agaveIO.moveProjectFileToCommunity(projectUuid, entry.value.name, false);
		    }
		});

		return promises.reduce(Q.when, new Q());
	    })
            .then(function() {
                taskQueue
                    .create('unpublishProjectMoveJobsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectMoveFilesTask.');
                done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - unpublishProjectMoveFilesTask - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            })
            ;
    });

    taskQueue.process('unpublishProjectMoveJobsTask', function(task, done) {
	// 2. Move job output files from community data

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectMoveJobsTask.');

        // get jobs (this leaves behind the archived jobs)
	agaveIO.getJobMetadataForProject(projectUuid)
            .then(function(jobMetadata) {
		console.log('VDJ-API INFO: ProjectController.unpublishProject, moving job data (' + jobMetadata.length + ' jobs) for community data uuid: ' + projectUuid);
		var promises = jobMetadata.map(function(entry) {
                    return function() {
			return agaveIO.moveJobToCommunity(projectUuid, entry.value.jobUuid, false);
		    }
		});

		return promises.reduce(Q.when, new Q());
            })
            .then(function() {
                taskQueue
                    .create('unpublishProjectSetMetadataPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectMoveJobsTask.');
                done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - unpublishProjectMoveJobsTask - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            })
            ;
    });

    taskQueue.process('unpublishProjectSetMetadataPermissionsTask', function(task, done) {
	// 3. Set permissions on metadata

        var projectUuid = task.data;
	var msg;

	console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectSetMetadataPermissionsTask.');

	agaveIO.setCommunityMetadataPermissions(projectUuid, false)
            .then(function() {
                taskQueue
                    .create('unpublishProjectFinishTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectSetMetadataPermissionsTask.');
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('unpublishProjectFinishTask', function(task, done) {
	// 4. Update project metadata to private

        var projectUuid = task.data;
	var projectName = '';

	var msg;
	ServiceAccount.getToken()
            .then(function(token) {
		return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
	    .then(function(projectMetadata) {
		projectName = projectMetadata.value.name;
		if (projectMetadata.name == 'projectUnpublishInProcess') {
		    projectMetadata.name = 'project';
		    return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
		} else {
		    msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' is not in state: projectUnpublishInProcess.';
		    return Q.reject(new Error(msg));
		}
	    })
	    .then(function() {
		return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	    })
            .then(function(projectPermissions) {
		// send emails
		var metadataPermissions = new MetadataPermissions();
		var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

		var promises = projectUsernames.map(function(username) {
                    return function() {
			return agaveIO.getUserProfile(username)
			    .then(function(userProfileList) {
				if (userProfileList.length == 0) return;
				if (username == agaveSettings.guestAccountKey) return;
				var userProfile = userProfileList[0];
				if (!userProfile.value.disablePublishEmail) {
				    var vdjWebappUrl = agaveSettings.vdjBackbone
					+ '/project/' + projectUuid;
				    emailIO.sendGenericEmail(userProfile.value.email,
							     'VDJServer project has been unpublished',
							     'The VDJServer project "' + projectName + '" has been unpublished from community data.'
							     + ' The project now resides among your private projects and can be edited.'
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
		console.log('VDJ-API INFO: ProjectController.unpublishProject - done, project ' + projectUuid + ' has been unpublished.');
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });
*/

    //
    // Add user to a project by giving them permissions on all of the project objects.
    // Set project metadata last so the project doesn't show up in the user's project
    // list until all other permissions have been set.
    //
    // 1. project files and subdirectories
    // 2. project file metadata
    // 3. project jobs
    // 4. project metadata
    // 5. send emails
    //

    taskQueue.process('addUsernameToProjectTask', function(task, done) {
	// 1. project files and subdirectories

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', start addUsernameToProjectTask: ' + username);

	ServiceAccount.getToken()
	    .then(function() {
		/* HOTFIX: Agave bug AH-207 is preventing recursive file permissions from working, so manually recurse the tree
		// set project file directory + subdirectory permissions recursively
		.then(function(fileListings) {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToMetadataPermissions for project ' + projectUuid);
		
		return agaveIO.addUsernameToFullFilePermissions(username, ServiceAccount.accessToken(), projectUuid, true);
		}) */
		// enumerate file list
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToMetadataPermissions for project ' + projectUuid);
			
		return agaveIO.enumerateFileListings(projectUuid);
	    })
            .then(function(fileListings) {
		// set permissions
		//console.log(fileListings);
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - enumerateFileListings for project ' + projectUuid);

		var promises = [];

		function createAgaveCall(username, token, filePath) {
                    return function() {
			return agaveIO.setFilePermissions(
			    token,
                            username,
                            'ALL',
			    false,
                            filePath
			);
                    };
		}

		for (var i = 0; i < fileListings.length; i++) {
                    promises[i] = createAgaveCall(
			username,
			ServiceAccount.accessToken(),
			'/projects/' + projectUuid + fileListings[i]
                    );
		}

		return promises.reduce(Q.when, new Q());
		// END HOTFIX
            })
            .then(function() {
		// HOTFIX: Agave bug AH-245 is preventing users from uploading files into a project. This happens when you 
		// add the user to the project. For some reason, with the recursive=true flag set on the files/ directory,
		// the user gets a write permission denied error. We stopped setting recursive=true due to the bug AH-207
		// which has a hotfix above, but now we need to set it for the files/ directory. This should be okay as
		// that directory only holds uploaded files and has not subdirectories, unlike analyses/ which can be quite big.
		return agaveIO.setFilePermissions(ServiceAccount.accessToken(), username, 'ALL', true, '/projects/' + projectUuid + '/files');
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectFileMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', done addUsernameToProjectTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectFileMetadataTask', function(task, done) {
	// 2. project file metadata

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', start addUsernameToProjectFileMetadataTask: ' + username);

	ServiceAccount.getToken()
	    .then(function() {
		// get file metadata pems
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToFullFilePermissions for project ' + projectUuid);

		return agaveIO.getProjectFileMetadata(projectUuid);
            })
            .then(function(projectFileMetadataPermissions) {
		// (loop) add to file metadata pems
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - getProjectFileMetadata for project ' + projectUuid);

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
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectJobsTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', done addUsernameToProjectFileMetadataTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectJobsTask', function(task, done) {
	// 3. project jobs

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', start addUsernameToProjectJobsTask: ' + username);

	ServiceAccount.getToken()
	    .then(function() {
		// get jobs for project
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToMetadataPermissions for project ' + projectUuid);

		//return agaveIO.getJobMetadataForProject(projectUuid);
		return agaveIO.getJobsForProject(projectUuid);
            })
            .then(function(jobMetadatas) {
		// (loop) add to job permissions
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - getJobsForProject for project ' + projectUuid);

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
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', done addUsernameToProjectJobsTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectMetadataTask', function(task, done) {
	// 4. project metadata

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', start addUsernameToProjectMetadataTask: ' + username);

	ServiceAccount.getToken()
	    .then(function() {
		// get all project associated metadata
		// TODO: this technically should be sufficient for all metadata except for the sole project metadata entry
		// but not currently as many old metadata entries are missing the associationId
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToJobPermissions for project ' + projectUuid);

		return agaveIO.getAllProjectAssociatedMetadata(projectUuid);
            })
            .then(function(allMetadatas) {
		// (loop) add permissions for user
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - getAllProjectAssociatedMetadata for project ' + projectUuid);

		var metadata = new MetadataPermissions();
		var uuids = metadata.getUuidsFromMetadataResponse(allMetadatas);
		//console.log(allMetadatas);
		//console.log(uuids.length);
		//console.log(uuids);

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
		// Add new username to project metadata pems
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - getMetadataPermissions for project ' + projectUuid);

		return agaveIO.addUsernameToMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectSendEmailTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', done addUsernameToProjectMetadataTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectSendEmailTask', function(task, done) {
	// 5. send emails

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', start addUsernameToProjectSendEmailTask: ' + username);

	ServiceAccount.getToken()
            .then(function() {
		return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
	    .then(function(projectMetadata) {
		projectData.projectName = projectMetadata.value.name;
		//console.log(projectData.projectName);
		return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	    })
            .then(function(projectPermissions) {
		// send emails
		var metadataPermissions = new MetadataPermissions();
		var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

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
							 'VDJServer user added to project',
							 'VDJServer user "' + username + '" has been added to project "' + projectData.projectName + '".'
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
		// send notification
                app.emit(
                    'userProjectNotification',
                    {
			projectUuid: projectUuid,
			username: username 
                    }
                );
	    })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername, project ' + projectUuid + ', done addUsernameToProjectSendEmailTask: ' + username);
		console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - complete for project ' + projectUuid);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    //
    // Remove user from a project by removing permissions on all of the project objects.
    // Set project metadata first so the project is removed from the user's project list.
    //
    // 1. project metadata record
    // 2. project files and subdirectories
    // 3. project associated metadata records
    // 4. project jobs
    // 5. send emails
    //

    taskQueue.process('removeUsernameFromProjectTask', function(task, done) {
	// 1. project metadata

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', start removeUsernameFromProjectTask: ' + username);

	ServiceAccount.getToken()
            .then(function(token) {
		// Remove username from project metadata pems
		return agaveIO.removeUsernameFromMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
		// next task
                taskQueue
                    .create('removeUsernameFromProjectFilesTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', done removeUsernameFromProjectTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectFilesTask', function(task, done) {
	// 2. project files and subdirectories

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', start removeUsernameFromProjectFilesTask: ' + username);

	ServiceAccount.getToken()
            .then(function(token) {
		// Remove username from project files pems
		return agaveIO.removeUsernameFromFilePermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
		// next task
                taskQueue
                    .create('removeUsernameFromProjectMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', done removeUsernameFromProjectFilesTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectMetadataTask', function(task, done) {
	// 3. project associated metadata records

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', start removeUsernameFromProjectMetadataTask: ' + username);

	ServiceAccount.getToken()
            .then(function(token) {
		// get all project associated metadata
		return agaveIO.getAllProjectAssociatedMetadata(projectUuid);
            })
            .then(function(projectMetadata) {
		// (loop) Remove from File Metadata pems
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
            .then(function() {
		// next task
                taskQueue
                    .create('removeUsernameFromProjectJobsTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', done removeUsernameFromProjectMetadataTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectJobsTask', function(task, done) {
	// 4. project jobs

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', start removeUsernameFromProjectJobsTask: ' + username);

	ServiceAccount.getToken()
            .then(function() {
		// get jobs for project
		return agaveIO.getJobsForProject(projectUuid);
            })
            .then(function(jobMetadatas) {
		// (loop) remove job permissions
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
		// next task
                taskQueue
                    .create('removeUsernameFromProjectEmailTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', done removeUsernameFromProjectJobsTask: ' + username);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectEmailTask', function(task, done) {
	// 5. send emails

        var projectData = task.data;
	var projectUuid = projectData.projectUuid;
	var username = projectData.username;
	var projectUsernames = projectData.projectUsernames;
	var msg;

	console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', start removeUsernameFromProjectEmailTask: ' + username);

	ServiceAccount.getToken()
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
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername, project ' + projectUuid + ', done removeUsernameFromProjectEmailTask: ' + username);
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - removeUsernameFromJobPermissions for project ' + projectUuid);
		console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - complete for project ' + projectUuid);
		done();
            })
            .fail(function(error) {
		if (!msg) msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - project ' + projectUuid + ' error ' + error;
		console.error(msg);
		webhookIO.postToSlack(msg);
		done(new Error(msg));
            });
    });
};
