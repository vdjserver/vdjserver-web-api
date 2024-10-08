
'use strict';

//
// projectQueueManager.js
// Manage project tasks
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

var ProjectQueueManager = {};
module.exports = ProjectQueueManager;

// App
var app = require('../app');
var config = require('../config/config');
var mongoSettings = require('../config/mongoSettings');

// Models
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');
var Job = require('../models/job');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;
var ServiceAccount = tapisIO.serviceAccount;

// Processing
var mongoIO = require('../vendor/mongoIO');
var webhookIO = require('../vendor/webhookIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Queue = require('bull');
var jsonApprover = require('json-approver');
//var kue = require('kue');
//var taskQueue = kue.createQueue({
//    redis: app.redisConfig,
//});

// Bull queues
var addUserQueue = new Queue('Add user to project', { redis: app.redisConfig });
var removeUserQueue = new Queue('Remove user from project', { redis: app.redisConfig });
var unloadQueue = new Queue('ADC project unload', { redis: app.redisConfig });


//
// Add user to a project by giving them permissions on all of the project objects.
// Set project metadata last so the project doesn't show up in the user's project
// list until all other permissions have been set.
//
// 1. project files and subdirectories
// 2. project file metadata
// 3. project jobs
// 4. project metadata
// 5. send emails
//

ProjectQueueManager.addUserToProject = function(data) {
    addUserQueue.add(data);
};

addUserQueue.process(async (job) => {
    var context = 'ProjectQueueManager.addUserQueue';
    var msg = null;
    var username = job['data']['username'];
    var project_uuid = job['data']['project_uuid'];

    try {

        config.log.info(context, 'start, project: ' + project_uuid + ' for user: ' + username);
    
        // Promise.reject() will leave the job in the queue to try again
        // Promise.resolve() considers the job done
    
        // set permissions on project directories
        config.log.info(context, 'grant file permissions.');
    
        await tapisIO.grantProjectFilePermissions(username, project_uuid, '')
            .catch(function(error) {
                msg = 'tapisIO.grantProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.grantProjectFilePermissions(username, project_uuid, 'files')
            .catch(function(error) {
                msg = 'tapisIO.grantProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.grantProjectFilePermissions(username, project_uuid, 'analyses')
            .catch(function(error) {
                msg = 'tapisIO.grantProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.grantProjectFilePermissions(username, project_uuid, 'deleted')
            .catch(function(error) {
                msg = 'tapisIO.grantProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        // TODO: do we need to iterate through the analyses directory?
        // TODO: add permissions to jobs
        config.log.info(context, 'TODO: grant job permissions.');
    
        // add permission to project
        config.log.info(context, 'grant project permission.');
        var metadata = await tapisIO.addProjectPermissionForUser(project_uuid, username)
            .catch(function(error) {
                msg = 'tapisIO.addProjectPermissionForUser error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        // send emails
        config.log.info(context, 'send emails.');
        for (let i in metadata['permission']) {
            let user = metadata['permission'][i]['username'];
            let userProfileList = await tapisIO.getUserProfile(user);
            if (userProfileList.length == 0) {
                config.log.error(context, 'user ' + user + ' is missing profile, skip sending email.');
                continue;
            }
            if (username == tapisSettings.guestAccountKey) continue;
            let userProfile = userProfileList[0];
            if (!userProfile.value.email || userProfile.value.email.length == 0) {
                config.log.error(context, 'user ' + user + ' is missing email address, skip sending email.');
                continue;
            }
            if (!userProfile.value.disableUserEmail) {
                var vdjWebappUrl = tapisSettings.vdjBackbone + '/project/' + project_uuid;
                await emailIO.sendGenericEmail(userProfile.value.email,
                                         'VDJServer user added to project',
                                         'VDJServer user "' + username + '" has been added to project "' + metadata['value']['study_title'] + '".'
                                         + '<br>'
                                         + 'You can view the project with the link below:'
                                         + '<br>'
                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                        );
            }
        }
    
        config.log.info(context, 'complete, project: ' + project_uuid + ' for user: ' + username);
        return Promise.resolve();

    } catch (e) {
        msg = config.log.error(context, e + '\n' + e.stack);
        webhookIO.postToSlack(msg);
        throw e;
    }
});


ProjectQueueManager.removeUserFromProject = function(data) {
    removeUserQueue.add(data);
};

removeUserQueue.process(async (job) => {
    var context = 'ProjectQueueManager.removeUserQueue';
    var msg = null;
    var username = job['data']['username'];
    var project_uuid = job['data']['project_uuid'];

    try {

        config.log.info(context, 'start, project: ' + project_uuid + ' for user: ' + username);
    
        // Promise.reject() will leave the job in the queue to try again
        // Promise.resolve() considers the job done
    
        // remove permissions on project directories
        config.log.info(context, 'revoke file permissions.');
    
        await tapisIO.removeProjectFilePermissions(username, project_uuid, 'files')
            .catch(function(error) {
                msg = 'tapisIO.removeProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.removeProjectFilePermissions(username, project_uuid, 'analyses')
            .catch(function(error) {
                msg = 'tapisIO.removeProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.removeProjectFilePermissions(username, project_uuid, 'deleted')
            .catch(function(error) {
                msg = 'tapisIO.removeProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        await tapisIO.removeProjectFilePermissions(username, project_uuid, '')
            .catch(function(error) {
                msg = 'tapisIO.removeProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
    
        // TODO: do we need to iterate through the analyses directory?
        // TODO: add permissions to jobs
        config.log.info(context, 'TODO: revoke job permissions.');
    
        // add permission to project
        config.log.info(context, 'revoke project permission.');
        var orig_metadata = await tapisIO.getProjectMetadata(username, project_uuid);
        orig_metadata = orig_metadata[0];

        var metadata = await tapisIO.removeProjectPermissionForUser(project_uuid, username)
            .catch(function(error) {
                msg = 'tapisIO.grantProjectFilePermissions error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }

        // send emails
        config.log.info(context, 'send emails.');
        for (let i in orig_metadata['permission']) {
            let user = orig_metadata['permission'][i]['username'];
            let userProfileList = await tapisIO.getUserProfile(user);
            if (userProfileList.length == 0) {
                config.log.error(context, 'user ' + user + ' is missing profile, skip sending email.');
                continue;
            }
            if (username == tapisSettings.guestAccountKey) continue;
            let userProfile = userProfileList[0];
            if (!userProfile.value.email || userProfile.value.email.length == 0) {
                config.log.error(context, 'user ' + user + ' is missing email address, skip sending email.');
                continue;
            }
            if (!userProfile.value.disableUserEmail) {
                var vdjWebappUrl = tapisSettings.vdjBackbone + '/project/' + project_uuid;
                await emailIO.sendGenericEmail(userProfile.value.email,
                                         'VDJServer user removed from project',
                                         'VDJServer user "' + username + '" has been removed from project "' + metadata['value']['study_title'] + '".'
                                         + '<br>'
                                         + 'You can view the project with the link below:'
                                         + '<br>'
                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                        );
            }
        }
    
        config.log.info(context, 'complete, project: ' + project_uuid + ' for user: ' + username);
        return Promise.resolve();

    } catch (e) {
        msg = config.log.error(context, e + '\n' + e.stack);
        webhookIO.postToSlack(msg);
        throw e;
    }
});


/*
  OLD CODE


//
// Because loading rearrangement data is resource intensive, we
// only want one load occurring at a time. Here we check the task
// queues to see if a rearrangement load is running.
//
ProjectQueueManager.checkRearrangementLoad = function() {

    console.log('VDJ-API INFO: projectQueueManager.checkRearrangementLoad');

    var isRunning = false;

    var activePromise = new Promise(function(resolve, reject) {
        kue.Job.rangeByType('rearrangementLoadTask', 'active', 0, 1000, 'asc', function(error, jobs) {
            console.log(jobs.length);
            if (jobs.length > 0) isRunning = true;
            resolve();
        });
    });

    var inactivePromise = new Promise(function(resolve, reject) {
        kue.Job.rangeByType('rearrangementLoadTask', 'inactive', 0, 1000, 'asc', function(error, jobs) {
            console.log(jobs.length);
            if (jobs.length > 0) isRunning = true;
            resolve();
        });
    });

    return activePromise
        .then(function() {
            return inactivePromise;
        })
        .then(function() {
            if (! isRunning) {
                // no rearrangement load is running so kick off a task
                console.log('VDJ-API INFO: projectQueueManager.checkRearrangementLoad, no rearrangement load task running, triggering task.');
                taskQueue
                    .create('rearrangementLoadTask', null)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save();
            } else {
                console.log('VDJ-API INFO: projectQueueManager.checkRearrangementLoad, a rearrangement load task is running.');
            }
    
            return isRunning;
        });
};


//
// Trigger queue process to load for projects to be loaded
//
ProjectQueueManager.triggerProjectLoad = function() {
    console.log('VDJ-API INFO (ProjectQueueManager.triggerProjectLoad):');
    taskQueue
        .create('checkProjectsToLoadTask', null)
        .removeOnComplete(true)
        .attempts(5)
        .backoff({delay: 60 * 1000, type: 'fixed'})
        .save();
}


ProjectQueueManager.processProjects = function() {

    // Publishing a project to community data
    // mainly entails setting permissions on
    // the files, jobs and metadata for the
    // project to be readable for guest account.
    // 
    // 1. Set permissions on project files
    // 2. Set permissions on jobs output files
    // 3. Set permissions on metadata
    // 4. Update project metadata to public

    taskQueue.process('publishProjectFilesPermissionsTask', function(task, done) {
        // 1. Set permissions on project files

        var projectUuid = task.data;
        var msg = null;

        console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectFilesPermissionsTask.');

        // set community permissions on the files directory
        var directory = projectUuid + '/files/';
        tapisIO.setCommunityFilePermissions(projectUuid, directory, true)
            .then(function() {
                // get the project files
                return tapisIO.getProjectFiles(projectUuid);
            })
            .then(function(projectFiles) {
                console.log('VDJ-API INFO: ProjectController.publishProject, setting permissions on project files ('
                            + projectFiles.length + ' files) for project: ' + projectUuid);

                var promises = [];
                for (var i = 0; i < projectFiles.length; i++) {
                    var filename = projectFiles[i];
                    promises[i] = tapisIO.setCommunityFilePermissions(projectUuid, directory + filename, true);
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('publishProjectJobsPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectFilesPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - publishProjectFilesPermissionsTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            })
            ;
    });

    taskQueue.process('publishProjectJobsPermissionsTask', function(task, done) {
        // 2. Set permissions on jobs output files

        var projectUuid = task.data;
        var msg = null;

        console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectJobsPermissionsTask.');

        // get jobs (this leaves behind the archived jobs)
        tapisIO.getJobMetadataForProject(projectUuid)
            .then(function(jobMetadata) {
                console.log('VDJ-API INFO: ProjectController.publishProject, set permissions on job data ('
                            + jobMetadata.length + ' jobs) for project: ' + projectUuid);

                var promises = [];
                for (var i = 0; i < jobMetadata.length; i++) {
                    var entry = jobMetadata[i];
                    promises[i] = tapisIO.setCommunityJobPermissions(projectUuid, entry.value.jobUuid, true);
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('publishProjectSetMetadataPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectJobsPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - publishProjectJobsPermissionsTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            })
            ;
    });

    taskQueue.process('publishProjectSetMetadataPermissionsTask', function(task, done) {
        // 3. Set permissions on metadata

        var projectUuid = task.data;
        var msg;

        console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', start publishProjectSetMetadataPermissionsTask.');

        tapisIO.setCommunityMetadataPermissions(projectUuid, true)
            .then(function() {
                taskQueue
                    .create('publishProjectFinishTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.publishProject, project ' + projectUuid + ', done publishProjectSetMetadataPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('publishProjectFinishTask', function(task, done) {
        // 4. Update project metadata to public

        var projectUuid = task.data;
        var projectName = '';

        var msg;
        ServiceAccount.getToken()
            .then(function(token) {
                return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectMetadata) {
                projectName = projectMetadata.value.study_title;
                if (projectMetadata.name == 'projectPublishInProcess') {
                    projectMetadata.name = 'public_project';
                    projectMetadata.value.showArchivedJobs = false;
                    return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
                } else {
                    msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' is not in state: projectPublishInProcess.';
                    return Promise.reject(new Error(msg));
                }
            })
            .then(function() {
                return tapisIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectPermissions) {
                // send emails
                var metadataPermissions = new MetadataPermissions();
                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = [];
                for (var i = 0; i < projectUsernames.length; i++) {
                    var username = projectUsernames[i];
                    promises[i] = tapisIO.getUserProfile(username)
                        .then(function(userProfileList) {
                            if (userProfileList.length == 0) return;
                            if (username == tapisSettings.guestAccountKey) return;
                            var userProfile = userProfileList[0];
                            if (!userProfile.value.disablePublishEmail) {
                                var vdjWebappUrl = tapisSettings.vdjBackbone
                                    + '/community/' + projectUuid;
                                emailIO.sendGenericEmail(userProfile.value.email,
                                                         'VDJServer project has been published',
                                                         'The VDJServer project "' + projectName + '" has been published to community data.'
                                                         + '<br>'
                                                         + 'You can view the project in community data with the link below:'
                                                         + '<br>'
                                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                                        );
                            }
                        });
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.publishProject - done, project ' + projectUuid + ' has been published.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    // Unpublishing a project from community data
    // mainly entails setting permissions on
    // the files, jobs and metadata for the
    // project for the project users.
    // 
    // 1. Set permissions on project files
    // 2. Set permissions on jobs output files
    // 3. Set permissions on metadata
    // 4. Update project metadata to private

    taskQueue.process('unpublishProjectFilesPermissionsTask', function(task, done) {
        // 1. Set permissions on project files

        var projectUuid = task.data;
        var msg = null;

        console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectFilesPermissionsTask.');

        // set community permissions on the files directory
        var directory = projectUuid + '/files/';
        tapisIO.setCommunityFilePermissions(projectUuid, directory, false)
            .then(function() {
                // get the project files
                return tapisIO.getProjectFiles(projectUuid);
            })
            .then(function(projectFiles) {
                console.log('VDJ-API INFO: ProjectController.unpublishProject, setting permissions on project files ('
                            + projectFiles.length + ' files) for project: ' + projectUuid);

                var promises = [];
                for (var i = 0; i < projectFiles.length; i++) {
                    var filename = projectFiles[i];
                    promises[i] = tapisIO.setCommunityFilePermissions(projectUuid, directory + filename, false);
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('unpublishProjectJobsPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectFilesPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - unpublishProjectFilesPermissionsTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            })
            ;
    });

    taskQueue.process('unpublishProjectJobsPermissionsTask', function(task, done) {
        // 2. Set permissions on jobs output files

        var projectUuid = task.data;
        var msg = null;

        console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectJobsPermissionsTask.');

        // get jobs (this leaves behind the archived jobs)
        tapisIO.getJobMetadataForProject(projectUuid)
            .then(function(jobMetadata) {
                console.log('VDJ-API INFO: ProjectController.unpublishProject, set permissions on job data ('
                            + jobMetadata.length + ' jobs) for project: ' + projectUuid);

                var promises = [];
                for (var i = 0; i < jobMetadata.length; i++) {
                    var entry = jobMetadata[i];
                    promises[i] = tapisIO.setCommunityJobPermissions(projectUuid, entry.value.jobUuid, false);
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('unpublishProjectSetMetadataPermissionsTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectJobsPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - unpublishProjectJobsPermissionsTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            })
            ;
    });

    taskQueue.process('unpublishProjectSetMetadataPermissionsTask', function(task, done) {
        // 3. Set permissions on metadata

        var projectUuid = task.data;
        var msg;

        console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', start unpublishProjectSetMetadataPermissionsTask.');

        tapisIO.setCommunityMetadataPermissions(projectUuid, false)
            .then(function() {
                taskQueue
                    .create('unpublishProjectFinishTask', projectUuid)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.unpublishProject, project ' + projectUuid + ', done unpublishProjectSetMetadataPermissionsTask.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('unpublishProjectFinishTask', function(task, done) {
        // 4. Update project metadata to private

        var projectUuid = task.data;
        var projectName = '';

        var msg;
        ServiceAccount.getToken()
            .then(function(token) {
                return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectMetadata) {
                projectName = projectMetadata.value.study_title;
                if (projectMetadata.name == 'projectUnpublishInProcess') {
                    projectMetadata.name = 'private_project';
                    return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
                } else {
                    msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' is not in state: projectUnpublishInProcess.';
                    return Promise.reject(new Error(msg));
                }
            })
            .then(function() {
                return tapisIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectPermissions) {
                // send emails
                var metadataPermissions = new MetadataPermissions();
                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = [];
                for (var i = 0; i < projectUsernames.length; i++) {
                    var username = projectUsernames[i];
                    promises[i] = tapisIO.getUserProfile(username)
                        .then(function(userProfileList) {
                            if (userProfileList.length == 0) return;
                            if (username == tapisSettings.guestAccountKey) return;
                            var userProfile = userProfileList[0];
                            if (!userProfile.value.disablePublishEmail) {
                                var vdjWebappUrl = tapisSettings.vdjBackbone
                                    + '/project/' + projectUuid;
                                emailIO.sendGenericEmail(userProfile.value.email,
                                                         'VDJServer project has been unpublished',
                                                         'The VDJServer project "' + projectName + '" has been unpublished from community data.'
                                                         + ' The project now resides among your private projects and can be edited.'
                                                         + '<br>'
                                                         + 'You can view the project with the link below:'
                                                         + '<br>'
                                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                                        );
                            }
                        });
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectController.unpublishProject - done, project ' + projectUuid + ' has been unpublished.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    //
    // Add user to a project by giving them permissions on all of the project objects.
    // Set project metadata last so the project doesn't show up in the user's project
    // list until all other permissions have been set.
    //
    // 1. project files and subdirectories
    // 2. project file metadata
    // 3. project jobs
    // 4. project metadata
    // 5. send emails
    //

    taskQueue.process('addUsernameToProjectTask', function(task, done) {
        // 1. project files and subdirectories

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start addUsernameToProjectTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // HOTFIX: Agave bug AH-207 is preventing recursive file permissions from working, so manually recurse the tree
                // set project file directory + subdirectory permissions recursively
                //.then(function(fileListings) {
                //console.log('VDJ-API INFO: PermissionsController.addPermissionsForUsername - addUsernameToMetadataPermissions for project ' + projectUuid);
                //
                //return tapisIO.addUsernameToFullFilePermissions(username, ServiceAccount.accessToken(), projectUuid, true);
                //})

                // enumerate file list
                console.log('VDJ-API INFO: ProjectQueueManager - addUsernameToMetadataPermissions for project ' + projectUuid);
                        
                return tapisIO.enumerateFileListings(projectUuid);
            })
            .then(function(fileListings) {
                // set permissions
                //console.log(fileListings);
                console.log('VDJ-API INFO: ProjectQueueManager.addUsernameToProjectTask - enumerateFileListings for project ' + projectUuid);

                var promises = [];
                for (var i = 0; i < fileListings.length; i++) {
                    promises[i] = tapisIO.setFilePermissions(
                        ServiceAccount.accessToken(),
                        username,
                        'ALL',
                        false,
                        '/projects/' + projectUuid + fileListings[i]
                    );
                }

                return Promise.allSettled(promises);
                // END HOTFIX
            })
            .then(function() {
                // HOTFIX: Agave bug AH-245 is preventing users from uploading files into a project. This happens when you 
                // add the user to the project. For some reason, with the recursive=true flag set on the files/ directory,
                // the user gets a write permission denied error. We stopped setting recursive=true due to the bug AH-207
                // which has a hotfix above, but now we need to set it for the files/ directory. This should be okay as
                // that directory only holds uploaded files and has not subdirectories, unlike analyses/ which can be quite big.
                return tapisIO.setFilePermissions(ServiceAccount.accessToken(), username, 'ALL', true, '/projects/' + projectUuid + '/files');
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectFileMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done addUsernameToProjectTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.addUsernameToProjectTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectFileMetadataTask', function(task, done) {
        // 2. project file metadata

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start addUsernameToProjectFileMetadataTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // get file metadata pems
                console.log('VDJ-API INFO: ProjectQueueManager - addUsernameToFullFilePermissions for project ' + projectUuid);

                return tapisIO.getProjectFileMetadata(projectUuid);
            })
            .then(function(projectFileMetadataPermissions) {
                // (loop) add to file metadata pems
                console.log('VDJ-API INFO: ProjectQueueManager.addUsernameToProjectTask - getProjectFileMetadata for project ' + projectUuid);

                var metadata = new MetadataPermissions();
                var uuids = metadata.getUuidsFromMetadataResponse(projectFileMetadataPermissions);

                var promises = [];
                for (var i = 0; i < uuids.length; i++) {
                    promises[i] = tapisIO.addUsernameToMetadataPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        uuids[i]
                    );
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectJobsTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done addUsernameToProjectFileMetadataTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.addUsernameToProjectTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectJobsTask', function(task, done) {
        // 3. project jobs

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start addUsernameToProjectJobsTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // get jobs for project
                console.log('VDJ-API INFO: ProjectQueueManager - addUsernameToMetadataPermissions for project ' + projectUuid);

                //return tapisIO.getJobMetadataForProject(projectUuid);
                return tapisIO.getJobsForProject(projectUuid);
            })
            .then(function(jobMetadatas) {
                // (loop) add to job permissions
                console.log('VDJ-API INFO: ProjectQueueManager.addUsernameToProjectTask - getJobsForProject for project ' + projectUuid);

                var metadata = new MetadataPermissions();
                var uuids = metadata.getJobUuidsFromProjectResponse(jobMetadatas);

                var promises = [];
                for (var i = 0; i < uuids.length; i++) {
                    promises[i] = tapisIO.addUsernameToJobPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        uuids[i]
                    );
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done addUsernameToProjectJobsTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.addUsernameToProjectTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectMetadataTask', function(task, done) {
        // 4. project metadata

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start addUsernameToProjectMetadataTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // get all project associated metadata
                // TODO: this technically should be sufficient for all metadata except for the sole project metadata entry
                // but not currently as many old metadata entries are missing the associationId
                console.log('VDJ-API INFO: ProjectQueueManager - addUsernameToJobPermissions for project ' + projectUuid);

                return tapisIO.getAllProjectAssociatedMetadata(projectUuid);
            })
            .then(function(allMetadatas) {
                // (loop) add permissions for user
                console.log('VDJ-API INFO: ProjectQueueManager - addUsernameToProjectMetadataTask, ' + allMetadatas.length + ' records for project ' + projectUuid);

                var metadata = new MetadataPermissions();
                var uuids = metadata.getUuidsFromMetadataResponse(allMetadatas);
                //console.log(allMetadatas);
                //console.log(uuids.length);
                //console.log(uuids);

                var promises = [];
                for (var i = 0; i < uuids.length; i++) {
                    promises[i] = tapisIO.addUsernameToMetadataPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        uuids[i]
                    );
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                // Add new username to project metadata pems
                console.log('VDJ-API INFO: ProjectQueueManager.addUsernameToProjectMetadataTask - getMetadataPermissions for project ' + projectUuid);

                return tapisIO.addUsernameToMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
                taskQueue
                    .create('addUsernameToProjectSendEmailTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done addUsernameToProjectMetadataTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.addUsernameToProjectMetadataTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('addUsernameToProjectSendEmailTask', function(task, done) {
        // 5. send emails

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start addUsernameToProjectSendEmailTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectMetadata) {
                projectData.projectName = projectMetadata.value.name;
                //console.log(projectData.projectName);
                return tapisIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
            })
            .then(function(projectPermissions) {
                // send emails
                var metadataPermissions = new MetadataPermissions();
                var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

                var promises = [];
                for (var i = 0; i < projectUsernames.length; i++) {
                    var user = projectUsernames[i];
                    promises[i] = tapisIO.getUserProfile(user)
                        .then(function(userProfileList) {
                            if (userProfileList.length == 0) return;
                            if (username == tapisSettings.guestAccountKey) return;
                            var userProfile = userProfileList[0];
                            if (!userProfile.value.disableUserEmail) {
                                var vdjWebappUrl = tapisSettings.vdjBackbone
                                    + '/project/' + projectUuid;
                                emailIO.sendGenericEmail(userProfile.value.email,
                                                         'VDJServer user added to project',
                                                         'VDJServer user "' + username + '" has been added to project "' + projectData.projectName + '".'
                                                         + '<br>'
                                                         + 'You can view the project with the link below:'
                                                         + '<br>'
                                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                                        );
                            }
                        });
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                // send notification
                app.emit(
                    'userProjectNotification',
                    {
                        projectUuid: projectUuid,
                        username: username 
                    }
                );
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done addUsernameToProjectSendEmailTask: ' + username);
                console.log('VDJ-API INFO: ProjectQueueManager.addUsernameToProjectSendEmailTask - complete for project ' + projectUuid);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.addUsernameToProjectSendEmailTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    //
    // Remove user from a project by removing permissions on all of the project objects.
    // Set project metadata first so the project is removed from the user's project list.
    //
    // 1. project metadata record
    // 2. project files and subdirectories
    // 3. project associated metadata records
    // 4. project jobs
    // 5. send emails
    //

    taskQueue.process('removeUsernameFromProjectTask', function(task, done) {
        // 1. project metadata

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start removeUsernameFromProjectTask: ' + username);

        ServiceAccount.getToken()
            .then(function(token) {
                // Remove username from project metadata pems
                return tapisIO.removeUsernameFromMetadataPermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
                // next task
                taskQueue
                    .create('removeUsernameFromProjectFilesTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done removeUsernameFromProjectTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.removeUsernameFromProjectTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectFilesTask', function(task, done) {
        // 2. project files and subdirectories

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start removeUsernameFromProjectFilesTask: ' + username);

        ServiceAccount.getToken()
            .then(function(token) {
                // Remove username from project files pems
                return tapisIO.removeUsernameFromFilePermissions(username, ServiceAccount.accessToken(), projectUuid);
            })
            .then(function() {
                // next task
                taskQueue
                    .create('removeUsernameFromProjectMetadataTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done removeUsernameFromProjectFilesTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.removeUsernameFromProjectFilesTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectMetadataTask', function(task, done) {
        // 3. project associated metadata records

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start removeUsernameFromProjectMetadataTask: ' + username);

        ServiceAccount.getToken()
            .then(function(token) {
                // get all project associated metadata
                return tapisIO.getAllProjectAssociatedMetadata(projectUuid);
            })
            .then(function(projectMetadata) {
                // (loop) Remove from File Metadata pems
                var metadata = new MetadataPermissions();
                var uuids = metadata.getUuidsFromMetadataResponse(projectMetadata);

                var promises = [];
                for (var i = 0; i < uuids.length; i++) {
                    promises[i] = tapisIO.removeUsernameFromMetadataPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        uuids[i]
                    );
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                // next task
                taskQueue
                    .create('removeUsernameFromProjectJobsTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done removeUsernameFromProjectMetadataTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.removeUsernameFromProjectMetadataTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectJobsTask', function(task, done) {
        // 4. project jobs

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start removeUsernameFromProjectJobsTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // get jobs for project
                return tapisIO.getJobsForProject(projectUuid);
            })
            .then(function(jobMetadatas) {
                // (loop) remove job permissions
                var metadata = new MetadataPermissions();
                var uuids = metadata.getJobUuidsFromProjectResponse(jobMetadatas);

                var promises = [];
                for (var i = 0; i < uuids.length; i++) {
                    promises[i] = tapisIO.removeUsernameFromJobPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        uuids[i]
                    );
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                // next task
                taskQueue
                    .create('removeUsernameFromProjectEmailTask', projectData)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({delay: 60 * 1000, type: 'fixed'})
                    .save()
                    ;
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done removeUsernameFromProjectJobsTask: ' + username);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.removeUsernameFromProjectJobsTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    taskQueue.process('removeUsernameFromProjectEmailTask', function(task, done) {
        // 5. send emails

        var projectData = task.data;
        var projectUuid = projectData.projectUuid;
        var username = projectData.username;
        var projectUsernames = projectData.projectUsernames;
        var msg;

        console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', start removeUsernameFromProjectEmailTask: ' + username);

        ServiceAccount.getToken()
            .then(function() {
                // send emails
                var promises = []
                for (var i = 0; i < projectUsernames.length; i++) {
                    var user = projectUsernames[i];
                    promises[i] = tapisIO.getUserProfile(user)
                        .then(function(userProfileList) {
                            if (userProfileList.length == 0) return;
                            if (username == tapisSettings.guestAccountKey) return;
                            var userProfile = userProfileList[0];
                            if (!userProfile.value.disableUserEmail) {
                                var vdjWebappUrl = tapisSettings.vdjBackbone
                                    + '/project/' + projectUuid;
                                emailIO.sendGenericEmail(userProfile.value.email,
                                                         'VDJServer user removed from project',
                                                         'VDJServer user "' + username + '" has been removed from project ' + projectUuid + '.'
                                                         + '<br>'
                                                         + 'You can view the project with the link below:'
                                                         + '<br>'
                                                         + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
                                                        );
                            }
                        });
                }

                return Promise.allSettled(promises);
            })
            .then(function() {
                console.log('VDJ-API INFO: ProjectQueueManager, project ' + projectUuid + ', done removeUsernameFromProjectEmailTask: ' + username);
                console.log('VDJ-API INFO: ProjectQueueManager - removeUsernameFromJobPermissions complete for project ' + projectUuid);
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: ProjectQueueManager.removeUsernameFromProjectEmailTask - project ' + projectUuid + ' error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    //
    // Load project data into the VDJServer ADC data repository.
    // Currently two main data to be loaded:
    // 1) repertoire metadata
    // 2) rearrangement data
    //
    // The repertoire metadata is relatively small and quick to load,
    // while the rearrangement data is large and may takes days or
    // weeks to competely load. We load the repertoire metadata for
    // all projects as soon as possible. However, we currently load
    // the rearrangement data for only one project at a time
    // to avoid overloading any particular system.
    //
    // Because the rearrangement data is large, we do the loading process
    // in small steps to allow easier recovery from errors. Most of the
    // complexity of these tasks involves the rearrangement data.
    //
    // The load records keep track of the rearrangement collection, so
    // that we can support separate load and query collections.
    //
    // 1. check if projects to be loaded
    // 2. load repertoire metadata
    // 3. check if rearrangement data to be loaded
    // 4. load rearrangement data for each repertoire
    //

    // 1. check if projects to be loaded
    taskQueue.process('checkProjectsToLoadTask', function(task, done) {
        var msg;

        console.log('VDJ-API INFO: projectQueueManager.checkProjectsToLoadTask, task started.');

        tapisIO.getProjectsToBeLoaded(mongoSettings.loadCollection)
            .then(function(projectList) {
                console.log('VDJ-API INFO: projectQueueManager.checkProjectsToLoadTask, ' + projectList.length + ' project(s) to be loaded.');
                if (projectList.length > 0) {
                    // there are projects to be loaded so trigger next task
                    taskQueue
                        .create('loadRepertoireMetadataTask', null)
                        .removeOnComplete(true)
                        .attempts(5)
                        .backoff({delay: 60 * 1000, type: 'fixed'})
                        .save();
                }
            })
            .then(function() {
                console.log('VDJ-API INFO: projectQueueManager.checkProjectsToLoadTask, task done.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: projectQueueManager.checkProjectsToLoadTask - error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    // 2. load repertoire metadata
    taskQueue.process('loadRepertoireMetadataTask', function(task, done) {
        var msg;
        var projectLoad = null;
        var projectUuid = null;
        var allRepertoiresLoaded = false;

        console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, task started.');

        tapisIO.getProjectsToBeLoaded(mongoSettings.loadCollection)
            .then(function(projectList) {
                // look for project that needs repertoire metadata to be loaded
                for (var i = 0; i < projectList.length; ++i) {
                    console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, checking load record: '
                                + projectList[i]['uuid'] + ' for project: ' + projectList[i]['associationIds'][0]);
                    if (! projectList[i]['value']['repertoireMetadataLoaded']) {
                        projectLoad = projectList[i];
                        projectUuid = projectLoad['associationIds'][0];
                        break;
                    }
                }
                return;
            })
            .then(function() {
                // we did not find one, so all the repertoire metadata is loaded
                // trigger the next task
                if (! projectLoad) {
                    console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, all repertoire metadata is loaded.');
                    allRepertoiresLoaded = true;
                    return null;
                }

                console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, load repertoire metadata for project: ' + projectUuid);

                return tapisIO.getMetadata(projectUuid)
                    .then(function(projectMetadata) {
                        // set ADC dates
                        if (! projectMetadata.value.adc_publish_date)
                            projectMetadata.value.adc_publish_date = new Date().toISOString();
                        else
                            projectMetadata.value.adc_update_date = new Date().toISOString();

                        return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, projectMetadata.associationIds);
                    })
                    .then(function(projectMetadata) {
                        // gather the repertoire objects
                        return tapisIO.gatherRepertoireMetadataForProject(projectUuid, true);
                    })
                    .then(function(repertoireMetadata) {
                        //console.log(JSON.stringify(repertoireMetadata));
                        console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, gathered ' + repertoireMetadata.length
                                    + ' repertoire metadata for project: ' + projectUuid);

                        if (! repertoireMetadata || repertoireMetadata.length == 0) return;

                        for (let i in repertoireMetadata) {
                            if (! repertoireMetadata[i]['repertoire_id']) {
                                msg = 'VDJ-API ERROR (projectQueueManager.loadRepertoireMetadataTask): Entry is missing repertoire_id, aborting!';
                                return Promise.reject(new Error(msg));
                            }
                        }

                        // insert repertoires into database
                        // TODO: we should use RestHeart meta/v3 API but we are getting errors
                        // TODO: using direct access to MongoDB for now
                        return mongoIO.loadRepertoireMetadata(repertoireMetadata, mongoSettings.loadCollection);
                    })
                    .then(function(result) {
                        console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, repertoire metadata is loaded for project: ' + projectUuid);
                        // update the load status
                        projectLoad.value.repertoireMetadataLoaded = true;
                        return tapisIO.updateMetadata(projectLoad.uuid, projectLoad.name, projectLoad.value, projectLoad.associationIds);
                    });
            })
            .then(function() {
                if (allRepertoiresLoaded) {
                    // if all project repertoire data is loaded then trigger rearrangement load check
                    taskQueue
                        .create('checkRearrangementsToLoadTask', null)
                        .removeOnComplete(true)
                        .attempts(5)
                        .backoff({delay: 60 * 1000, type: 'fixed'})
                        .save();
                } else {
                    // otherwise re-check for more projects to load
                    taskQueue
                        .create('checkProjectsToLoadTask', null)
                        .removeOnComplete(true)
                        .attempts(5)
                        .backoff({delay: 60 * 1000, type: 'fixed'})
                        .save();
                }
                console.log('VDJ-API INFO: projectQueueManager.loadRepertoireMetadataTask, task done.');
                done();
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: projectQueueManager.loadRepertoireMetadataTask - error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    // 3. check if rearrangement data to be loaded
    taskQueue.process('checkRearrangementsToLoadTask', function(task, done) {
        var msg = null;
        var projectLoad = null;
        var projectUuid = null;
        var repertoireMetadata = null;

        console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, task started.');

        tapisIO.getProjectsToBeLoaded(mongoSettings.loadCollection)
            .then(function(projectList) {
                console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, ' + projectList.length + ' project(s) to be loaded.');

                // look for project that needs rearrangement data to be loaded
                for (var i = 0; i < projectList.length; ++i) {
                    if (! projectList[i]['value']['rearrangementDataLoaded']) {
                        projectLoad = projectList[i];
                        projectUuid = projectLoad['associationIds'][0];
                        break;
                    }
                }
                return;
            })
            .then(function() {
                // we did not find one, so all the rearrangement data is loaded
                if (! projectLoad) {
                    console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, all rearrangement data is loaded.');
                    return null;
                }

                console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, setup rearrangement data load for project: ' + projectUuid);

                // gather the repertoire objects
                return tapisIO.gatherRepertoireMetadataForProject(projectUuid, true)
                    .then(function(_repertoireMetadata) {
                        repertoireMetadata = _repertoireMetadata;
                        //console.log(JSON.stringify(repertoireMetadata));
                        console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, gathered ' + repertoireMetadata.length
                                    + ' repertoire metadata for project: ' + projectUuid);

                        if (! repertoireMetadata || repertoireMetadata.length == 0) {
                            msg = 'VDJ-API ERROR: project has no repertoires: ' + projectUuid;
                            return;
                        }

                        // check if there are existing rearrangement load records
                        return tapisIO.getRearrangementsToBeLoaded(projectUuid, mongoSettings.loadCollection);
                    })
                    .then(function(rearrangementLoad) {
                        if (!rearrangementLoad) return;

                        if (rearrangementLoad.length == 0) {
                            // need to create the rearrangement load records
                            console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, create rearrangement load records for project: ' + projectUuid);
                            var promises = [];

                            for (var i = 0; i < repertoireMetadata.length; i++) {
                                var repertoire_id = repertoireMetadata[i]['repertoire_id'];
                                promises[i] = tapisIO.createRearrangementLoadMetadata(projectUuid, repertoire_id, mongoSettings.loadCollection);
                            }

                            return Promise.allSettled(promises);
                        } else if (rearrangementLoad.length != repertoireMetadata.length) {
                            msg = 'VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, number of repertoires ('
                                + repertoireMetadata.length + ') is not equal to number of rearrangement load records ('
                                + rearrangementLoad.length + ') for project: ' + projectUuid;
                            console.log(msg);
                            console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, create missing rearrangement load records for project: ' + projectUuid);

                            var promises = [];

                            var idx = 0;
                            for (var i = 0; i < repertoireMetadata.length; i++) {
                                var found = false;
                                for (var j = 0; j < rearrangementLoad.length; j++) {
                                    if (rearrangementLoad[j]['value']['repertoire_id'] == repertoireMetadata[i]['repertoire_id']) {
                                        found = true;
                                        break;
                                    }
                                }
                                if (! found) {
                                    var repertoire_id = repertoireMetadata[i]['repertoire_id'];
                                    promises[idx] = tapisIO.createRearrangementLoadMetadata(projectUuid, repertoire_id, mongoSettings.loadCollection);
                                    idx++;
                                }
                            }

                            return Promise.allSettled(promises);
                        } else {
                            console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, rearrangement load records already created for project: ' + projectUuid);
                            return;
                        }
                    });
            })
            .then(function() {
                console.log('VDJ-API INFO: projectQueueManager.checkRearrangementsToLoadTask, task done.');
                if (msg) {
                    // an error occurred so stop the task
                    console.error(msg);
                    webhookIO.postToSlack(msg);
                    done(new Error(msg));
                } else {
                    // otherwise trigger rearrangement load if necessary
                    ProjectQueueManager.checkRearrangementLoad();
                    done();
                }
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: projectQueueManager.checkRearrangementsToLoadTask - error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });
    });

    // 4. load rearrangement data for each repertoire
    taskQueue.process('rearrangementLoadTask', function(task, done) {
        var msg = null;
        var projectLoad = null;
        var projectUuid = null;
        var rearrangementLoad = null;
        var repertoireMetadata = null;
        var repertoire = null;
        var dataLoad = null;
        var primaryDP = null;
        var jobOutput = null;
        var allProjectsLoaded = false;
        var allRearrangementsLoaded = false;

        console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, task started.');

        tapisIO.getProjectsToBeLoaded(mongoSettings.loadCollection)
            .then(function(projectList) {
                console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, ' + projectList.length + ' project(s) to be loaded.');

                // look for project that needs rearrangement data to be loaded
                for (var i = 0; i < projectList.length; ++i) {
                    if (! projectList[i]['value']['rearrangementDataLoaded']) {
                        projectLoad = projectList[i];
                        projectUuid = projectLoad['associationIds'][0];
                        break;
                    }
                }
                if (projectList.length == 0) allProjectsLoaded = true;

                // we did not find one, so all the rearrangement data is loaded
                if (! projectLoad) {
                    console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, all rearrangement data is loaded.');
                    allRearrangementsLoaded = true;

                    // but the project is to be loaded, check to see if all is done and update
                    for (var i = 0; i < projectList.length; ++i) {
                        var proj = projectList[i];
                        if (proj['value']['repertoireMetadataLoaded'] && proj['value']['rearrangementDataLoaded']) {
                            console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, project completely loaded: ' + proj.uuid);
                            proj.value.isLoaded = true;
                            return tapisIO.updateMetadata(proj.uuid, proj.name, proj.value, proj.associationIds);
                        }
                    }
                }

                return;
            })
            .then(function() {
                if (! projectLoad) return;

                // check if there are existing rearrangement load records
                return tapisIO.getRearrangementsToBeLoaded(projectUuid, mongoSettings.loadCollection)
                    .then(function(_rearrangementLoad) {
                        rearrangementLoad = _rearrangementLoad;
                        if (! rearrangementLoad || rearrangementLoad.length == 0) {
                            msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, project has no rearrangement load records: ' + projectUuid;
                            return null;
                        }

                        console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, gathered ' + rearrangementLoad.length
                                    + ' rearrangement load records for project: ' + projectUuid);

                        var loadedCount = 0;
                        for (var i = 0; i < rearrangementLoad.length; ++i)
                            if (rearrangementLoad[i]['value']['isLoaded'])
                                ++loadedCount;
                                
                        for (var i = 0; i < rearrangementLoad.length; ++i) {
                            if (! rearrangementLoad[i]['value']['isLoaded']) {
                                dataLoad = rearrangementLoad[i];
                                break;
                            }
                        }

                        console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, ' + loadedCount
                                    + ' of the total ' + rearrangementLoad.length
                                    + ' rearrangement load records have been loaded.');

                        return tapisIO.gatherRepertoireMetadataForProject(projectUuid, true);
                    })
            })
            .then(function(_repertoireMetadata) {
                if (! projectLoad) return;
                if (! dataLoad) {
                    console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, all rearrangement loads done for project: ' + projectLoad.uuid);
                    console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, project completely loaded: ' + projectLoad.uuid);
                    // project to be loaded but no dataLoad means all rearrangement loads have been completed
                    // update the load status
                    projectLoad.value.rearrangementDataLoaded = true;
                    projectLoad.value.isLoaded = true;
                    return tapisIO.updateMetadata(projectLoad.uuid, projectLoad.name, projectLoad.value, projectLoad.associationIds);
                }

                //console.log(dataLoad);
                repertoireMetadata = _repertoireMetadata;

                if (repertoireMetadata.length != rearrangementLoad.length) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, number (' + rearrangementLoad.length
                        + ') of rearrangement load records is not equal to number (' + repertoireMetadata.length
                        + ') of repertoires.';
                    return null;
                }

                console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, rearrangement data load: '
                            + dataLoad['uuid'] + ' for repertoire: ' + dataLoad['value']['repertoire_id']
                            + ' at load set: ' + dataLoad['value']['load_set']);

                for (var i = 0; i < repertoireMetadata.length; ++i) {
                    if (repertoireMetadata[i]['repertoire_id'] == dataLoad['value']['repertoire_id']) {
                        repertoire = repertoireMetadata[i];
                        break;
                    }
                }
                //console.log(repertoire);

                if (! repertoire) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, could not find repertoire record for repertoire_id: '
                        + dataLoad['value']['repertoire_id'];
                    return null;
                }

                for (var i = 0; i < repertoire['data_processing'].length; ++i) {
                    if (repertoire['data_processing'][i]['primary_annotation']) {
                        primaryDP = repertoire['data_processing'][i];
                        break;
                    }
                }

                if (! primaryDP) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, could not find primary data processing for repertoire_id: '
                        + dataLoad['value']['repertoire_id'];
                    return null;
                }
                
                if (! primaryDP['data_processing_id']) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, no data_processing_id for primary data processing for repertoire_id: '
                        + dataLoad['value']['repertoire_id'];
                    return null;
                }

                if (! primaryDP['data_processing_files']) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, primary data processing: '
                        + primaryDP['data_processing_id'] + " does not have data_processing_files.";
                    return null;
                }

                if (primaryDP['data_processing_files'].length == 0) {
                    msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, primary data processing: '
                        + primaryDP['data_processing_id'] + " does not have data_processing_files.";
                    return null;
                }

                // get the data processing record
                // TODO: right now this is a job, but we should switch to using analysis_provenance_id
                // which contains the appropriate information
                return tapisIO.getJobOutput(primaryDP['data_processing_id'])
                    .then(function(_job) {
                        if (! _job) {
                            msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, could not get job: '
                                + primaryDP['data_processing_id'] + ' for primary data processing: ' + primaryDP['data_processing_id'];
                            return null;
                        }
                        jobOutput = _job;
                        //console.log(jobOutput);

                        if (! jobOutput['archivePath']) {
                            msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, job: ' + jobOutput.uuid + " is missing archivePath.";
                            return null;
                        }
                        if (jobOutput['archivePath'].length == 0) {
                            msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask, job: ' + jobOutput.uuid + " is missing archivePath.";
                            return null;
                        }

                        // finally, start the rearrangement load!
                        return mongoIO.loadRearrangementData(dataLoad, repertoire, primaryDP, jobOutput);
                    })
            })
            .then(function() {
                console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, task done.');
                if (msg) {
                    // an error occurred so stop the task
                    console.error(msg);
                    webhookIO.postToSlack(msg);
                    done(new Error(msg));
                } else {
                    // if not all loaded trigger start at beginning and check for more
                    if (allRearrangementsLoaded && allProjectsLoaded) {
                        console.log('VDJ-API INFO: projectQueueManager.rearrangementLoadTask, all loads done, pausing queue.');
                    }
                    else {
                        taskQueue
                            .create('checkProjectsToLoadTask', null)
                            .removeOnComplete(true)
                            .attempts(5)
                            .backoff({delay: 60 * 1000, type: 'fixed'})
                            .save();
                    }

                    done();
                }
            })
            .catch(function(error) {
                if (!msg) msg = 'VDJ-API ERROR: projectQueueManager.rearrangementLoadTask - error ' + error;
                console.error(msg);
                webhookIO.postToSlack(msg);
                done(new Error(msg));
            });

    });
};
*/


ProjectQueueManager.triggerProjectUnload = function(projectUuid, loadMetadata) {
    console.log('VDJ-API INFO (ProjectQueueManager.triggerProjectUnload):');
    unloadQueue.add({projectUuid:projectUuid, loadMetadata:loadMetadata});
}

unloadQueue.process(async (job) => {
    var msg = null;
    var projectUuid = job['data']['projectUuid'];
    var loadMetadata = job['data']['loadMetadata'];

    console.log('VDJ-API INFO (unloadQueue): start');

    // get the rearrangement load records
    var rearrangementLoad = await tapisIO.getRearrangementsToBeLoaded(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (unloadQueue): tapisIO.getRearrangementsToBeLoaded, error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    if (! rearrangementLoad || rearrangementLoad.length == 0) {
        console.log('VDJ-API INFO (unloadQueue): project has no rearrangement load records: ' + projectUuid);
        return Promise.resolve();
    }

    console.log('VDJ-API INFO (unloadQueue): gathered ' + rearrangementLoad.length + ' rearrangement load records for project: ' + projectUuid);

    // for each load record, delete rearrangements, delete load metadata
    for (let i = 0; i < rearrangementLoad.length; i++) {
        var loadRecord = rearrangementLoad[i];
        var rearrangementCollection = 'rearrangement' + loadRecord['value']['collection'];
        var repertoireCollection = 'repertoire' + loadRecord['value']['collection'];

        if (! loadRecord['value']['repertoire_id']) {
            msg = 'VDJ-API ERROR (unloadQueue): missing repertoire_id from load record: ' + JSON.stringify(loadRecord);
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        if (loadRecord['value']['collection'] != mongoSettings.loadCollection) {
            msg = 'VDJ-API ERROR (unloadQueue): load record collection: ' + loadRecord['value']['collection'] + ' != ' + mongoSettings.loadCollection + ' config load collection';
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        console.log('VDJ-API INFO (unloadQueue): deleting rearrangements for repertoire:', loadRecord['value']['repertoire_id']);
        await mongoIO.deleteLoadSet(loadRecord['value']['repertoire_id'], null, rearrangementCollection)
            .catch(function(error) {
                msg = 'VDJ-API ERROR (unloadQueue): mongoIO.deleteLoadSet, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        console.log('VDJ-API INFO (unloadQueue): deleting repertoire:', loadRecord['value']['repertoire_id']);
        await mongoIO.deleteRepertoire(loadRecord['value']['repertoire_id'], repertoireCollection)
            .catch(function(error) {
                msg = 'VDJ-API ERROR (unloadQueue): mongoIO.deleteLoadSet, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        console.log('VDJ-API INFO (unloadQueue): deleting rearrangement load record:', loadRecord['uuid']);
        await ServiceAccount.getToken()
            .catch(function(error) {
                msg = 'VDJ-API ERROR (unloadQueue): ServiceAccount.getToken, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        await tapisIO.deleteMetadata(ServiceAccount.accessToken(), loadRecord['uuid'])
            .catch(function(error) {
                msg = 'VDJ-API ERROR (unloadQueue): tapisIO.deleteMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
    }

    console.log('VDJ-API INFO (unloadQueue): complete');
});
