
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var kue = require('kue');
var notificationJobs = kue.createQueue({
    redis: app.redisConfig,
});
var redisClient = kue.redis.createClient();

// Models
var FileUploadJob = require('../models/fileUploadJob');

// Node Libraries
var Q = require('q');
var moment = require('moment');

var FilePermissionsQueueManager = {};
module.exports = FilePermissionsQueueManager;

/*
    Processing tasks
    1.) share file w/ project users
    2.) create file metadata
    3.) share file metadata w/ project users
*/

/*
    TODO:
    Future fallback approach after file notifications work:

    1.) poll on notification endpoint instead of file history
*/

FilePermissionsQueueManager.processFileUploads = function() {

    var queue = kue.createQueue();

    queue.process('fileUploadPoll', function(fileQueueJob, done) {
        console.log('fileUploadPoll queue begin for ' + JSON.stringify(fileQueueJob.data));

        var fileUploadJob = new FileUploadJob(fileQueueJob.data);
        fileUploadJob.checkFileAvailability()
            .then(function(fileAvailability) {

                let deferred = Q.defer();

                if (fileAvailability === true) {
                    deferred.resolve();
                }
                else {
                    deferred.reject('file transformation not complete');
                }

                return deferred.promise;
            })
            .then(function() {
                queue
                    .create('fileUploadPermissions', fileQueueJob.data)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('fileUploadPoll queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.log('fileUploadPoll queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);

                // Stop retries after 20 minutes
                var finishDatetime = moment(fileQueueJob.created_at, 'x').add(20, 'minutes');
                var currentDatetime = moment();

                var overTimeLimit = currentDatetime.isAfter(finishDatetime);

                if (overTimeLimit === true) {
                    queue
                        .create('fileUploadPermissions', fileQueueJob.data)
                        .removeOnComplete(true)
                        .attempts(5)
                        .backoff({delay: 60 * 1000, type: 'fixed'})
                        .save()
                        ;

                    done();
                }
                else {
                    done(new Error('Agave error is: ' + error));
                }

            })
            ;
    });

    queue.process('fileUploadPermissions', function(fileQueueJob, done) {
        console.log('fileUploadPermissions queue begin for ' + JSON.stringify(fileQueueJob.data));

        var fileUploadJob = new FileUploadJob(fileQueueJob.data);
        fileUploadJob.setAgaveFilePermissions()
            .then(function() {
                app.emit(
                    'fileImportNotification',
                    {
                        fileImportStatus: 'permissions',
                        fileInformation: fileQueueJob.data,
                    }
                );
            })
            .then(function() {
                queue
                    .create('fileUploadMetadata', fileQueueJob.data)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('fileUploadPermissions queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.log('fileUploadPermissions queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);

                app.emit(
                    'fileImportNotification',
                    {
                        'error': error,
                        'fileInformation': fileQueueJob.data,
                    }
                );

                done(new Error('Agave error is: ' + error));
            })
            ;
    });

    queue.process('fileUploadMetadata', function(fileQueueJob, done) {
        console.log('fileUploadMetadata queue begin for ' + JSON.stringify(fileQueueJob.data));

        var fileUploadJob = new FileUploadJob(fileQueueJob.data);
        fileUploadJob.createAgaveFileMetadata()
            .then(function(response) {

                fileQueueJob.data.metadata = response;

                app.emit(
                    'fileImportNotification',
                    {
                        fileImportStatus: 'metadata',
                        fileInformation: fileQueueJob.data,
                    }
                );
            })
            .then(function() {
                notificationJobs
                    .create('fileUploadMetadataPermissions', fileQueueJob.data)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('fileUploadMetadata queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.log('fileUploadMetadata queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);

                done(new Error('Agave error is: ' + error));
            })
            ;

    });

    queue.process('fileUploadMetadataPermissions', function(fileQueueJob, done) {
        console.log('fileUploadMetadataPermissions queue begin for ' + JSON.stringify(fileQueueJob.data));

        var fileUploadJob = new FileUploadJob(fileQueueJob.data);
        fileUploadJob.setMetadataPermissions()
            .then(function() {
                app.emit(
                    'fileImportNotification',
                    {
                        fileImportStatus: 'metadataPermissions',
                        fileInformation: fileQueueJob.data,
                    }
                );
            })
            .then(function() {
                app.emit(
                    'fileImportNotification',
                    {
                        fileImportStatus: 'finished',
                        fileInformation: fileQueueJob.data,
                    }
                );
            })
            .then(function() {
                console.log('fileUploadMetadataPermissions queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.log('fileUploadMetadataPermissions queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);

                done(new Error('Agave error is: ' + error));
            })
            ;
    });

};
