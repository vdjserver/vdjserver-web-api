
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

// Processing
var webhookIO = require('../vendor/webhookIO');

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
        console.log('VDJ-API INFO: fileUploadPoll queue begin for ' + JSON.stringify(fileQueueJob.data));

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
                console.log('VDJ-API INFO: fileUploadPoll queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
		if (error == 'file transformation not complete') {
                    console.log('VDJ-API INFO: fileUploadPoll queue for ' + JSON.stringify(fileQueueJob.data) + ', file transformation is not complete.');

                    // Stop retries after 40 minutes
                    var finishDatetime = moment(fileQueueJob.created_at, 'x').add(40, 'minutes');
                    var currentDatetime = moment();

                    var overTimeLimit = currentDatetime.isAfter(finishDatetime);

                    if (overTimeLimit === true) {
			console.log('VDJ-API INFO: fileUploadPoll queue - exceeded polling limit, continuing.');

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
			console.log('VDJ-API INFO: fileUploadPoll queue for ' + JSON.stringify(fileQueueJob.data) + ', re-polling.');
			done(new Error(error));
                    }
		} else {
                    var msg = 'VDJ-API ERROR: fileUploadPoll queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error;
		    console.error(msg);
		    //console.error(error.stack);
		    webhookIO.postToSlack(msg);
                    done(); // no retry
		}
            })
            ;
    });

    queue.process('fileUploadPermissions', function(fileQueueJob, done) {
        console.log('VDJ-API INFO: fileUploadPermissions queue begin for ' + JSON.stringify(fileQueueJob.data));

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
                console.log('VDJ-API INFO: fileUploadPermissions queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
		console.error('VDJ-API ERROR: fileUploadPermissions queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);
		console.error(error.stack);

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
        console.log('VDJ-API INFO: fileUploadMetadata queue begin for ' + JSON.stringify(fileQueueJob.data));

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
                console.log('VDJ-API INFO: fileUploadMetadata queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: fileUploadMetadata queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);
		console.error(error.stack);

                done(new Error('Agave error is: ' + error));
            })
            ;

    });

    queue.process('fileUploadMetadataPermissions', function(fileQueueJob, done) {
        console.log('VDJ-API INFO: fileUploadMetadataPermissions queue begin for ' + JSON.stringify(fileQueueJob.data));

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
                console.log('VDJ-API INFO: fileUploadMetadataPermissions queue done for ' + JSON.stringify(fileQueueJob.data));
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: fileUploadMetadataPermissions queue error for ' + JSON.stringify(fileQueueJob.data) + ', error is ' + error);
		console.error(error.stack);

                done(new Error('Agave error is: ' + error));
            })
            ;
    });

};
