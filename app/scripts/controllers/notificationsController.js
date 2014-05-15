
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var JobArchivePath = require('../models/jobArchivePath');
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Node Libraries
var Q = require('q');

var NotificationsController = {};
module.exports = NotificationsController;

NotificationsController.processJobCreatedNotification = function(request, response) {
    /*
        1.  Parse projectUuid out of jobArchivePath
        2.  Create job metadata associating job w/ projectUuid
        3.  Get project permissions
        4.  Update permissions on job metadata
        5a. Success
        5b. Fail
    */

    var jobUuid = request.body.jobUuid;
    var jobArchivePath = new JobArchivePath(request.body.jobArchivePath);
    var projectUuid = jobArchivePath.getProjectUuid(); // 1.

    var serviceAccount = new ServiceAccount();
    var jobMetadataUuid;

    agaveIO.createJobMetadata(projectUuid, jobUuid) // 2.
        .then(function(jobMetadata) {
            jobMetadataUuid = jobMetadata.uuid;

            return agaveIO.getMetadataPermissions(serviceAccount.accessToken, projectUuid); // 3.
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                promises.push(agaveIO.addUsernameToMetadataPermissions(projectUsernames[i], serviceAccount.accessToken, jobMetadataUuid));
            }

            return Q.all(promises); // 4.
        })
        .then(function() {
            apiResponseController.sendSuccess('Notification processed successfully.', response); // 5a.
        })
        .fail(function(error) {
            apiResponseController.sendError(error.message, response); // 5b.
        });
};
