
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
var jsonApprover = require('json-approver');
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

        1. createArchivePath
	2. Gather current study metadata and put in archive file
        3. launch job w/ notification embedded
        4. share job
        5. share pointer metadata
    */

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
                console.log('VDJ-API ERROR: createArchivePathDirectoryTask error is: "' + error + '" for ' + jobData.config.name);
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

		return agaveIO.getSampleMetadata(ServiceAccount.accessToken(), jobData.projectUuid);
	    })
	    .then(function(sampleMetadata) {
		metadata.samples = sampleMetadata;
		//console.log(metadata);

		return agaveIO.getProjectFileMetadataPermissions(ServiceAccount.accessToken(), jobData.projectUuid);
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
                console.log('VDJ-API ERROR: createArchiveMetadataTask error is: "' + error + '" for ' + jobData.config.name);
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
		var msg = 'VDJ-API ERROR: submitJobTask error is: "' + error + '" for ' + jobData;
                console.log(msg);
		webhookIO.postToSlack(msg);
                done(new Error('submitJobTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    taskQueue.process('shareJobTask', function(task, done) {

        var jobData = task.data;
	console.log(jobData);

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
                console.log('VDJ-API INFO: shareJobTask done for ' + jobData.jobId);
                done();
            })
            .fail(function(error) {
                console.log('VDJ-API ERROR: shareJobTask error is: "' + error + '" for ' + jobData.jobId);
                done(new Error('shareJobTask error is: "' + error + '" for ' + jobData.jobId));
            })
            ;
    });

    /*
      This task gets added to the queue when job FINISHED notification is received

      Job finish processing tasks

      1. share job output files
      2. get process metadata job file and insert as agave metadata entry
      3. create project file metadata for job output files
      4. share project file metadata for job output files
      5. emit job complete webhook
    */

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

                return agaveIO.getJobOutputFileListings(jobData.projectUuid, jobData.relativeArchivePath)
                    .then(function(jobFileListings) {

                        var promises = projectUsernames.map(function(username) {
                            return function() {
                                return agaveIO.addUsernameToFullFilePermissions(
                                    username,
                                    ServiceAccount.accessToken(),
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
                console.log('VDJ-API ERROR: shareJobOutputFilesTask error is: "' + error + '" for ' + jobData.jobId);
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
            .fail(function(error) {
                console.log('VDJ-API ERROR: createProcessMetadataTask error is: "' + error + '" for ' + jobData.jobId);
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
				if (jobData.processMetadata.files[file][key] == jobFileListing.name) {
				    found = true;
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
                                    jobData.name,
                                    jobData.relativeArchivePath
				);
                            };
			} else {
			    var job = new Job();
			    if (!job.isWhitelistedFiletype(jobFileListing.name))
				console.log('VDJ-API INFO: createJobOutputFileMetadataTask job ' + jobData.jobId + ' has output file "' + jobFileListing.name + '" which is not in process metadata.');
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
                console.log('VDJ-API ERROR: createJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
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
                console.log('VDJ-API ERROR: shareJobOutputFileMetadataTask error is: "' + error + '" for ' + jobData.jobId);
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

        console.log('VDJ-API INFO: jobCompleteTask for ' + jobData.jobId);

        done();
    });

};
