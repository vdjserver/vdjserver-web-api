
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

    if (lock === false) {
        lock = true;

        Q.ninvoke(notificationJobs, 'inactiveCount')
            .then(function(total) {
                console.log("total is: " + total);
                if (total === 0) {
                    throw new Error("no inactive jobs available");
                }
            })
            .then(function() {
                console.log("fCall hit");
                // prune

                kue.Job.rangeByType('fileUploadPermissions', 'inactive', 0, -1, 'asc', function(err, jobs) {
                    console.log("fileUploadPermissions err is: " + JSON.stringify(err));
                    var uniqueSet = new Set();
                    jobs.forEach(function(job) {
                        console.log("fileUploadPermissions job is: " + JSON.stringify(job));

                        if (uniqueSet.has(job.data.fileUuid)) {
                            job.remove(function() {
                                console.log('fileUploadPermissions removed ', job.id);
                            });
                        }
                        else {
                            uniqueSet.add(job.data.fileUuid);
                        }
                    });
                });

                kue.Job.rangeByType('fileUploadMetadata', 'inactive', 0, -1, 'asc', function(err, jobs) {
                    console.log("fileUploadMetadata err is: " + JSON.stringify(err));
                    var uniqueSet = new Set();
                    jobs.forEach(function(job) {
                        console.log("fileUploadMetadata job is: " + JSON.stringify(job));

                        if (uniqueSet.has(job.data.fileUuid)) {
                            job.remove(function() {
                                console.log('fileUploadMetadata removed ', job.id);
                            });
                        }
                        else {
                            uniqueSet.add(job.data.fileUuid);
                        }
                    });
                });

                kue.Job.rangeByType('fileUploadMetadataPermissions', 'inactive', 0, -1, 'asc', function(err, jobs) {
                    console.log("fileUploadMetadataPermissions err is: " + JSON.stringify(err));
                    var uniqueSet = new Set();
                    jobs.forEach(function(job) {
                        console.log("fileUploadMetadataPermissions job is: " + JSON.stringify(job));

                        if (uniqueSet.has(job.data.fileUuid)) {
                            job.remove(function() {
                                console.log('fileUploadMetadataPermissions removed ', job.id);
                            });
                        }
                        else {
                            uniqueSet.add(job.data.fileUuid);
                        }
                    });
                });
            })
            .then(function() {
                var deferred = Q.defer();

                notificationJobs.process('fileUploadPermissions', function(jobData, done) {

                    var fileUploadJob = new FileUploadJob(jobData);
                    fileUploadJob.setAgaveFilePermissions()
                        .then(function() {
                            console.log("fileUploadPermissions done");
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
                            console.log("fileUploadMetadata done");
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
                            console.log("fileUploadMetadataPermissions");
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
            .then(function() {
                console.log("all done");
            })
            .fail(function(error) {
                console.error('NotificationsController.createFileMetadata error is: ' + error);
            })
            .done(function() {
                console.log("unlock hit");
                lock = false;
            })
            ;
    }
    else {
        console.log("function locked");
    }
};
