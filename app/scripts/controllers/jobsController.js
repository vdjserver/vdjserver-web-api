
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
            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(
                    agaveIO.addUsernameToMetadataPermissions(
                        projectUsernames[i],
                        serviceAccount.accessToken,
                        jobMetadataUuid
                    )
                );
            }

            return Q.all(promises); // 3.
        })
        .then(function() {
            apiResponseController.sendSuccess('Job metadata created successfully.', response); // 4a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response); // 4b.
        });
};
