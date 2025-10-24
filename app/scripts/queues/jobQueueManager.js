
'use strict';

//
// jobQueueManager.js
// Manage Tapis jobs for VDJServer
//
// VDJServer Analysis Portal
// VDJ Web API service
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

var JobQueueManager = {};
module.exports = JobQueueManager;

var app = require('../app');
var config = require('../config/config');

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var ServiceAccount = tapisIO.serviceAccount;
var GuestAccount = tapisIO.guestAccount;
var authController = tapisIO.authController;
var webhookIO = require('vdj-tapis-js/webhookIO');
var emailIO = require('vdj-tapis-js/emailIO');

// App
var Queue = require('bull');
var fs = require('fs');

var AnalysisDocument = require('../models/AnalysisDocument');

// queues
var triggerQueue = new Queue('Tapis job queue trigger', { redis: app.redisConfig });
var checkQueue = new Queue('Tapis job queue check', { redis: app.redisConfig });
var jobQueue = new Queue('Tapis job queue submit job', { redis: app.redisConfig });
var finishQueue = new Queue('Tapis job queue finish', { redis: app.redisConfig });
var clearQueue = new Queue('Tapis job queue clear', { redis: app.redisConfig });
var reloadQueue = new Queue('Tapis job queue reload', { redis: app.redisConfig });

JobQueueManager.clearQueues = async function(queue) {
    var context = 'JobQueueManager.clearQueues';
    var repeatableJobs = await triggerQueue.getRepeatableJobs();
    for (let i in repeatableJobs) {
        await triggerQueue.removeRepeatableByKey(repeatableJobs[i].key);
    }
    config.log.info(context, repeatableJobs.length + ' repeating jobs cleared from triggerQueue', true);

    repeatableJobs = await checkQueue.getRepeatableJobs();
    for (let i in repeatableJobs) {
        await checkQueue.removeRepeatableByKey(repeatableJobs[i].key);
    }
    config.log.info(context, repeatableJobs.length + ' repeating jobs cleared from checkQueue', true);
}

//
// Trigger the job queue process
// This is called by app initialization
//
JobQueueManager.triggerQueue = async function() {
    var context = 'JobQueueManager.triggerQueue';
    var msg = null;

    config.log.info(context, 'begin');

    if (! config.enable_job_queues) {
        msg = config.log.error(context, 'Job queues are not enabled in configuration, cannot trigger');

        JobQueueManager.clearQueues();
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    // TODO: do we need to do anything here?

    // trigger the create queue
    config.log.info(context, 'Job queues enabled, running analyses', true);

    // check, every 10 mins
    triggerQueue.add({}, { repeat: { every: 600000 }});
    // submit one immediately
    triggerQueue.add({});

    config.log.info(context, 'end');
    return Promise.resolve();
}

// this should run periodically
triggerQueue.process(async (job) => {
    var context = 'JobQueueManager triggerQueue.process';
    var msg = null;

    config.log.info(context, 'Triggering job queue');

    // verify queue is enabled
    if (config.enable_job_queues) {
        config.log.info(context, 'Job queues are enabled, checking for new submissions', true);
        checkQueue.add({});
    } else {
        config.log.info(context, 'Job queues are not enabled in configuration', true);
    }

    config.log.info(context, 'end');
    return Promise.resolve();
});

// this should run periodically to check analysis progress
checkQueue.process(async (job) => {
try {
    var context = 'JobQueueManager checkQueue.process';
    var msg = null;

    config.log.info(context, 'begin');

    // verify queue is enabled
    if (!config.enable_job_queues) {
        config.log.info(context, 'Job queues are not enabled in configuration', true);
        config.log.info(context, 'end');
        return Promise.resolve();
    }

    // get all analysis documents with STARTED status
    var analyses = await tapisIO.getAnalysisDocuments('STARTED')
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.getAnalysisDocuments() error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }
    config.log.info(context, analyses.length + ' analysis documents with STARTED status.');
    //console.log(JSON.stringify(analyses, null, 2));

    // check status of started activities
    for (let i in analyses) {
        let analysis = analyses[i];
        let doc = new AnalysisDocument(analysis['value']);

        config.log.info(context, 'check status of tapis jobs for analysis: ' + analysis['uuid'] + ' project:' + analysis['associationIds'][0]);

        // get activities being performed, tapis job submitted
        // activity has startTime but no endTime
        let docFailed = false;
        for (let a in doc.activity) {
            if (doc.activity[a]['prov:endTime']) continue;
            if (!doc.activity[a]['prov:startTime']) continue;
            config.log.info(context, 'found started activity: ' + a + ' job: ' + doc.activity[a]['vdjserver:job']);

            // check status of tapis job
            let job_entry = await tapisIO.getTapisJob(doc.activity[a]['vdjserver:job'])
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.getTapisJob() error: ' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }

            config.log.info(context, 'Current status of tapis job: ' + job_entry['status']);

            // tapis job failed
            if (job_entry['status'] == 'FAILED') {
                msg = config.log.error(context, 'Tapis job failed: ' + job_entry['uuid']
                    + ' for analysis document: ' + analysis['uuid']);
                webhookIO.postToSlack(msg);
                msg = null;

                // TODO: this is weak check, dependent upon TACC providing TIMEOUT message
                // if job has timeout error, increase node count and multiplier
                if (job_entry['lastMessage'].indexOf('TIMEOUT') >= 0) {
                    // check if exceeded time and rerun
                    if (job_entry['maxMinutes'] >= config.job_max_minutes) {
                        msg = config.log.error(context, 'Tapis job: ' + job_entry['uuid']
                            + ' already ran for 48 hours, analysis failed');
                        webhookIO.postToSlack(msg);
                        msg = null;

                        docFailed = true;
                        analysis['value']['status'] = 'FAILED';
                        analysis['value']['status_message'] = 'Maximum 48 hours exceeded for activity: ' + a;
                        await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                            .catch(function(error) {
                                msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                            });
                        if (msg) {
                            webhookIO.postToSlack(msg);
                            return Promise.resolve();
                        }
                    } else {
                        // increase the time multiplier
                        // TODO: increase node count
                        var timeMultiplier = doc.activity[a]['vdjserver:job:timeMultiplier'];
                        if (! timeMultiplier) timeMultiplier = 1;
                        timeMultiplier *= config.job_time_multiplier;

                        msg = config.log.error(context, 'Retry tapis job with time multiplier: ' + timeMultiplier);
                        webhookIO.postToSlack(msg);
                        msg = null;

                        // reset status of activity so new tapis jobs is submitted
                        delete analysis['value']['activity'][a]['prov:startTime'];
                        delete analysis['value']['activity'][a]['vdjserver:job'];
                        analysis['value']['activity'][a]['vdjserver:job:timeMultiplier'] = timeMultiplier;
                        analysis['value']['status_message'] = 'Retrying tapis job for activity: ' + a;
                        await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                            .catch(function(error) {
                                msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                            });
                        if (msg) {
                            webhookIO.postToSlack(msg);
                            return Promise.resolve();
                        }
                    }
                } else {
                    // tapis job failed for some other reason
                    docFailed = true;
                    analysis['value']['status'] = 'FAILED';
                    analysis['value']['status_message'] = 'Tapis job failed: ' + job_entry['id'] + ' for activity: ' + a;
                    analysis['value']['activity'][a]['prov:endTime'] = job_entry['remoteEnded'];
                    await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                        .catch(function(error) {
                            msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                        });
                    if (msg) {
                        webhookIO.postToSlack(msg);
                        return Promise.resolve();
                    }
                }

                if (docFailed) {
                    // no need to check other activities if whole analysis doc failed
                    continue;
                }
            }

            // tapis job finished
            if (job_entry['status'] == 'FINISHED') {
                // update provenance

                analysis['value']['activity'][a]['prov:endTime'] = job_entry['remoteEnded'];
                await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                }
            }

            // tapis job cancelled
            // if one activity is cancelled, we cancel the whole analysis
            if (job_entry['status'] == 'CANCELLED') {
                // update provenance
                config.log.info(context, 'job: ' + job_entry['uuid'] + ' is CANCELLED, cancelling analysis: ' + analysis['uuid'] + ' project:' + analysis['associationIds'][0]);

                analysis['value']['status'] = 'CANCELLED';
                // use remote end time if available, other set time to now
                if (job_entry['remoteEnded'])
                    analysis['value']['activity'][a]['prov:endTime'] = job_entry['remoteEnded'];
                else
                    analysis['value']['activity'][a]['prov:endTime'] = new Date().toISOString();
                await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                }
            }

            // TODO: other statuses?
        }
    }

    // get all analysis documents with STARTED status
    analyses = await tapisIO.getAnalysisDocuments('STARTED')
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.getAnalysisDocuments() error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }
    config.log.info(context, analyses.length + ' analysis documents with STARTED status.');
    //console.log(JSON.stringify(analyses, null, 2));

    // get activities to be performed, submit tapis job
    for (let i in analyses) {
        let analysis = analyses[i];
        let doc = new AnalysisDocument(analysis['value']);
        //console.log(analysis['value']);

        config.log.info(context, 'performing activities for analysis: ' + analysis['uuid'] + ' project:' + analysis['associationIds'][0]);

        let activities = doc.perform_activities(true);
        if (!activities) {
            // no activities to perform, check if all activities are done
            activities = doc.incomplete_activities();
            if (Object.keys(activities).length == 0) {
                // all done so mark analysis as finished
                config.log.info(context, 'all activities complete for analysis: ' + analysis['uuid'] + ' project:' + analysis['associationIds'][0]);
                analysis['value']['status'] = 'FINISHED';
                await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                }
            } // otherwise no change in status, jobs are still running
        } else {
            //console.log(analysis['value']);
            for (let a in activities) {
                let job_data = await doc.create_job_data(a, analysis['associationIds'][0])
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                }
                console.log(JSON.stringify(job_data, null, 2));

                if (config.disable_tapis_job) {
                    config.log.info(context, 'skipping submission of tapis job for activity: ' + a);
                } else {
                    let job = await tapisIO.submitTapisJob(job_data)
                        .catch(function(error) {
                            msg = config.log.error(context, 'tapisIO.submitTapisJob error' + error);
                        });
                    if (msg) {
                        webhookIO.postToSlack(msg);
                        return Promise.resolve();
                    }
                    if (job['fileInputs']) config.log.info(context, JSON.stringify(JSON.parse(job['fileInputs']), null, 2));
                    if (job['parameterSet']) config.log.info(context, JSON.stringify(JSON.parse(job['parameterSet']), null, 2));
                    config.log.info(context, 'Tapis job submitted: ' + job['uuid']);
    
                    analysis['value']['activity'][a]['prov:startTime'] = new Date().toISOString();
                    analysis['value']['activity'][a]['vdjserver:job'] = job['uuid'];
                }
            }
            //console.log(analysis['value']);
            await tapisIO.updateDocument(analysis['uuid'], analysis['name'], analysis['value'])
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.updateDocument error' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }
        }
    }

    config.log.info(context, 'end');
    return Promise.resolve();

} catch (e) { console.error(e); }
});




/* --- OLD V1

var fileTypeMapping = {
    'read': 2,
    'tsv': 6,
    'vdjml': 8
};

JobQueueManager.processJobs = function() {

    //
    //    Initial processing tasks

    //    1. createArchivePath
    //    2. Gather current study metadata and put in archive file
    //    3. launch job w/ notification embedded
    //    4. share job
    //    5. share pointer metadata
    //

    taskQueue.process('createArchivePathDirectoryTask', function(task, done) {

        var jobData = task.data;

        var job = new Job();

        var archivePath = job.createArchivePath(jobData.projectUuid, jobData.config.name);
        var relativeArchivePath = job.convertToRelativeArchivePath(archivePath);

        // store new archivePath for later
        jobData.config.archivePath = archivePath;

        // agave mkdir relativeArchivePath
        agaveIO.createJobArchiveDirectory(jobData.projectUuid, relativeArchivePath)
            // pass archivePath with other job data to next task
            .then(function() {
                taskQueue
                    .create('createArchiveMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: createArchivePathDirectoryTask done for ' + jobData.config.name);
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: createArchivePathDirectoryTask error is: "' + error + '" for ' + jobData.config.name);
                done(new Error('createArchivePathDirectoryTask error is: "' + error + '" for ' + jobData.config.name));
            })
            ;
    });

    taskQueue.process('createArchiveMetadataTask', function(task, done) {

        var jobData = task.data;
        var metadata = {};

        ServiceAccount.getToken()
            .then(function(token) {
                // get project metadata
                return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), jobData.projectUuid);
            })
            .then(function(projectMetadata) {
                metadata.project = projectMetadata;

                return agaveIO.getMetadataForType(ServiceAccount.accessToken(), jobData.projectUuid, 'subject');
            })
            .then(function(metadataList) {
                metadata.subjectMetadata = {};
                for (var i = 0; i < metadataList.length; ++i) {
                    var uuid = metadataList[i].uuid;
                    metadata.subjectMetadata[uuid] = metadataList[i];
                }

                return agaveIO.getMetadataForType(ServiceAccount.accessToken(), jobData.projectUuid, 'diagnosis');
            })
            .then(function(metadataList) {
                metadata.diagnosisMetadata = {};
                for (var i = 0; i < metadataList.length; ++i) {
                    var uuid = metadataList[i].uuid;
                    metadata.diagnosisMetadata[uuid] = metadataList[i];
                }

                return agaveIO.getMetadataForType(ServiceAccount.accessToken(), jobData.projectUuid, 'sample');
            })
            .then(function(metadataList) {
                metadata.sampleMetadata = {};
                for (var i = 0; i < metadataList.length; ++i) {
                    var uuid = metadataList[i].uuid;
                    metadata.sampleMetadata[uuid] = metadataList[i];
                }

                return agaveIO.getMetadataForType(ServiceAccount.accessToken(), jobData.projectUuid, 'cellProcessing');
            })
            .then(function(metadataList) {
                metadata.cellProcessingMetadata = {};
                for (var i = 0; i < metadataList.length; ++i) {
                    var uuid = metadataList[i].uuid;
                    metadata.cellProcessingMetadata[uuid] = metadataList[i];
                }

                return agaveIO.getMetadataForType(ServiceAccount.accessToken(), jobData.projectUuid, 'nucleicAcidProcessing');
            })
            .then(function(metadataList) {
                metadata.nucleicAcidProcessingMetadata = {};
                for (var i = 0; i < metadataList.length; ++i) {
                    var uuid = metadataList[i].uuid;
                    metadata.nucleicAcidProcessingMetadata[uuid] = metadataList[i];
                }

                return agaveIO.getSampleGroupsMetadata(ServiceAccount.accessToken(), jobData.projectUuid);
            })
            .then(function(sampleGroupsMetadata) {
                metadata.sampleGroups = {};
                for (var i = 0; i < sampleGroupsMetadata.length; ++i) {
                    var uuid = sampleGroupsMetadata[i].uuid;
                    metadata.sampleGroups[uuid] = sampleGroupsMetadata[i];
                }

                // specific job selected?
                if (jobData.config.parameters.JobSelected)
                    return agaveIO.getJobOutput(jobData.config.parameters.JobSelected);
                else
                    return null;
            })
            .then(function(jobOutput) {
                if (jobOutput) metadata.jobSelected = jobOutput;

                // secondary inputs provided?
                if (jobData.config.secondaryInputs) {
                    // put in study metadata
                    metadata.secondaryInputs = jobData.config.secondaryInputs;
                    // move so does not get passed to agave job submission
                    jobData.secondaryInputs = jobData.config.secondaryInputs;
                    delete jobData.config.secondaryInputs;
                }

                return agaveIO.getProcessMetadataForProject(jobData.projectUuid);
            })
            .then(function(processMetadata) {
                metadata.processMetadata = {};
                for (var i = 0; i < processMetadata.length; ++i) {
                    var uuid = processMetadata[i].value.process.jobId;
                    metadata.processMetadata[uuid] = processMetadata[i];
                }

                return agaveIO.getProjectFileMetadata(jobData.projectUuid);
            })
            .then(function(fileMetadata) {
                metadata.fileMetadata = {};
                for (var i = 0; i < fileMetadata.length; ++i) {
                    var uuid = fileMetadata[i].uuid;
                    metadata.fileMetadata[uuid] = fileMetadata[i];
                }
                //console.log(metadata);

                var buffer = new Buffer(JSON.stringify(metadata));
                return agaveIO.uploadFileToJobArchiveDirectory(jobData.config.archivePath, "study_metadata.json", buffer);
            })
            .then(function() {
                // add to job input
                jobData.config.inputs.StudyMetadata = 'agave://' + agaveSettings.storageSystem + '/' + jobData.config.archivePath + '/study_metadata.json';
            })
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
                console.log('VDJ-API INFO: createArchiveMetadataTask done for ' + jobData.config.name);
                done();
            })
            .fail(function(error) {
                var msg = 'VDJ-API ERROR: createArchiveMetadataTask error is: "' + error + '" for "' + jobData.config.name + '" project ' + jobData.projectUuid;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error('createArchiveMetadataTask error is: "' + error + '" for ' + jobData.config.name));
            })
            ;
    });

    taskQueue.process('submitJobTask', function(task, done) {
        var jobData = task.data;
        console.log(jobData);

        var job = new Job();
        var jobNotification = job.getJobNotification(jobData.projectUuid, jobData.config.name);
        jobData.config.notifications = [
            jobNotification,
        ];

        agaveIO.launchJob(JSON.stringify(jobData.config))
            .then(function(jobSubmitResponse) {
                jobData.jobId = jobSubmitResponse.id;
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
                console.log('VDJ-API INFO: submitJobTask done for ' + JSON.stringify(jobData.jobId));
                done();
            })
            .fail(function(error) {
                var msg = 'VDJ-API ERROR: submitJobTask error is: "' + error + '" for "' + jobData.config.name + '" project ' + jobData.projectUuid;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error('submitJobTask error is: "' + error + '" for "' + jobData.config.name + '" project ' + jobData.projectUuid));
            })
            ;
    });

    taskQueue.process('shareJobTask', function(task, done) {

        var jobData = task.data;
        //console.log(jobData);

        // Get project users
        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), jobData.projectUuid);
            })
            // (loop) add project users to job pems
            .then(function(projectPermissions) {

                var filePermissions = new FilePermissions();

                var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = projectUsernames.map(function(username) {
                    return function() {
                        return agaveIO.addUsernameToJobPermissions(
                            username,
                            ServiceAccount.accessToken(),
                            jobData.jobId
                        );
                    };
                });

                return promises.reduce(Q.when, new Q());
            })
            .then(function() {
                console.log('VDJ-API INFO: shareJobTask gave project users permissions for job ' + jobData.jobId);
                
                // create job metadata
                return agaveIO.createJobMetadata(jobData.projectUuid, jobData.jobId, jobData.secondaryInputs);
            })
            .then(function(resultObject) {
                if (resultObject) {
                    jobData.processMetadataUuid = resultObject.uuid;
                    console.log('VDJ-API INFO: shareJobTask created job metadata ' + resultObject.uuid + ' for job ' + jobData.jobId);

                    return agaveIO.addMetadataPermissionsForProjectUsers(jobData.projectUuid, resultObject.uuid);
                }
            })
            .then(function() {
                console.log('VDJ-API INFO: shareJobTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: shareJobTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    //
    //  This task gets added to the queue when job FINISHED notification is received

    //  Job finish processing tasks

    //  1. share job output files
    //  2. get process metadata job file and insert as agave metadata entry
    //  3. create project file metadata for job output files
    //  4. share project file metadata for job output files
    //  5. emit job complete webhook
    //

    // We use a redis guard for when duplicate FINISHED notifications are sent, but that
    //   only works within a short period of time as the guard expires. For longer term,
    //   check the existence of the process metadata.

    taskQueue.process('checkJobTask', function(task, done) {
        var jobData = task.data;

        // Get process metadata
        agaveIO.getProcessMetadataForJob(jobData.jobId)
            .then(function(resultObject) {
                //console.log(resultObject);
                if (resultObject.length != 0) {
                    return Q.reject(new Error('VDJ-API ERROR: checkJobTask for job ' + jobData.jobId + ' already has process metadata entry, possible duplicate FINISHED notification'));
                } else {
                    taskQueue
                        .create('shareJobOutputFilesTask', jobData)
                        .removeOnComplete(true)
                        .attempts(5)
                        .backoff({delay: 60 * 1000, type: 'fixed'})
                        .save()
                    ;
                }
            })
            .then(function() {
                console.log('VDJ-API INFO: checkJobTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.error(error);
                webhookIO.postToSlack(error);
                done(error);
            })
            ;
    });

    taskQueue.process('shareJobOutputFilesTask', function(task, done) {

        var jobData = task.data;

        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getJobOutput(jobData.jobId);
            })
            .then(function(jobOutput) {
                jobData.name = jobOutput.name;

                var job = new Job();

                var deconstructedUrl = job.deconstructJobListingUrl(jobOutput);

                jobData.projectUuid = deconstructedUrl.projectUuid;
                jobData.relativeArchivePath = deconstructedUrl.relativeArchivePath;
            })
            .then(function() {
                return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), jobData.projectUuid);
            })
            .then(function(projectPermissions) {
                var metadataPermissions = new MetadataPermissions();

                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = projectUsernames.map(function(username) {
                    return function() {
                        return agaveIO.addUsernameToFullFilePermissions(
                            username,
                            ServiceAccount.accessToken(),
                            jobData.projectUuid + '/analyses' + '/' + jobData.relativeArchivePath,
                            false
                        );
                    };
                });

                return promises.reduce(Q.when, new Q()); // 3.

                //return agaveIO.getJobOutputFileListings(jobData.projectUuid, jobData.relativeArchivePath)

            })
            .then(function() {
                taskQueue
                    .create('createProcessMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: shareJobOutputFilesTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: shareJobOutputFilesTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobOutputFilesTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('createProcessMetadataTask', function(task, done) {
        var jobData = task.data;

        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getJobProcessMetadataFileListing(jobData.projectUuid, jobData.relativeArchivePath);
            })
            .then(function(jobProcessMetadataListing) {

                //console.log(jobProcessMetadataListing);

                if (jobProcessMetadataListing.length > 0) {
                    console.log('VDJ-API INFO: createProcessMetadataTask: job ' + jobData.jobId + ' has process_metadata.json');
                    return agaveIO.getJobProcessMetadataFileContents(jobData.projectUuid, jobData.relativeArchivePath);
                } else {
                    console.log('VDJ-API INFO: createProcessMetadataTask: job ' + jobData.jobId + ' is missing process_metadata.json');
                    webhookIO.postToSlack('VDJ-API INFO: createProcessMetadataTask: job ' + jobData.jobId + ' is missing process_metadata.json');
                    return null;
                }
            })
            .then(function(fileData) {
                if (fileData) {
                    //console.log(fileData);
                    if (jsonApprover.isJSON(fileData)) {
                        jobData.processMetadata = JSON.parse(fileData);
                        console.log('VDJ-API INFO: createProcessMetadataTask: job ' + jobData.jobId + ' loaded process_metadata.json');
                        return agaveIO.createProcessMetadata(jobData.projectUuid, jobData.jobId, jobData.processMetadata);
                    } else {
                        console.log('VDJ-API INFO: createProcessMetadataTask: process_metadata.json for job ' + jobData.jobId + ' is invalid JSON.');
                        webhookIO.postToSlack('VDJ-API INFO: createProcessMetadataTask: process_metadata.json for job ' + jobData.jobId + ' is invalid JSON.');
                        return null;
                    }
                }
            })
            .then(function(resultObject) {
                if (resultObject) {
                    jobData.processMetadataUuid = resultObject.uuid;
                    console.log('VDJ-API INFO: createProcessMetadataTask created process metadata ' + resultObject.uuid + ' for job ' + jobData.jobId);

                    return agaveIO.addMetadataPermissionsForProjectUsers(jobData.projectUuid, resultObject.uuid);
                }
            })
            .then(function() {
                if (jobData.processMetadataUuid) {
                    console.log('VDJ-API INFO: createProcessMetadataTask set permissions on process metadata ' + jobData.processMetadataUuid + ' for job ' + jobData.jobId);
                }

                taskQueue
                    .create('createJobOutputFileMetadataTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: createProcessMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fin(function() {
                taskQueue
                    .create('removeJobGuardTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                ;
            })
            .fail(function(error) {
                var msg = 'VDJ-API ERROR: createProcessMetadataTask error is: "' + error + '" for ' + jobData.jobId;
                console.error(msg);
                webhookIO.postToSlack(msg);

                done(new Error('createProcessMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('createJobOutputFileMetadataTask', function(task, done) {
        var jobData = task.data;

        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getJobOutputFileListings(jobData.projectUuid, jobData.relativeArchivePath);
            })
            .then(function(jobFileListings) {

                var promises = jobFileListings.map(function(jobFileListing) {

                    // match the file with process metadata
                    var found = false;
                    if (jobData.processMetadata) {
                        for (var file in jobData.processMetadata.files) {
                            for (var key in jobData.processMetadata.files[file]) {
                                if (jobData.processMetadata.files[file][key]['value'] == jobFileListing.name) {
                                    found = true;
                                    var fileType = fileTypeMapping[jobData.processMetadata.files[file][key]['type']]
                                    if (!fileType) jobFileListing.fileType = 0;
                                    else jobFileListing.fileType = fileType;
                                    break;
                                }
                            }
                            if (found) break;
                        }
                        if (found) {
                            return function() {
                                return agaveIO.createProjectJobFileMetadata(
                                    jobData.projectUuid,
                                    jobData.jobId,
                                    jobFileListing.name,
                                    jobFileListing.length,
                                    jobFileListing.fileType,
                                    jobData.name,
                                    jobData.relativeArchivePath
                                );
                            };
                        } else {
                            var job = new Job();
                            if (!job.isWhitelistedFiletype(jobFileListing.name)) {
                                var msg = 'VDJ-API INFO: createJobOutputFileMetadataTask job ' + jobData.jobId + ' has output file "' + jobFileListing.name + '" which is not in process metadata.';
                                console.log(msg);
                                webhookIO.postToSlack(msg);
                            }
                        }
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
                console.log('VDJ-API INFO: createJobOutputFileMetadataTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: createJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('createJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    // get project permissions
    // get job output file metadata
    // share metadata
    taskQueue.process('shareJobOutputFileMetadataTask', function(task, done) {
        var jobData = task.data;

        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), jobData.projectUuid);
            })
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
                                        ServiceAccount.accessToken(),
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
                console.log('VDJ-API INFO: shareJobOutputFileMetadataTask done for ' + jobData.jobId);

                taskQueue
                    .create('jobCompleteTask', jobData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;

                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: shareJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('jobCompleteTask', function(task, done) {
        var jobData = task.data;

        // all done, emit the FINISHED notification
        app.emit(
            'jobNotification',
            {
                jobId: jobData.jobId,
                jobEvent: jobData.jobEvent,
                jobStatus: jobData.jobStatus,
                jobMessage: jobData.jobMessage,
                projectUuid: jobData.projectUuid,
                jobName: decodeURIComponent(jobData.jobName),
            }
        );

        // send emails
        ServiceAccount.getToken()
            .then(function(token) {
                return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), jobData.projectUuid);
            })
            .then(function(projectPermissions) {
                // send emails
                var metadataPermissions = new MetadataPermissions();
                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = projectUsernames.map(function(username) {
                    return function() {
                        return agaveIO.getUserProfile(username)
                            .then(function(userProfileList) {
                                if (userProfileList.length == 0) return;
                                if (username == agaveSettings.guestAccountKey) return;
                                var userProfile = userProfileList[0];
                                if (!userProfile.value.disableJobEmail) {
                                    var vdjWebappUrl = agaveSettings.vdjBackbone
                                        + '/project/'
                                        + jobData.projectUuid
                                        + '/jobs/'
                                        + jobData.jobId
                                    ;
                                    emailIO.sendGenericEmail(userProfile.value.email,
                                                             'VDJServer job is finished',
                                                             'Your VDJServer job "' + decodeURIComponent(jobData.jobName)
                                                             + ' for application ' + jobData.jobOutput.appId + '" is finished.'
                                                             + '<br>'
                                                             + 'You can view analyses and results with the link below:'
                                                             + '<br>'
                                                             + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                                             );
                                }
                            });
                    };
                });

                return promises.reduce(Q.when, new Q());
            })
            .then(function() {
                console.log('VDJ-API INFO: jobCompleteTask for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.error('VDJ-API ERROR: jobCompleteTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('jobCompleteTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('removeJobGuardTask', function(task, done) {
        var jobData = task.data;

        // remove the guard
        var guardKey = 'guard-' + jobData.jobId;
        var redisClient = kue.redis.createClient();

        Q.ninvoke(redisClient, 'del', guardKey)
            .finally(function() {
                console.log('VDJ-API INFO: removeJobGuardTask for job ' + jobData.jobId);
                
                done();
            });
    });

}; */
