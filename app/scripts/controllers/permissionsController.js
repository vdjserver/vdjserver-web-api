
'use strict';

//
// permissionsController.js
// Handle security and authorization checks
//
// VDJServer Analysis Portal
// VDJ Web API service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
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

var PermissionsController = {};
module.exports = PermissionsController;

// App
var app = require('../app');
var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');
var authController = require('./authController');

// Models
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var ServiceAccount = tapisIO.serviceAccount;

// Processing
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var d3 = require('d3');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

//
// Synchronize permissions on metadata object for all project users.
// When a new metadata object is created, the permissions need to be
// synchronized so that all users on the project have access to it.
//
/* not needed for tapis v3
PermissionsController.syncMetadataPermissionsWithProject = function(request, response) {

    var uuid        = request.body.metadata_uuid;
    var projectUuid = request.body.project_uuid;
    var accessToken = authController.extractToken(request);
    var username = request.user.username;

    console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - begin for project: ' + projectUuid + ' for metadata: ' + uuid);

    // verify the user has write access to metadata object
    return authController.verifyMetadataAccess(uuid, accessToken, username)
        .then(function(result) {
            if (!result) {
                var msg = 'VDJ-API ERROR: PermissionsController.syncMetadataPermissionsWithProject - invalid metadata access: ' + uuid + ', for user: ' + username;
                return Promise.reject(new Error(msg));
            } else {
                // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
                return ServiceAccount.getToken();
            }
        })
        .then(function(token) {
            // First, make sure serviceAccount has full pems on the new metadata
            // Use the user's accessToken to set this since serviceAccount may not have full pems yet
            return tapisIO.addUsernameToMetadataPermissions(ServiceAccount.username, accessToken, uuid);
        })
        // Next, fetch project metadata pems
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - add service account pems for project ' + projectUuid);
            return tapisIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // Apply project pems to new metadata
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - getMetadataPermissions for project ' + projectUuid);

            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = tapisIO.addUsernameToMetadataPermissions(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
                    uuid
                );
            }

            return Promise.allSettled(promises);
        })
        // Get fileMetadata pems listing to return to user
        .then(function() {
            console.log(
                'VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - addUsernameToMetadataPermissions for project ' + projectUuid
            );

            return tapisIO.getMetadataPermissions(ServiceAccount.accessToken(), uuid);
        })
        // Finally send updated fileMetadata pems back to user
        .then(function(updatedFileMetadataPermissions) {
            console.log(
                'VDJ-API INFO: PermissionsController.syncMetadataPermissionsWithProject - complete for project ' + projectUuid
            );

            return apiResponseController.sendSuccess(updatedFileMetadataPermissions, response);
        })
        .catch(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.syncMetadataPermissionsWithProject - error - projectUuid ' + projectUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
}; */

//
// Add user to a project by giving them permissions on all of the project objects
// Verify the user to be given permissions then kick off task to queue
// The task processing code is in queues/projectQueueManager.js
//
PermissionsController.addPermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.project_uuid;
    var accessToken = authController.extractToken(request);

    console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - begin for project ' + projectUuid + ' for user ' + username);

    // verify the user
    return authController.verifyUser(username)
        .then(function(result) {
            if (!result) {
                var msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - attempt to add invalid user: ' + username;
                console.error(msg);
                webhookIO.postToSlack(msg);
                apiResponseController.sendError('Attempt to add invalid user account.', 400, response);
                return null;
            } else {
                // Check that userToken is part of project (if it can fetch proj pems, then we're ok)
                return tapisIO.getMetadataPermissions(accessToken, projectUuid);
            }
        })
        .then(function(projectPermissions) {
            console.log(projectPermissions);
            if (!projectPermissions) return;

            var projectData = { username: username, projectUuid: projectUuid };

            taskQueue
                .create('addUsernameToProjectTask', projectData)
                .removeOnComplete(true)
                .attempts(5)
                .backoff({delay: 60 * 1000, type: 'fixed'})
                .save()
            ;

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: PermissionsController.addPermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 500, response);
        })
        ;
};

//
// Remove user frome a project by removing permissions on all of the project objects
// Verify the user then kick off task to queue
// The task processing code is in queues/projectQueueManager.js
//
PermissionsController.removePermissionsForUsername = function(request, response) {

    var username    = request.body.username;
    var projectUuid = request.body.project_uuid;
    var accessToken = authController.extractToken(request);

    var projectUsernames;

    console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - begin for project ' + projectUuid);

    // TODO: think about implementing a project owner
    // Only the owner can add/remove user?
    // The owner cannot remove themselves, must change owner?
    // Not a complete solution because somebody can steal ownership

    // We do not verify if the user is even on the project.
    // This is in case the user got partially removed, and we need
    // to restart the removal process.
    ServiceAccount.getToken()
        .then(function(token) {
            return tapisIO.getMetadataPermissions(accessToken, projectUuid);
        })
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.removePermissionsForUsername - getMetadataPermissions for project ' + projectUuid);

            // save usernames for sending emails later
            var metadataPermissions = new MetadataPermissions();
            projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);
            var projectData = { username: username, projectUuid: projectUuid, projectUsernames: projectUsernames };

            taskQueue
                .create('removeUsernameFromProjectTask', projectData)
                .removeOnComplete(true)
                .attempts(5)
                .backoff({delay: 60 * 1000, type: 'fixed'})
                .save()
            ;

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: PermissionsController.removePermissionsForUsername - error - projectUuid ' + projectUuid + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 500, response);
        });
};

/*
PermissionsController.addPermissionsForJob = function(request, response) {

    var jobUuid = request.body.jobUuid;
    var projectUuid = request.body.projectUuid;
    var accessToken = request.user.password;

    if (!jobUuid) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing jobUuid parameter');

        apiResponseController.sendError('JobUuid required.', 400, response);
        return;
    }

    if (!projectUuid) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing projectUuid parameter');

        apiResponseController.sendError('Project Uuid required.', 400, response);
        return;
    }

    if (!accessToken) {
        console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - missing accessToken parameter');

        apiResponseController.sendError('Access Token required.', 400, response);
        return;
    }

    var projectUsernames;

    console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - begin for job ' + jobUuid);

    // Add service account to job pems
    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.addUsernameToJobPermissions(ServiceAccount.username, accessToken, jobUuid);
        })
        // Get project users
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        // (loop) add project users to job pems
        .then(function(projectPermissions) {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - getMetadataPermissions for job ' + jobUuid);

            var filePermissions = new FilePermissions();

            projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];

            function createAgaveCall(username, token, jobUuid) {

                return function() {

                    return agaveIO.addUsernameToJobPermissions(
                        username,
                        token,
                        jobUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
                    jobUuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // (loop) set job output file permissions
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToJobPermissions for job ' + jobUuid);

            var promises = [];

            function createAgaveCall(username, token, path) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        token,
                        path,
                        true
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
                    projectUuid + '/analyses'
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        // get job metadatas
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToFullFilePermissions for job ' + jobUuid);

            return agaveIO.getJobMetadataForProject(projectUuid);
        })
        // (loop) add to job metadata permissions
        .then(function(tmpJobMetadata) {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - getJobMetadataForProject for job ' + jobUuid);

            var jobMetaUuid = tmpJobMetadata.uuid;

            if (!jobMetaUuid || jobMetaUuid.length === 0) {
                jobMetaUuid = tmpJobMetadata[0].uuid;
            }

            var promises = [];

            function createAgaveCall(username, token, jobMetaUuid) {

                return function() {

                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        token,
                        jobMetaUuid
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {
                promises[i] = createAgaveCall(
                    projectUsernames[i],
                    ServiceAccount.accessToken(),
                    jobMetaUuid
                );
            }

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('VDJ-API INFO: PermissionsController.addPermissionsForJob - event - addUsernameToMetadataPermissions for job ' + jobUuid);

            return apiResponseController.sendSuccess('success', response);
        })
        .catch(function(error) {
            console.error('VDJ-API ERROR: PermissionsController.addPermissionsForJob - error - job ' + jobUuid + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
*/
