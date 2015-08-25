
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var apiResponseController = require('./apiResponseController');
var jobController = require('./jobsController');
var kue = require('kue');
var notificationJobs = kue.createQueue({
    redis: app.redisConfig,
});
//var redisClient = kue.redis.createClient();

// Models
var FileUploadJob = require('../models/fileUploadJob');

// Node Libraries
var Q = require('q');

var NotificationsController = {};
module.exports = NotificationsController;

NotificationsController.createFileMetadata = function(request, response) {
    var fileNotification = {
        fileUuid:   request.params.uuid,
        fileEvent:  request.query.event,
        fileType:   request.query.type,
        filePath:   request.query.path,
        fileSystem: request.query.system,
    };

    /*
        1.) Send response to prevent blocking notification client
        2.) Check if this fileId has been received in the past 5 minutes-ish or so (Agave is sending duplicates as of 17/June/2015)
        3.) Add to queues
        4.) Run filePermission task and dequeue if successful
        5.) Run fileMetadata task and dequeue if successful
        6.) Run fileMetadataPermission task and dequeue if successful
        7.) ???
        8.) Profit
    */
    Q.when(apiResponseController.sendSuccess('', response), function() {

        return Q.fcall(function() {
            notificationJobs
                .create('fileUploadPermissions', fileNotification)
                .removeOnComplete(true)
                .attempts(5)
                //.backoff({delay: 60 * 1000, type: 'fixed'})
                .save()
                ;
        })
        ;
    })
    ;
};

NotificationsController.processJobNotifications = function(request, response) {

    var jobId   = request.params.jobId;
    var jobEvent  = request.query.event;
    var jobStatus = request.query.status;
    var jobMessage  = request.query.error;

    if (!jobId) {
        console.error('Error NotificationsController.processJobNotifications: missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    if (!jobEvent) {
        console.error('Error NotificationsController.processJobNotifications: missing jobEvent parameter');
        apiResponseController.sendError('Job event required.', 400, response);
        return;
    }

    if (!jobStatus) {
        console.error('Error NotificationsController.processJobNotifications: missing jobStatus parameter');
        apiResponseController.sendError('Job status required.', 400, response);
        return;
    }

    if (!jobMessage) {
        console.error('Error NotificationsController.processJobNotifications: missing jobMessage parameter');
        apiResponseController.sendError('Job message required.', 400, response);
        return;
    }

    console.log('Job Id \'' + jobId + '\' received a notification. New status is: ' + jobStatus);

    app.emit(
        'jobNotification',
        {
            jobId: jobId,
            jobEvent: jobEvent,
            jobStatus: jobStatus,
            jobMessage: jobMessage,
        }
    );

    if (jobStatus === 'FINISHED') {
        jobController.createJobFileMetadata(jobId);
    }

    apiResponseController.sendSuccess('ok', response);
};
