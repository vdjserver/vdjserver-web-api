
'use strict';

//
// JobsController.js
// Manage job queues
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2023 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var JobsController = {};
module.exports = JobsController;

// App
var config = require('../config/config');
var app = require('../app');
var mongoSettings = require('../config/mongoSettings');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

// Controllers
var apiResponseController = require('./apiResponseController');

// Queues
var adcDownloadQueueManager = require('../queues/adcDownloadQueueManager');

// Processing
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

/* -- OLD V1

JobsController.getPendingJobs = function(request, response) {

    let projectUuid = request.query.projectUuid;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: JobsController.getPendingJobs - missing projectUuid parameter');
        apiResponseController.sendError('Project uuid required.', 400, response);
        return;
    }

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

JobsController.archiveJob = function(request, response) {

    var jobId = request.params.jobId;

    if (!jobId) {
        console.error('VDJ-API ERROR: JobsController.archiveJob - missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    // Check that job is valid for archiving
    // 1. Must be valid user with permissions on job
    // 2. Job must be FINISHED, FAILED or STOPPED state
    // 3. Job must not already by archived
    var msg = null;
    agaveIO.getJobPermissions(jobId)
        .then(function(jobPermissions) {
            var validUser = false;
            for (var i = 0; i < jobPermissions.length; ++i)
                if (jobPermissions[i].username == request.user.username) validUser = true;

            if (validUser) return agaveIO.getJobOutput(jobId);
            else {
                msg = 'VDJ-API ERROR: JobsController.archiveJob - user (' + request.user.username + ') does not have permission on job ' + jobId;
                return Q.reject(new Error(msg));
            }
        })
        .then(function(jobData) {
            var validState = false;
            //console.log(jobData);

            if (jobData.status == 'FINISHED') validState = true;
            if (jobData.status == 'FAILED') validState = true;
            if (jobData.status == 'STOPPED') validState = true;

            if (validState) return agaveIO.getJobMetadataForJob(jobId);
            else {
                msg = 'VDJ-API ERROR: JobsController.archiveJob - job ' + jobId + ' not in valid archivable state (' + jobData.status + ')';
                return Q.reject(new Error(msg));
            }
        })
        .then(function(jobMetadata) {
            //console.log(jobMetadata);     

            if (jobMetadata && jobMetadata[0] && jobMetadata[0].name == 'projectJob') {
                // archive the job
                return agaveIO.updateJobMetadata(jobMetadata[0].uuid, 'projectJobArchive', jobMetadata[0].value);
            } else {
                msg = 'VDJ-API ERROR: JobsController.archiveJob - job metadata ' + jobId + ' is not valid';
                return Q.reject(new Error(msg));
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: JobsController.archiveJob - job ' + jobId + ' was archived.');
            return apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            } else {
                msg = 'VDJ-API ERROR: JobsController.archiveJob - could not verify that job ' + jobId + ' is valid for archiving , error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }
        })
        ;
};

JobsController.unarchiveJob = function(request, response) {

    var jobId = request.params.jobId;

    if (!jobId) {
        console.error('VDJ-API ERROR: JobsController.unarchiveJob - missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    // Check that job is valid for unarchiving
    // 1. Must be valid user with permissions on job
    // 2. Job must be in archived state

    var msg = null;
    agaveIO.getJobPermissions(jobId)
        .then(function(jobPermissions) {
            var validUser = false;
            for (var i = 0; i < jobPermissions.length; ++i)
                if (jobPermissions[i].username == request.user.username) validUser = true;

            if (validUser) return agaveIO.getJobMetadataForArchivedJob(jobId);
            else {
                msg = 'VDJ-API ERROR: JobsController.unarchiveJob - user (' + request.user.username + ') does not have permission on job ' + jobId;
                return Q.reject(new Error(msg));
            }
        })
        .then(function(jobMetadata) {
            //console.log(jobMetadata);     

            if (jobMetadata && jobMetadata[0] && jobMetadata[0].name == 'projectJobArchive') {
                // unarchive the job
                return agaveIO.updateJobMetadata(jobMetadata[0].uuid, 'projectJob', jobMetadata[0].value);
            } else {
                msg = 'VDJ-API ERROR: JobsController.unarchiveJob - job metadata ' + jobId + ' is not valid archived state';
                return Q.reject(new Error(msg));
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: JobsController.unarchiveJob - job ' + jobId + ' was unarchived.');
            return apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            } else {
                msg = 'VDJ-API ERROR: JobsController.unarchiveJob - could not verify that job ' + jobId + ' is valid for archiving , error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }
        })
        ;
};
*/
