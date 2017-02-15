
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var apiResponseController = require('./apiResponseController');
var jobController = require('./jobsController');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');

// Models
var FileUploadJob = require('../models/fileUploadJob');

// Node Libraries
var Q = require('q');

var NotificationsController = {};
module.exports = NotificationsController;

NotificationsController.processFileImportNotifications = function(request, response) {

    var fileNotification = {
        fileUuid:    request.query.fileUuid,
        fileEvent:   request.query.event,
        fileType:    request.query.type,
        filePath:    request.query.path,
        fileSystem:  request.query.system,
        projectUuid: request.query.projectUuid,
        vdjFileType: request.query.vdjFileType,
        readDirection: request.query.readDirection,
        tags: request.query.tags,
    };

    console.log('VDJ-API INFO: NotificationsController.processFileImportNotifications - event - begin for file uuid ' + fileNotification.fileUuid);

    // verify file notification
    var fileUploadJob = new FileUploadJob(fileNotification);

    fileUploadJob.verifyFileNotification()
	.then(function() {
	    // queue file upload task
            taskQueue
                .create('fileUploadPoll', fileNotification)
                .removeOnComplete(true)
                .attempts(50)
                .backoff({delay: 30 * 1000, type: 'fixed'})
                .save()
                ;
	})
	.then(function() {
            console.log('VDJ-API INFO: NotificationsController.processFileImportNotifications - event - queued for file uuid ' + fileNotification.fileUuid);
	    return apiResponseController.sendSuccess('', response);
	})
        .fail(function(error) {
	    var msg = 'VDJ-API ERROR: NotificationsController.processFileImportNotifications - fileNotification: ' + JSON.stringify(fileNotification) + ', error: ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
	    return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

NotificationsController.processJobNotifications = function(request, response) {

    var jobId = request.params.jobId;
    var jobEvent  = request.query.event;
    var jobStatus = request.query.status;
    var jobMessage  = request.query.error;
    var projectUuid = request.query.projectUuid;
    var jobName = request.query.jobName;

    if (!jobId) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    if (!jobEvent) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing jobEvent parameter');
        apiResponseController.sendError('Job event required.', 400, response);
        return;
    }

    if (!jobStatus) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing jobStatus parameter');
        apiResponseController.sendError('Job status required.', 400, response);
        return;
    }

    if (!jobMessage) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing jobMessage parameter');
        apiResponseController.sendError('Job message required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing projectUuid parameter');
        apiResponseController.sendError('projectUuid required.', 400, response);
        return;
    }

    if (!jobName) {
        console.error('VDJ-API ERROR: NotificationsController.processJobNotifications - error - missing jobName parameter');
        apiResponseController.sendError('jobName required.', 400, response);
        return;
    }

    var msg = null;
    var message = 'Invalid job id.';
    
    // valid job?
    agaveIO.getJobOutput(jobId)
	.then(function(jobOutput) {
	    message = '';

	    // match project id
	    var split = jobOutput.archivePath.split('/');
	    if (split[2] != projectUuid) {
		message = 'Project uuid does not match job.';
		return Q.reject(new Error('Project uuid: ' + projectUuid + ' != ' + split[2] + ' project uuid on job'));
	    }

	    console.log('VDJ-API INFO: NotificationsController.processJobNotifications - event - received notification for job id ' + jobId + ', new status is: ' + jobStatus);

	    // we do not want to emit finished notification until permissions
	    // for all project users have been updated
	    if (jobStatus === 'FINISHED') {
		var jobData = {
		    jobId: jobId,
		    jobEvent: jobEvent,
		    jobStatus: jobStatus,
		    jobMessage: jobMessage,
		    projectUuid: projectUuid,
		    jobName: jobName,
		};

		// guard against multiple FINISHED notifications coming at same time
		// not perfect semaphore
		var guardKey = 'guard-' + jobId;
		var redisClient = kue.redis.createClient();

		Q.ninvoke(redisClient, 'exists', guardKey)
		    .then(function(isMember) {
			if (isMember === 1) {
			    // error out
			    msg = 'VDJ-API WARNING: NotificationsController.processJobNotifications - received duplicate FINISHED notification for job ' + jobId + ', caught by guard';
			    return Q.reject(new Error(msg));
			} else {
			    return Q.ninvoke(redisClient, 'set', guardKey, 'ok');
			}
		    })
		    .then(function() {
			return Q.ninvoke(redisClient, 'expire', guardKey, 600);
		    })
		    .then(function() {
			taskQueue
			    .create('checkJobTask', jobData)
			    .removeOnComplete(true)
			    .attempts(1)
			//.backoff({delay: 60 * 1000, type: 'fixed'})
			    .save()
			;
		    })
	    } else {
		app.emit(
		    'jobNotification',
		    {
			jobId: jobId,
			jobEvent: jobEvent,
			jobStatus: jobStatus,
			jobMessage: jobMessage,
			projectUuid: projectUuid,
			jobName: decodeURIComponent(jobName),
		    }
		);
	    }

	    return apiResponseController.sendSuccess('ok', response);
	})
        .fail(function(error) {
	    if (!msg) msg = 'VDJ-API ERROR: NotificationsController.processJobNotifications - ' + message + ' - job ' + jobId + ', error ' + error;
            console.error(msg);
	    webhookIO.postToSlack(msg);
            return apiResponseController.sendError(message, 400, response);
        });

};
