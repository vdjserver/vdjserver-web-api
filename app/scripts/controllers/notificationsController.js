
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var apiResponseController = require('./apiResponseController');
var jobController = require('./jobsController');
var kue = require('kue');
var notificationJobs = kue.createQueue();

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

    console.log('received fileNotification: ' + JSON.stringify(fileNotification));

    var guardKey = 'guard-' + fileNotification.fileUuid;

    var redisClient = kue.redis.createClient();


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
            return Q.ninvoke(redisClient, 'exists', guardKey)
        })
        .then(function(isMember) {
            if (isMember === 1) {

                // error out
                throw new Error('fileNotification: duplicate uuid for ' + guardKey);
            }
            else {
                return Q.ninvoke(redisClient, 'set', guardKey, 'ok');
            }
        })
        .then(function() {
            return Q.ninvoke(redisClient, 'expire', guardKey, 600);
        })
        .then(function() {
            notificationJobs
                .create('fileUploadPermissions', fileNotification)
                .removeOnComplete(true)
                .save()
                ;

            notificationJobs
                .create('fileUploadMetadata', fileNotification)
                .removeOnComplete(true)
                .save()
                ;

            notificationJobs
                .create('fileUploadMetadataPermissions', fileNotification)
                .removeOnComplete(true)
                .save()
                ;
        })
        .then(function() {
            var deferred = Q.defer();

            notificationJobs.process('fileUploadPermissions', function(jobData, done) {

                var fileUploadJob = new FileUploadJob(jobData);
                fileUploadJob.setAgaveFilePermissions()
                    .then(function() {
                        done();
                        deferred.resolve();
                    })
                    .fail(function() {
                        var error = new Error('fileUploadPermissions fail for ' + JSON.stringify(jobData));

                        done(error);
                        deferred.reject(error);
                    })
                    ;
            });

            return deferred.promise;
        })
        .then(function() {
            var deferred = Q.defer();

            notificationJobs.process('fileUploadMetadata', function(jobData, done) {
                var fileUploadJob = new FileUploadJob(jobData);

                fileUploadJob.createAgaveFileMetadata()
                    .then(function(newMetadata) {
                        done();
                        deferred.resolve();
                    })
                    .fail(function(error) {
                        var error = new Error('fileUploadMetadata fail for ' + JSON.stringify(jobData));

                        done(error);
                        deferred.reject(error);
                    })
                    ;
            });

            return deferred.promise;
        })
        .then(function() {
            var deferred = Q.defer();

            notificationJobs.process('fileUploadMetadataPermissions', function(jobData, done) {
                var fileUploadJob = new FileUploadJob(jobData);

                fileUploadJob.setMetadataPermissions()
                    .then(function(newMetadata) {
                        done();
                        deferred.resolve();
                    })
                    .fail(function(error) {
                        var error = new Error('fileUploadMetadataPermissions fail for ' + JSON.stringify(jobData));

                        done(error);
                        deferred.reject(error);
                    })
                    ;
            });

            return deferred.promise;
        })
        .done(function() {
            console.log('fileUploadMetadata created for: ' + JSON.stringify(fileNotification));
        })
        .fail(function(error) {
            console.error('NotificationsController.createFileMetadata error is: ' + error);
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
