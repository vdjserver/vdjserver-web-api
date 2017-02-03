
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
    // 3. Set permissions on files, metadata and jobs
    // 4. Update project metadata to public

    taskQueue.process('publishProjectMoveFilesTask', function(task, done) {
	// 1. Move project files to community data

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectMoveFilesTask.');

        agaveIO.getProjectFiles(projectUuid)
            .then(function(projectFiles) {
	    })
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

    taskQueue.process('publishProjectFinishTask', function(task, done) {
	// 4. Update project metadata to public

        var projectUuid = task.data;

	var msg;
	ServiceAccount.getToken()
            .then(function(token) {
		return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
	    .then(function(projectMetadata) {
		if (projectMetadata.name == 'projectPublishInProcess') {
		    projectMetadata.name = 'publicProject';
		    return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
		} else {
		    msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' is not in state: projectPublishInProcess.';
		    return Q.reject(new Error(msg));
		}
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
    // 3. Set permissions on files, metadata and jobs
    // 4. Update project metadata to private

    taskQueue.process('unpublishProjectMoveFilesTask', function(task, done) {
	// 1. Move project files from community data

        var projectUuid = task.data;
	var msg = null;

	console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectMoveFilesTask.');

        agaveIO.getProjectFiles(projectUuid)
            .then(function(projectFiles) {
	    })
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

    taskQueue.process('unpublishProjectFinishTask', function(task, done) {
	// 4. Update project metadata to private

        var projectUuid = task.data;

	var msg;
	ServiceAccount.getToken()
            .then(function(token) {
		return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
	    .then(function(projectMetadata) {
		if (projectMetadata.name == 'projectUnpublishInProcess') {
		    projectMetadata.name = 'project';
		    return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
		} else {
		    msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' is not in state: projectUnpublishInProcess.';
		    return Q.reject(new Error(msg));
		}
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
