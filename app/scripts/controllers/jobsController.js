
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

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

    var serviceAccount = new ServiceAccount();
    var jobMetadataUuid;

    agaveIO.createJobMetadata(projectUuid, jobUuid) // 1.
        .then(function(jobMetadata) {
            jobMetadataUuid = jobMetadata.uuid;
            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid); // 2.
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {

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
            apiResponseController.sendSuccess('Job metadata created successfully.', response); // 4a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response); // 4b.
        });
};

JobsController.createJobFileMetadata = function(jobId) {

    /* Follow this recipe:
     *
     * 1.) Get job output for file path
     * 2.) Get file listings for file path
     * 3.) Create project job file metadata for each completed job file (loop)
     * 4.) Pull new project job file metadatas
     * 5.) Pull project metadata permissions
     * 6.) Sync project file metadata with project metadatas permissions
     */

    var serviceAccount = new ServiceAccount();
    var relativeArchivePath = '';
    var projectUuid = '';
    var projectJobFileMetadatas = '';

    agaveIO.getJobOutput(jobId) // 1
        .then(function(jobOutput) {
            var archivePath = jobOutput._links.archiveData.href;

            var splitArchivePath = archivePath.split('/');

            relativeArchivePath = splitArchivePath[splitArchivePath.length - 1];
            projectUuid = splitArchivePath[splitArchivePath.length - 3];

            return agaveIO.getJobOutputFileListings(projectUuid, relativeArchivePath); // 2
        })
        .then(function(jobFileListings) {

            var promises = [];

            function createAgaveCall(projectUuid, jobId, jobFileListing) {

                return function() {

                    return agaveIO.createProjectJobFileMetadata(
                        projectUuid,
                        jobId,
                        jobFileListing,
                        relativeArchivePath
                    );
                };
            }

            for (var i = 0; i < jobFileListings.length; i++) {

                var fileNameSplit = jobFileListings[i].name.split('.');
                var fileExtension = fileNameSplit[fileNameSplit.length - 1];

                // Whitelisted files
                if (fileExtension === 'fasta' || fileExtension === 'fastq') {
                    promises[i] = createAgaveCall(
                        projectUuid,
                        jobId,
                        jobFileListings[i],
                        relativeArchivePath
                    );
                }
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            return agaveIO.getProjectJobFileMetadatas(projectUuid, jobId);
        })
        .then(function(metadatas) {
            projectJobFileMetadatas = metadatas;

            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid);
        })
        .then(function(projectPermissions) {

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
        ;
};
