
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

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var ServiceAccount = tapisIO.serviceAccount;
var GuestAccount = tapisIO.guestAccount;
var webhookIO = require('vdj-tapis-js/webhookIO');
var emailIO = require('vdj-tapis-js/emailIO');

// Models
var FilePermissions = require('../models/filePermissions');
var MetadataPermissions = require('../models/metadataPermissions');
var Job = require('../models/job');

// Node Libraries
var Queue = require('bull');

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

