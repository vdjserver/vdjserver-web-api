
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

var FilePermissionsQueueManager = {};
module.exports = FilePermissionsQueueManager;

/*
    Processing tasks
    1.) share file w/ project users
    2.) create file metadata
    3.) share file metadata w/ project users
*/
FilePermissionsQueueManager.processFileUploads = function() {

    var queue = kue.createQueue();

    queue.process('fileUploadPermissions', function(fileQueueJob, done) {

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
                done(new Error('Agave error is: ' + error));
            })
            ;
    });

    queue.process('fileUploadMetadata', function(fileQueueJob, done) {

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
                done(new Error('Agave error is: ' + error));
            })
            ;

    });

    queue.process('fileUploadMetadataPermissions', function(fileQueueJob, done) {

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
                done(new Error('Agave error is: ' + error));
            })
            ;
    });

};
