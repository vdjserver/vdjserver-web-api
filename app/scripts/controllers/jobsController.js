
'use strict';

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount = require('../models/serviceAccount');
var PendingJob = require('../models/pendingJob');

// Processing
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var JobsController = {};
module.exports = JobsController;

JobsController.getPendingJobs = function(request, response) {

    let projectUuid = request.query.projectUuid;

    let pendingJobs = [];

    Q()
        // Verify token
        .then(function() {
            let accessToken = request.user.password;

            return agaveIO.getMetadataPermissions(accessToken, projectUuid);
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createArchivePathDirectoryTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createArchivePathDirectoryTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createArchiveMetadataTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createArchiveMetadataTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('submitJobTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('submitJobTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createJobPointerMetadataTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('createJobPointerMetadataTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('shareJobTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('shareJobTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('shareJobPointerMetadataTask', 'active', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            let deferred = Q.defer();

            kue.Job.rangeByType('shareJobPointerMetadataTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
                jobs.forEach(function(job) {
                    if (job.data.projectUuid === projectUuid) {

                        let pendingJob = new PendingJob({
                            'name': job.data.config.name,
                            'executionSystem': job.data.config.executionSystem,
                            'appId': job.data.config.appId,
                        });

                        pendingJobs.push(pendingJob.getAgaveFormattedJobObject());
                    }
                });

                deferred.resolve();
            });

            return deferred.promise;
        })
        .then(function() {
            apiResponseController.sendSuccess(pendingJobs, response);
        })
        ;
};

JobsController.queueJob = function(request, response) {

    var jobData = request.body;

    taskQueue
        .create('createArchivePathDirectoryTask', jobData)
        .removeOnComplete(true)
        .attempts(5)
        .backoff({delay: 60 * 1000, type: 'fixed'})
        .save()
        ;

    apiResponseController.sendSuccess('', response);
};
