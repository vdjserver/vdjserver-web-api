
'use strict';

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

var ProjectQueueManager = {};
module.exports = ProjectQueueManager;

ProjectQueueManager.processProjects = function() {

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
};
