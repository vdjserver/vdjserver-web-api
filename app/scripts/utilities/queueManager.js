
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Controllers
var kue = require('kue');
var notificationJobs = kue.createQueue({
    redis: {
        port: app.redisPort || 6379,
        host: app.redisHost || 'localhost',
    },
});
var redisClient = kue.redis.createClient();

// Models
var FileUploadJob = require('../models/fileUploadJob');

// Node Libraries
var Q = require('q');

var lock = false;

var QueueManager = {};
module.exports = QueueManager;

QueueManager.processFileUploads = function() {

    //console.log("processFileUploads lock is: " + lock);

    if (lock === false) {
        lock = true;

        Q.ninvoke(notificationJobs, 'inactiveCount')
            .then(function(total) {
                //console.log("total is: " + total);
                if (total === 0) {
                    throw new Error('no inactive jobs available');
                }
            })
            .then(function() {
                var myFunc = Q.nbind(kue.Job.rangeByType, kue.Job);
                return myFunc('fileUploadPermissions', 'inactive', 0, -1, 'asc');
            })
            .then(function(jobs) {

                //console.log('promise test 1 - jobs are: ' + JSON.stringify(jobs));
                var fileUploadPermissionPromises = [];

                var uniqueSet = new Set();
                jobs.forEach(function(job) {

                    if (uniqueSet.has(job.data.fileUuid)) {

                        var createDeletePromise = function(delJob) {

                            return Q.ninvoke(delJob, 'remove')
                                .then(function() {
                                    //console.log('IF fileUploadPermissions removed ', delJob.id);
                                })
                                ;
                        };

                        fileUploadPermissionPromises[fileUploadPermissionPromises.length] = createDeletePromise(job);
                    }
                    else {
                        uniqueSet.add(job.data.fileUuid);

                        var createUploadPromise = function(tmpJob) {

                            var fileUploadJob = new FileUploadJob(tmpJob.data);
                            return fileUploadJob.setAgaveFilePermissions()
                                .then(function() {
                                    //console.log("fileUploadPermissions task ok");
                                    return Q.ninvoke(tmpJob, 'remove');
                                })
                                .then(function() {
                                    //console.log('ELSE fileUploadPermissions removed ', tmpJob.id);

                                    app.emit(
                                        'fileImportNotification',
                                        {
                                            fileImportStatus: 'permissions',
                                            fileInformation: tmpJob.data,
                                        }
                                    );
                                })
                                .fail(function() {
                                    var error = new Error('fileUploadPermissions fail for ' + JSON.stringify(tmpJob));
                                })
                                ;
                        }

                        fileUploadPermissionPromises[fileUploadPermissionPromises.length] = createUploadPromise(job);
                    }
                });
                return Q.all(fileUploadPermissionPromises);
            })
            .then(function() {
                //console.log("nbind fileUploadMetadata");
                // prune

                var myFunc = Q.nbind(kue.Job.rangeByType, kue.Job);
                return myFunc('fileUploadMetadata', 'inactive', 0, -1, 'asc');
            })
            .then(function(jobs) {

                //console.log("promise test 2 - jobs are: " + JSON.stringify(jobs));
                var fileMetadataPromises = [];

                var uniqueSet = new Set();
                jobs.forEach(function(job) {

                    if (uniqueSet.has(job.data.fileUuid)) {

                        var createDeletePromise = function(delJob) {

                            return Q.ninvoke(delJob, 'remove')
                                .then(function() {
                                    //console.log('IF fileUploadMetadata removed ', delJob.id);
                                })
                                ;
                        };

                        fileMetadataPromises[fileMetadataPromises.length] = createDeletePromise(job);
                    }
                    else {

                        uniqueSet.add(job.data.fileUuid);

                        var createUploadPromise = function(tmpJob) {
                            //console.log("uploadPromise 2: tmpJob is: " + JSON.stringify(tmpJob));

                            var fileUploadJob = new FileUploadJob(tmpJob.data);
                            return fileUploadJob.createAgaveFileMetadata()
                                .then(function(newMetadata) {
                                    //console.log("fileUploadMetadata task ok");
                                    return Q.ninvoke(tmpJob, 'remove');
                                })
                                .then(function() {
                                    //console.log('ELSE fileUploadMetadata removed ', tmpJob.id);
                                    app.emit(
                                        'fileImportNotification',
                                        {
                                            fileImportStatus: 'metadata',
                                            fileInformation: tmpJob.data,
                                        }
                                    );
                                })
                                .fail(function(error) {
                                    var error = new Error('fileUploadMetadata fail for ' + JSON.stringify(tmpJob));

                                })
                                ;
                        }

                        fileMetadataPromises[fileMetadataPromises.length] = createUploadPromise(job);
                    }
                });

                return Q.all(fileMetadataPromises);
            })
            .then(function() {
                //console.log("nbind fileUploadMetadataPermissions");
                // prune

                var myFunc = Q.nbind(kue.Job.rangeByType, kue.Job);
                return myFunc('fileUploadMetadataPermissions', 'inactive', 0, -1, 'asc');
            })
            .then(function(jobs) {
                //console.log("promise test 3 - jobs are: " + JSON.stringify(jobs));
                var fileUploadPermissionPromises = [];

                var uniqueSet = new Set();
                jobs.forEach(function(job) {
                    //console.log("fileUploadMetadataPermissions job is: " + JSON.stringify(job));

                    if (uniqueSet.has(job.data.fileUuid)) {
                        var createDeletePromise = function(delJob) {

                            return Q.ninvoke(delJob, 'remove')
                                .then(function() {
                                    //console.log('IF fileUploadMetadataPermissions removed ', delJob.id);
                                })
                                ;
                        };

                        fileUploadPermissionPromises[fileUploadPermissionPromises.length] = createDeletePromise(job);
                    }
                    else {
                        uniqueSet.add(job.data.fileUuid);

                        var createUploadPromise = function(tmpJob) {
                            //console.log("uploadPromise 3: tmpJob is: " + JSON.stringify(tmpJob));
                            var fileUploadJob = new FileUploadJob(tmpJob.data);

                            return fileUploadJob.setMetadataPermissions()
                                .then(function() {
                                    //console.log("fileUploadMetadataPermissions task ok");
                                    return Q.ninvoke(tmpJob, 'remove');
                                })
                                .then(function() {
                                    //console.log('ELSE fileUploadMetadataPermissions removed ', tmpJob.id);
                                    app.emit(
                                        'fileImportNotification',
                                        {
                                            fileImportStatus: 'metadataPermissions',
                                            fileInformation: tmpJob.data,
                                        }
                                    );
                                })
                                .then(function() {
                                    app.emit(
                                        'fileImportNotification',
                                        {
                                            fileImportStatus: 'finished',
                                            fileInformation: tmpJob.data,
                                        }
                                    );
                                })
                                .fail(function(error) {
                                    var error = new Error('fileUploadMetadataPermissions fail for ' + JSON.stringify(tmpJob));

                                    //console.log("promise 3 fail");
                                })
                                ;
                        }

                        fileUploadPermissionPromises[fileUploadPermissionPromises.length] = createUploadPromise(job);
                    }
                });

                //console.log("promise count is: " + fileUploadPermissionPromises.length);
                //console.log("promise arr is: " + JSON.stringify(fileUploadPermissionPromises));
                return Q.all(fileUploadPermissionPromises);
            })
            .then(function() {
                //console.log("all done");
            })
            .fail(function(error) {
                //console.error('NotificationsController.createFileMetadata error is: ' + error);
            })
            .done(function() {
                //console.log("unlock hit");
                lock = false;
            })
            ;
    }
    else {
        //console.log("function locked");
    }
};
