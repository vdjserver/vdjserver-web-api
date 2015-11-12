
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
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var JobQueueManager = {};
module.exports = JobQueueManager;

JobQueueManager.processJobs = function() {

    /*
        Initial processing tasks

        1.) createArchivePath
        2.) launch job w/ notification embedded
        3.) create pointer metadata
        4.) share job
        5.) share pointer metadata
    */

    /*
        Job finish processing tasks

        1.) share job output files
        2.) create project file metadata for job output files
        3.) share project file metadata for job output files
    */

    taskQueue.process('createArchivePathDirectoryTask', function(task, done) {

        var jobData = task.data;
        var projectUuid = jobData.projectUuid;

        var job = new Job();

        var archivePath = job.createArchivePath(projectUuid, jobData.config.name);
        var relativeArchivePath = job.convertToRelativeArchivePath(archivePath);

        // store new archivePath for later
        jobData.config.archivePath = archivePath;

        // agave mkdir relativeArchivePath
        agaveIO.createJobArchiveDirectory(projectUuid, relativeArchivePath)
            // pass archivePath with other job data to next task
            .then(function() {
                taskQueue
                    .create('submitJobTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('createArchivePathDirectoryTask done for ' + jobData.config.name);
                done();
            })
            .fail(function(error) {
                console.log('createArchivePathDirectoryTask error is: "' + error + '" for ' + jobData.config.name);
                done(new Error('createArchivePathDirectoryTask error is: "' + error + '" for ' + jobData.config.name));
            })
            ;
    });

    taskQueue.process('submitJobTask', function(task, done) {
        var jobData = task.data;

        var job = new Job();
        var jobNotification = job.getJobNotification();
        jobData.config.notifications = [
            jobNotification,
        ];

        agaveIO.launchJob(JSON.stringify(jobData.config))
            .then(function(jobSubmitResponse) {
                jobData.jobId = jobSubmitResponse.id;
            })
            .then(function() {

                taskQueue
                    .create('createJobPointerMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('submitJobTask done for ' + JSON.stringify(jobData.jobId));
                done();
            })
            .fail(function(error) {
                console.log('submitJobTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('submitJobTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('createJobPointerMetadataTask', function(task, done) {
        var jobData = task.data;

        agaveIO.createJobPointerMetadata(jobData.projectUuid, jobData.jobId)
            .then(function(jobPointerMetadata) {
                jobData.jobPointerMetadataUuid = jobPointerMetadata.uuid;
            })
            .then(function() {
                taskQueue
                    .create('shareJobTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('createJobPointerMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('createJobPointerMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('createJobPointerMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('shareJobTask', function(task, done) {

        var jobData = task.data;

        var serviceAccount = new ServiceAccount();

        // Get project users
        agaveIO.getMetadataPermissions(serviceAccount.accessToken, jobData.projectUuid)
            // (loop) add project users to job pems
            .then(function(projectPermissions) {

                var filePermissions = new FilePermissions();

                var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = projectUsernames.map(function(username) {
                    return function() {
                        return agaveIO.addUsernameToJobPermissions(
                            username,
                            serviceAccount.accessToken,
                            jobData.jobId
                        );
                    };
                });

                return promises.reduce(Q.when, new Q());
            })
            .then(function() {
                taskQueue
                    .create('shareJobPointerMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('shareJobTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('shareJobTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('shareJobPointerMetadataTask', function(task, done) {
        var jobData = task.data;

        var serviceAccount = new ServiceAccount();

        // Get project users
        agaveIO.getMetadataPermissions(serviceAccount.accessToken, jobData.projectUuid)
            // Add users to metadata pems
            .then(function(projectPermissions) {

                var metadataPermissions = new MetadataPermissions();

                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = projectUsernames.map(function(username) {
                    return function() {
                        return agaveIO.addUsernameToMetadataPermissions(
                            username,
                            serviceAccount.accessToken,
                            jobData.jobPointerMetadataUuid
                        );
                    };
                });

                return promises.reduce(Q.when, new Q()); // 3.
            })
            .then(function() {
                console.log('shareJobPointerMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('shareJobPointerMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobPointerMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    /////////////////

    // share job output files
    // create job output metadata
    // share job output metadata

    taskQueue.process('shareJobOutputFilesTask', function(task, done) {

        var jobData = task.data;

        var serviceAccount = new ServiceAccount();

        agaveIO.getJobOutput(jobData.jobId)
            .then(function(jobOutput) {
                jobData.name = jobOutput.name;

                var job = new Job();

                var deconstructedUrl = job.deconstructJobListingUrl(jobOutput);

                jobData.projectUuid = deconstructedUrl.projectUuid;
                jobData.relativeArchivePath = deconstructedUrl.relativeArchivePath;
            })
            .then(function() {
                return agaveIO.getMetadataPermissions(serviceAccount.accessToken, jobData.projectUuid);
            })
            .then(function(projectPermissions) {
                var metadataPermissions = new MetadataPermissions();

                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                return agaveIO.getJobOutputFileListings(jobData.projectUuid, jobData.relativeArchivePath)
                    .then(function(jobFileListings) {

                        var promises = projectUsernames.map(function(username) {
                            return function() {
                                return agaveIO.addUsernameToFullFilePermissions(
                                    username,
                                    serviceAccount.accessToken,
                                    jobData.projectUuid + '/analyses' + '/' + jobData.relativeArchivePath
                                );
                            };
                        });

                        return promises.reduce(Q.when, new Q()); // 3.
                    })
                    ;
            })
            .then(function() {
                taskQueue
                    .create('createJobOutputFileMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('shareJobOutputFilesTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('shareJobOutputFilesTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobOutputFilesTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('createJobOutputFileMetadataTask', function(task, done) {
        var jobData = task.data;

        var serviceAccount = new ServiceAccount();

        agaveIO.getJobOutputFileListings(jobData.projectUuid, jobData.relativeArchivePath)
            .then(function(jobFileListings) {

                var job = new Job();

                var promises = jobFileListings.map(function(jobFileListing) {

                    var isWhitelistedFiletype = job.isWhitelistedFiletype(jobFileListing.name);

                    if (isWhitelistedFiletype) {
                        return function() {
                            return agaveIO.createProjectJobFileMetadata(
                                jobData.projectUuid,
                                jobData.jobId,
                                jobFileListing.name,
                                jobFileListing.length,
                                jobData.name,
                                jobData.relativeArchivePath
                            );
                        };
                    }
                });

                return promises.reduce(Q.when, new Q()); // 3.
            })
            .then(function() {
                taskQueue
                    .create('shareJobOutputFileMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('createJobOutputFileMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('createJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('createJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    // get project permissions
    // get job output file metadata
    // share metadata
    taskQueue.process('shareJobOutputFileMetadataTask', function(task, done) {
        var jobData = task.data;

        var serviceAccount = new ServiceAccount();

        agaveIO.getMetadataPermissions(serviceAccount.accessToken, jobData.projectUuid)
            .then(function(projectPermissions) {
                var metadataPermissions = new MetadataPermissions();

                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                return agaveIO.getProjectJobFileMetadatas(jobData.projectUuid, jobData.jobId)
                    .then(function(jobMetadatas) {

                        var promises = [];

                        var jobMetadataIds = jobMetadatas.forEach(function(jobMetadata) {

                            var tmpPromises = projectUsernames.map(function(username) {

                                return function() {
                                    return agaveIO.addUsernameToMetadataPermissions(
                                        username,
                                        serviceAccount.accessToken,
                                        jobMetadata.uuid
                                    );
                                };
                            });

                            //promises.push(tmpPromises);
                            promises = promises.concat(tmpPromises);
                        });

                        return promises.reduce(Q.when, new Q());
                    })
                    ;
            })
            .then(function() {
                console.log('shareJobOutputFileMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('shareJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });
};
