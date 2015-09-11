
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');

var JobsController = {};
module.exports = JobsController;

JobsController.createJobMetadata = function(request, response) {
    /*
        1.  Create job metadata associating job w/ projectUuid
        2.  Get project permissions
        3.  Update permissions on job metadata
        4a. Success
        4b. Fail
    */

    var jobUuid     = request.body.jobUuid;
    var projectUuid = request.body.projectUuid;

    if (!jobUuid) {
        console.error('JobsController.createJobMetadata - error - missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('JobsController.createJobMetadata - error - missing projectUuid parameter');
        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    console.log('JobsController.createJobMetadata - event - begin for jobId ' + jobUuid);

    var serviceAccount = new ServiceAccount();
    var jobMetadataUuid;

    agaveIO.createJobMetadata(projectUuid, jobUuid) // 1.
        .then(function(jobMetadata) {
            console.log('JobsController.createJobMetadata - event - createJobMetadata for jobId ' + jobUuid);

            jobMetadataUuid = jobMetadata.uuid;
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid); // 2.
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {
            console.log('JobsController.createJobMetadata - event - getMetadataPermissions for jobId ' + jobUuid);

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    serviceAccount.accessToken,
                    jobMetadataUuid
                );
            }

            return promises.reduce(Q.when, new Q()); // 3.
        })
        .then(function() {
            console.log('JobsController.createJobMetadata - event - complete for jobId ' + jobUuid);

            apiResponseController.sendSuccess('Job metadata created successfully.', response); // 4a.
        })
        .fail(function(error) {
            console.error('JobsController.createJobMetadata - error - jobId ' + jobUuid + ', error ' + error);

            apiResponseController.sendError(error.message, 500, response); // 4b.
        })
        ;
};

JobsController.createJobFileMetadata = function(jobId) {

    /* Follow this recipe:
     *
     * 1.) Get job output for file path
     * 2.) Get file listings for file path
     * 3.) Create project job file metadata for each completed job file (loop)
     * 4.) Pull new project job file metadatas
     * 5.) Pull project metadata permissions
     * 6.) Sync job files with project metadatas permissions
     * 7.) Sync project file metadata with project metadatas permissions
     */

    var serviceAccount = new ServiceAccount();
    var relativeArchivePath = '';
    var projectUuid = '';
    var projectJobFileMetadatas = '';
    var projectPermissions = '';
    var job = '';

    console.log('JobsController.createJobFileMetadata - event - begin for jobId ' + jobId);

    agaveIO.getJobOutput(jobId) // 1
        .then(function(jobOutput) {
            console.log('JobsController.createJobFileMetadata - event - getJobOutput for jobId ' + jobId);

            job = jobOutput;

            var archivePath = jobOutput._links.archiveData.href;

            var splitArchivePath = archivePath.split('/');

            relativeArchivePath = splitArchivePath[splitArchivePath.length - 1];
            projectUuid = splitArchivePath[splitArchivePath.length - 3];

            return agaveIO.getJobOutputFileListings(projectUuid, relativeArchivePath); // 2
        })
        .then(function(jobFileListings) {
            console.log('JobsController.createJobFileMetadata - event - getJobOutputFileListings for jobId ' + jobId);

            var promises = [];

            function createAgaveCall(projectUuid, jobId, jobFileListing, job, relativeArchivePath) {

                return function() {

                    return agaveIO.createProjectJobFileMetadata(
                        projectUuid,
                        jobId,
                        jobFileListing,
                        job,
                        relativeArchivePath
                    );
                };
            }

            for (var i = 0; i < jobFileListings.length; i++) {

                var fileNameSplit = jobFileListings[i].name.split('.');
                var fileExtension = fileNameSplit[fileNameSplit.length - 1];
                var doubleFileExtension = fileNameSplit[fileNameSplit.length - 2] + '.' + fileNameSplit[fileNameSplit.length - 1];

                // Whitelisted files
                if (fileExtension === 'fasta'
                    ||
                    fileExtension === 'fastq'
                    ||
                    fileExtension === 'vdjml'
                    ||
                    doubleFileExtension === 'rc_out.tsv'
                ) {
                    promises[i] = createAgaveCall(
                        projectUuid,
                        jobId,
                        jobFileListings[i],
                        job,
                        relativeArchivePath
                    );
                }
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('JobsController.createJobFileMetadata - event - createProjectJobFileMetadata for jobId ' + jobId);

            return agaveIO.getProjectJobFileMetadatas(projectUuid, jobId);
        })
        .then(function(metadatas) {
            console.log('JobsController.createJobFileMetadata - event - getProjectJobFileMetadatas for jobId ' + jobId);

            projectJobFileMetadatas = metadatas;

            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        .then(function(tmpProjectPermissions) {
            console.log('JobsController.createJobFileMetadata - event - getMetadataPermissions for jobId ' + jobId);

            projectPermissions = tmpProjectPermissions;
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(tmpProjectPermissions);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var j = 0; j < projectUsernames.length; j++) {
                promises.push(
                    createAgaveCall(
                        projectUsernames[j],
                        serviceAccount.accessToken,
                        projectUuid + '/analyses' + '/' + relativeArchivePath
                    )
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('JobsController.createJobFileMetadata - event - addUsernameToFullFilePermissions for jobId ' + jobId);

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username, token, uuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        uuid
                    );
                };
            }

            for (var i = 0; i < projectJobFileMetadatas.length; i++) {
                for (var j = 0; j < projectUsernames.length; j++) {
                    promises.push(
                        createAgaveCall(
                            projectUsernames[j],
                            serviceAccount.accessToken,
                            projectJobFileMetadatas[i].uuid
                        )
                    );
                }
            }

            return promises.reduce(Q.when, new Q());
        })
        .fail(function(error) {
            console.error('JobsController.createJobFileMetadata - error - jobId ' + jobId + ', error ' + error);

            apiResponseController.sendError(error.message, 500, response); // 4b.
        })
        ;
};
