
'use strict';

//
// projectController.js
// Handle project entry points
//
// VDJServer Analysis Portal
// VDJ API Service
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

var ProjectController = {};
module.exports = ProjectController;

// App
var app = require('../app');
var config = require('../config/config');

// Settings
var agaveSettings = require('../config/agaveSettings');
var mongoSettings = require('../config/mongoSettings');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');
var FileUploadJob = require('../models/fileUploadJob');

var airr = require('../vendor/airr');

// Queues
var filePermissionsQueueManager = require('../queues/filePermissionsQueueManager');
var projectQueueManager = require('../queues/projectQueueManager');
var adcDownloadQueueManager = require('../queues/adcDownloadQueueManager');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var yaml = require('js-yaml');
var d3 = require('d3');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

//
// Creates a project and all initial directories
//
ProjectController.createProject = function(request, response) {

    var project = request.body.project;
    var projectName = project['study_title'];
    var username    = request.user.username;

    var projectMetadata;
    var uuid;

    // set the username as the project owner
    project['owner'] = username;

    console.log('VDJ-API INFO: ProjectController.createProject - event - begin for username: ' + username + ', project name: ' + projectName);

    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.createProjectMetadata(project);
        })
        .then(function(_projectMetadata) {
            console.log('VDJ-API INFO: ProjectController.createProject - event - metadata for username: ' + username + ', project name: ' + projectName);

            // Save these for later
            projectMetadata = _projectMetadata;
            uuid = projectMetadata.uuid;

            return agaveIO.addUsernameToMetadataPermissions(username, ServiceAccount.accessToken(), uuid);
        })
        // create project/files directory
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.createProject - event - metadata pems for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return agaveIO.createProjectDirectory(uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.createProject - event - files dir for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return agaveIO.createProjectDirectory(uuid + '/analyses');
        })
        // create project/deleted directory
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.createProject - event - analyses dir for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return agaveIO.createProjectDirectory(uuid + '/deleted');
        })
        // set project directory permissions recursively
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.createProject - event - dir pems for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return agaveIO.addUsernameToFullFilePermissions(username, ServiceAccount.accessToken(), uuid, true);
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.createProject - event - complete for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(projectMetadata, response);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: ProjectController.createProject - error - username ' + username + ', project name ' + projectName + ', error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);            
            apiResponseController.sendError(msg, 500, response);
        });
};

//
// Attach an uploaded file to the project
//
ProjectController.importFile = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg = null;

    console.log('VDJ-API INFO: ProjectController.importFile - start, project: ' + projectUuid);

    console.log(request.body);
    var fileNotification = {
        fileEvent:   request.body.event,
        fileType:    request.body.type,
        filePath:    request.body.path,
        fileSystem:  request.body.system,
        projectUuid: projectUuid,
        readDirection: request.body.readDirection,
        tags: request.body.tags
    };

    // verify file notification
    var fileUploadJob = new FileUploadJob(fileNotification);
    await fileUploadJob.verifyFileNotification()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.importFile - fileNotification: ' + JSON.stringify(fileNotification) + ', error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log(fileUploadJob);

    filePermissionsQueueManager.importFile(fileUploadJob);

    console.log('VDJ-API INFO: ProjectController.importFile - event - queued for file uuid ' + fileUploadJob.fileUuid);
    return apiResponseController.sendSuccess('Importing file', response);
};

ProjectController.executePROV = function(request, response) {
    var context = 'ProjectController.executePROV';
    var projectUuid = request.params.project_uuid;

    config.log.info(context, 'start, project: ' + projectUuid);

    // validate PROV
    // validate that activities are tapis app ids
    // determine input files, validate their existence

    // 1. set file set as initial input files
    // 2. get set of non-executed activities that have all of their inputs
    // 2a. if none, then perform error checks and exit
    // 3. execute those activities
    // 4. update file set with output files, goto 2

    return apiResponseController.sendError('Not implemented.', 500, response);
};

//
// Publish project to community data
//

// Publishing a project involves changine the project metadata type from
// private_project to public_project, and changing the permissions on the
// files, metadata and jobs to read-only and world read-able.

// VDJServer V1 of publish project actually moved all of the files from
// the /project folder into /community. This was time-consuming, expensive,
// and error prone, so now we leave the files in-place and just change
// permissions, which should be much faster.

// We still use a task queue to do the operations asynchronously
// and send emails when it is done.


ProjectController.publishProject = function(request, response) {
    var projectUuid = request.params.project_uuid;

    console.log('VDJ-API INFO: ProjectController.publishProject - start, project: ' + projectUuid);

    // First step is to modify project metadata to be in process.
    // This removes the project from users' list so no changes
    // are accidently made while the project is being published.
    // Publishing may take awhile so we use a queue which breaks
    // it up into steps.
    // If this first step completes fine, then return success to
    // the user that publishing is in process.

    var msg = null;
    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'private_project') {
                projectMetadata.name = 'projectPublishInProcess';
                //console.log(projectMetadata);
                return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
            } else if (projectMetadata.name == 'projectPublishInProcess') {
                console.log('VDJ-API INFO: ProjectController.publishProject - project ' + projectUuid + ' - restarting publish.');
                return null;
            } else {
                msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' is not in a publishable state.';
                return Promise.reject(new Error(msg));
            }
        })
        .then(function(responseObject) {
            console.log('VDJ-API INFO: ProjectController.publishProject - project ' + projectUuid + ' publishing in process.');
            //console.log(responseObject);

            taskQueue
                .create('publishProjectFilesPermissionsTask', projectUuid)
                .removeOnComplete(true)
                .attempts(5)
                .backoff({delay: 60 * 1000, type: 'fixed'})
                .save()
            ;

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

//
// Unpublish project to community data
//

ProjectController.unpublishProject = function(request, response) {
    var projectUuid = request.params.project_uuid;

    console.log('VDJ-API INFO: ProjectController.unpublishProject - start, project: ' + projectUuid);

    // First step is to modify project metadata to be in process.
    // This removes the project from community data list so users
    // do not accidently try to copy it or look at files.
    // Unpublishing may take awhile so we use a queue which breaks
    // it up into steps.
    // If this first step completes fine, then return success to
    // the user that unpublishing is in process.

    var msg = null;
    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'public_project') {
                projectMetadata.name = 'projectUnpublishInProcess';
                return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
            } else if (projectMetadata.name == 'projectUnpublishInProcess') {
                console.log('VDJ-API INFO: ProjectController.unpublishProject - project ' + projectUuid + ' - restarting unpublish.');
                return null;
            } else {
                msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' is not in an unpublishable state.';
                return Promise.reject(new Error(msg));
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.unpublishProject - project ' + projectUuid + ' unpublishing in process.');

            taskQueue
                .create('unpublishProjectFilesPermissionsTask', projectUuid)
                .removeOnComplete(true)
                .attempts(5)
                .backoff({delay: 60 * 1000, type: 'fixed'})
                .save()
            ;

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

//
// Load project data into VDJServer ADC data repository
//
// Instead of using the project metadata record, we setup
// and additional metadata record (name:projectLoad) that
// keeps track of the state of the load process.
//

// 1. set load flag on project
// 2. load repertoire metadata
// 3. set load flag on each repertoire for rearrangement load
// 4. load rearrangements for each repertoire
// 5. set verification flag

ProjectController.loadProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg = null;

    // check for project load metadata
    var loadMetadata = await agaveIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.loadProject - agaveIO.getProjectLoadMetadata, error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log(loadMetadata);

    // load record already exists
    if (loadMetadata && loadMetadata[0]) {
        loadMetadata = loadMetadata[0];

        if (loadMetadata['value']['isLoaded']) {
            var msg = 'VDJ-API ERROR: ProjectController.loadProject, project: ' + projectUuid + ', error: project already loaded'
                + ', metadata: ' + loadMetadata.uuid;
            console.error(msg);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 400, response);
        }

        if (loadMetadata['value']['shouldLoad']) {
            var msg = 'VDJ-API ERROR: ProjectController.loadProject, project: ' + projectUuid + ', error: project already flagged for load'
                + ', metadata: ' + loadMetadata.uuid;
            console.error(msg);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 400, response);
        }

        console.log('VDJ-API INFO: ProjectController.loadProject, project: ' + projectUuid + ' load record already exists, marking for load'
                    + ', metadata: ' + loadMetadata.uuid);

        loadMetadata['value']['shouldLoad'] = true;
        await agaveIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.loadProject - agaveIO.updateMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        taskQueue
            .create('checkProjectsToLoadTask', null)
            .removeOnComplete(true)
            .attempts(5)
            .backoff({delay: 60 * 1000, type: 'fixed'})
            .save();

        return apiResponseController.sendSuccess('Project marked for load', response);

    } else {

        // create the project load metadata
       loadMetadata = await agaveIO.createProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.loadProject - agaveIO.createProjectLoadMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // trigger load queue if necessary
        console.log('VDJ-API INFO: ProjectController.loadProject, project: ' + projectUuid + ' flagged for repository load'
                    + ', metadata: ' + loadMetadata.uuid);

        taskQueue
            .create('checkProjectsToLoadTask', null)
            .removeOnComplete(true)
            .attempts(5)
            .backoff({delay: 60 * 1000, type: 'fixed'})
            .save();

        return apiResponseController.sendSuccess('Project marked for load', response);
    }
};

//
// Unload project data from VDJServer ADC data repository
//
ProjectController.unloadProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var load_id = request.body.load_id;
    var clear_cache = request.body.clear_cache;
    var clear_statistics = request.body.clear_statistics;
    var msg = null;

    console.log('VDJ-API INFO (ProjectController.unloadProject): start, project: ' + projectUuid);
    console.log(request.body);

    // check for project load metadata
    var loadMetadata = await agaveIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.unloadProject - agaveIO.getProjectLoadMetadata, error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (loadMetadata && loadMetadata[0]) {
        loadMetadata = loadMetadata[0];
        if (loadMetadata['uuid'] != load_id) {
            msg = 'VDJ-API ERROR (ProjectController.unloadProject): Invalid load metadata id for project: ' + projectUuid;
            console.error(msg);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 400, response);
        }

        // turn off load
        loadMetadata['value']['shouldLoad'] = false;
        loadMetadata['value']['isLoaded'] = false;
        loadMetadata['value']['repertoireMetadataLoaded'] = false;
        loadMetadata['value']['rearrangementDataLoaded'] = false;
        await agaveIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.unloadProject - agaveIO.getProjectLoadMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // trigger load queue if necessary
        console.log('VDJ-API INFO: ProjectController.unloadProject, project: ' + projectUuid + ' flagged for repository unload'
            + ', metadata: ' + loadMetadata.uuid);

        projectQueueManager.triggerProjectUnload(projectUuid, loadMetadata);

        // clear ADC download cache
        if (clear_cache) {
            await ServiceAccount.getToken()
                .catch(function(error) {
                    msg = 'VDJ-API ERROR (ProjectController.unloadProject): ServiceAccount.getToken, error: ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }

            // get the study_id
            var projectMetadata = await agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR (ProjectController.unloadProject): agaveIO.getProjectMetadata, error: ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }

            // assume VDJServer repository
            adcDownloadQueueManager.triggerClearCache('vdjserver', projectMetadata['value']['study_id']);
        }

        // clear statistics cache
        if (clear_statistics) {
            console.log('TODO: clear statistics cache');
        }

        return apiResponseController.sendSuccess('Project queued for unload', response);
    } else {
        msg = 'VDJ-API ERROR (ProjectController.unloadProject): project: ' + projectUuid + ' does not have load metadata.';
        console.error(msg);
        webhookIO.postToSlack(msg);            
        return apiResponseController.sendError(msg, 400, response);
    }
};

//
// Reload repertoire metadata for project in VDJServer ADC data repository
//
ProjectController.reloadProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var load_id = request.body.load_id;
    var msg = null;

    console.log('VDJ-API INFO (ProjectController.reloadProject): start, project: ' + projectUuid);
    console.log(request.body);

    // check for project load metadata
    var loadMetadata = await agaveIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.reloadProject - agaveIO.getProjectLoadMetadata, error: ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (loadMetadata && loadMetadata[0]) {
        loadMetadata = loadMetadata[0];
        if (loadMetadata['uuid'] != load_id) {
            msg = 'VDJ-API ERROR (ProjectController.reloadProject): Invalid load metadata id for project: ' + projectUuid + ', ' + load_id + ' != ' + loadMetadata['uuid'];
            console.error(msg);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 400, response);
        }

        // flag repertoire metadata as not loaded
        loadMetadata['value']['isLoaded'] = false;
        loadMetadata['value']['repertoireMetadataLoaded'] = false;
        await agaveIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.reloadProject - agaveIO.getProjectLoadMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // trigger load queue if necessary
        console.log('VDJ-API INFO: ProjectController.reloadProject, project: ' + projectUuid + ' flagged for repository reload'
            + ', metadata: ' + loadMetadata.uuid);

        projectQueueManager.triggerProjectLoad(projectUuid, loadMetadata);

        // flag ADC download cache
        await ServiceAccount.getToken()
            .catch(function(error) {
                msg = 'VDJ-API ERROR (ProjectController.reloadProject): ServiceAccount.getToken, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // get the study_id
        var projectMetadata = await agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid)
            .catch(function(error) {
                msg = 'VDJ-API ERROR (ProjectController.reloadProject): agaveIO.getProjectMetadata, error: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // assume VDJServer repository
        adcDownloadQueueManager.recacheRepertoireMetadata('vdjserver', projectMetadata['value']['study_id']);

        return apiResponseController.sendSuccess('Project queued for reload', response);
    } else {
        msg = 'VDJ-API ERROR (ProjectController.reloadProject): project: ' + projectUuid + ' does not have load metadata.';
        console.error(msg);
        webhookIO.postToSlack(msg);            
        return apiResponseController.sendError(msg, 400, response);
    }
};

//
// Archive (soft delete) project
// This changes the name so it does not show up in normal project queries
// None of the other metadata/files/jobs are modified
//
ProjectController.archiveProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg = null;

    // TODO: the project cannot be published and/or loaded
    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'private_project') {
                projectMetadata.name = 'archive_project';
                //console.log(projectMetadata);
                return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
            } else {
                msg = 'VDJ-API ERROR: ProjectController.archiveProject - project ' + projectUuid + ' is not in an archivable state.';
                return Promise.reject(new Error(msg));
            }
        })
        .then(function(responseObject) {
            console.log('VDJ-API INFO: ProjectController.archiveProject - project ' + projectUuid + ' has been archived.');
            //console.log(responseObject);

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            if (!msg) msg = 'VDJ-API ERROR: ProjectController.archiveProject - project ' + projectUuid + ' error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

//
// Unarchive (soft delete) project
// This changes the name back to normal private project
//
ProjectController.unarchiveProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg = null;

    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'archive_project') {
                projectMetadata.name = 'private_project';
                //console.log(projectMetadata);
                return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
            } else {
                msg = 'VDJ-API ERROR: ProjectController.unarchiveProject - project ' + projectUuid + ' is not in an unarchivable state.';
                return Promise.reject(new Error(msg));
            }
        })
        .then(function(responseObject) {
            console.log('VDJ-API INFO: ProjectController.unarchiveProject - project ' + projectUuid + ' has been unarchived.');
            //console.log(responseObject);

            return apiResponseController.sendSuccess('ok', response);
        })
        .catch(function(error) {
            if (!msg) msg = 'VDJ-API ERROR: ProjectController.unarchiveProject - project ' + projectUuid + ' error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

//
// Purge (hard delete) project
// This permanently deletes everything for the project
// Right now this can only be called by an admin
//
ProjectController.purgeProject = async function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg = null;

    // TODO: the project must be already archived

    return apiResponseController.sendError('Not implemented', 500, response);
};

//
// Import/export metadata
//

//
// Importing is complicated as we need to normalize the objects in the AIRR metadata file
//
ProjectController.importMetadata = function(request, response) {
    var context = 'ProjectController.importMetadata';
    var projectUuid = request.params.project_uuid;
    var fileName = request.body.filename;
    var operation = request.body.operation;

    console.log('VDJ-API INFO: ProjectController.importMetadata - start, project: ' + projectUuid + ' file: ' + fileName + ' operation: ' + operation);

    var json_parse_msg, yaml_parse_msg;
    var msg = null;
    var data = null;
    var repList = null;
    var existingRepertoires = {};
    var existingJobs = {};
    var existingDPs = {};
    var existingDPs_by_job = {};
    var existingSubjects = {};
    var existingSamples = null;
    var repertoires = [];
    var subjects = {};
    var samples = [];
    var data_processes = [];

    ServiceAccount.getToken()
        .then(function(token) {
            // get metadata to import
            return agaveIO.getProjectFileContents(projectUuid, fileName)
        })
        .then(function(fileData) {
            console.log('VDJ-API INFO: ProjectController.importMetadata - parse file contents');
            if (fileData) {
                // try to parse as JSON
                try {
                    var doc = JSON.parse(fileData);
                    if (doc) data = doc;
                } catch (e) {
                    json_parse_msg = 'Attempt to parse as JSON document generated error: ' + e;
                    data = null;
                }
                if (! data) {
                    // try to parse as yaml
                    try {
                        var doc = yaml.safeLoad(fileData);
                        if (doc) data = doc;
                    } catch (e) {
                        yaml_parse_msg = 'Attempt to parse as YAML document generated error: ' + e;
                        data = null;
                    }
                }

                if (! data) {
                    console.error('VDJ-API ERROR: ProjectController.importMetadata, could not parse file: ' + fileName
                                + ' JSON parse error: ' + json_parse_msg + ', YAML parse error: ' + yaml_parse_msg);
                }

                return data;
            }
        })
        .then(function() {
            if (! data) return null;

            console.log('VDJ-API INFO: ProjectController.importMetadata - parsed file');

            // get existing repertoires
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'repertoire');
        })
        .then(function(_reps) {
            if (! data) return null;

            for (var r in _reps) {
                existingRepertoires[_reps[r]['uuid']] = _reps[r]['value'];
            }

            // get existing jobs
            return agaveIO.getJobsForProject(projectUuid);
        })
        .then(function(_jobs) {
            if (! data) return null;

            for (var r in _jobs) {
                existingJobs[_jobs[r]['id']] = _jobs[r];
            }

            // get existing data processing objects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'data_processing');
        })
        .then(function(_dps) {
            if (! data) return null;

            for (var r in _dps) {
                existingDPs[_dps[r]['uuid']] = _dps[r]['value'];
                existingDPs_by_job[_dps[r]['value']['data_processing_id']] = _dps[r]['uuid'];
            }

            // Do some error checking

            repList = data['Repertoire'];
            if (! repList) {
                console.error('VDJ-API ERROR: ProjectController.importMetadata, file is not valid AIRR repertoire metadata, missing Repertoire key');
                data = null;
                return;
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - file contains ' + repList.length + ' repertoires');

            // check no existing repertoire ids for append
            if (operation == 'append') {
                for (var r in repList) {
                    if (repList[r]['repertoire_id']) {
                        config.log.info(context, 'Repertoire has an assigned repertoire_id, setting to null');
                        repList[r]['repertoire_id'] = null;
                        //msg = 'Repertoires have assigned repertoire_ids, they must be null when appending';
                        //data = null;
                        //return;
                    }
                }
            }

            // check that repertoire ids are valid for replace
            if (operation == 'replace') {
                for (var r in repList) {
                    if (repList[r]['repertoire_id']) {
                        if (! existingRepertoires[repList[r]['repertoire_id']]) {
                            config.log.info(context, 'Repertoire has unknown repertoire_id, setting to null');
                            repList[r]['repertoire_id'] = null;
                            //msg = 'Repertoire has invalid repertoire_id: ' + repList[r]['repertoire_id'];
                            //data = null;
                            //return;
                        }
                    }
                }
            }

            for (var r in repList) {
                // check that data processing records are valid
                var found = false;
                for (var dp in repList[r]['data_processing']) {
                    if (repList[r]['data_processing'][dp]['primary_annotation']) found = true;
                    /* disable for now
                    if (repList[r]['data_processing'][dp]['data_processing_id']) {
                        if (! existingJobs[repList[r]['data_processing'][dp]['data_processing_id']]) {
                            msg = 'Repertoire has invalid data_processing_id: ' + repList[r]['data_processing'][dp]['data_processing_id'];
                            data = null;
                            return;
                        }
                    }
                    if (repList[r]['data_processing'][dp]['analysis_provenance_id']) {
                        if (! existingDPs[repList[r]['data_processing'][dp]['analysis_provenance_id']]) {
                            msg = 'Repertoire has invalid analysis_provenance_id: ' + repList[r]['data_processing'][dp]['analysis_provenance_id'];
                            data = null;
                            return;
                        }
                    } */
                }
                if ((repList[r]['data_processing'].length > 0) && (!found)) {
                    msg = 'Repertoire has no data_processing marked as primary_annotation';
                    data = null;
                    return;
                }

                // check that subjects have ids
                if ((! repList[r]['subject']['subject_id']) || (repList[r]['subject']['subject_id'].length == 0)) {
                    msg = 'Repertoire has subject with missing or blank subject_id';
                    data = null;
                    return;
                }
            }

            // TODO: should we update the project/study metadata?
            // Let's assume it was entered in the GUI...

            // normalize the study
            for (var r in repList) {
                repList[r]['study'] = { vdjserver_uuid: projectUuid };
            }

            // get existing subjects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'subject');
        })
        .then(function(_subjects) {
            if (! data) return null;

            console.log('VDJ-API INFO: ProjectController.importMetadata - ' + _subjects.length + ' existing subjects');

            for (var r in _subjects) {
                existingSubjects[_subjects[r]['value']['subject_id']] = _subjects[r]['uuid'];
            }

            // pull out the subjects
            for (var r in repList) {
                var rep = repList[r];
                var obj = existingSubjects[rep['subject']['subject_id']];
                if (obj) {
                    if (operation == 'replace')
                        // need to update the existing subject
                        subjects[rep['subject']['subject_id']] = rep['subject'];
                } else {
                    // new subject, need to add
                    subjects[rep['subject']['subject_id']] = rep['subject'];
                }
            }

            var subjectList = [];
            for (var r in subjects) {
                subjectList.push(subjects[r]);
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - creating/updating ' + subjectList.length + ' subjects');

            // create/update subject data
            var promises = [];
            for (var i = 0; i < subjectList.length; i++) {
                var entry = subjectList[i];
                if (existingSubjects[entry['subject_id']])
                    promises[i] = agaveIO.updateMetadata(existingSubjects[entry['subject_id']], 'subject', entry, [ projectUuid ]);
                else
                    promises[i] = agaveIO.createMetadataForTypeWithPermissions(projectUuid, 'subject', entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            // do we need to delete any subjects
            var deleteList = [];
            if (operation == 'replace') {
                // if its existing subject but not among the subjects to be imported
                for (var r in existingSubjects) {
                    if (! subjects[r]) deleteList.push(existingSubjects[r]);
                }
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - deleting ' + deleteList.length + ' old subjects');

            // delete subjects
            var promises = [];
            for (var i = 0; i < deleteList.length; i++) {
                var entry = deleteList[i];
                promises[i] = agaveIO.deleteMetadata(ServiceAccount.accessToken(), entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            // get existing subjects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'subject');
        })
        .then(function(_subjects) {
            if (! data) return null;

            for (var r in _subjects) {
                existingSubjects[_subjects[r]['value']['subject_id']] = _subjects[r]['uuid'];
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - ' + _subjects.length + ' total subjects');

            // normalize the subjects
            for (var r in repList) {
                var obj = existingSubjects[repList[r]['subject']['subject_id']];
                if (! obj) {
                    msg = 'Cannot find subject: ' + repList[r]['subject']['subject_id'] + ' for repertoire';
                    data = null;
                    return;
                }
                repList[r]['subject'] = { vdjserver_uuid: obj };
            }

            // get existing samples
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'sample_processing');
        })
        .then(function(_samples) {
            if (! data) return null;

            console.log('VDJ-API INFO: ProjectController.importMetadata - ' + _samples.length + ' existing samples');

            // find any samples to be deleted
            // if replace operation, delete all and create new records
            // if append operation, nothing to delete
            var deleteList = [];
            if (operation == 'replace') {
                // we delete all the existing ones
                for (var r in _samples) deleteList.push(_samples[r]['uuid']);
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - deleting ' + deleteList.length + ' old samples');

            // delete samples
            var promises = [];
            for (var i = 0; i < deleteList.length; i++) {
                var entry = deleteList[i];
                promises[i] = agaveIO.deleteMetadata(ServiceAccount.accessToken(), entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            samples = [];
            for (var r in repList) {
                for (var s in repList[r]['sample']) {
                    samples.push({ rep: r, sample: repList[r]['sample'][s]});
                }
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - creating ' + samples.length + ' samples');

            // we create a new function for the call so that the entry variable is still
            // within scope for the then(), otherwise entry has a different value when
            // the promises are performed in allSettled() below.
            var agaveCall = function(entry) {
                return agaveIO.createMetadataForTypeWithPermissions(projectUuid, 'sample_processing', entry['sample'])
                    .then(function(object) {
                        entry['uuid'] = object['uuid'];
                    });
            }

            // create samples
            var promises = [];
            for (var i = 0; i < samples.length; i++) {
                var entry = samples[i];
                promises[i] = agaveCall(entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            // normalize the samples
            for (var r in repList) repList[r]['sample'] = [];
            for (var s in samples) {
                var rep = repList[samples[s]['rep']];
                rep['sample'].push({ vdjserver_uuid: samples[s]['uuid'] });
            }

            // find any data_processing to be deleted
            // if replace operation, delete all and create new records
            // if append operation, nothing to delete
            var deleteList = [];
            if (operation == 'replace') {
                // we delete all the existing ones
                for (var r in existingDPs) deleteList.push(r);
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - deleting ' + deleteList.length + ' old data processing');

            // delete data processing
            var promises = [];
            for (var i = 0; i < deleteList.length; i++) {
                var entry = deleteList[i];
                promises[i] = agaveIO.deleteMetadata(ServiceAccount.accessToken(), entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            data_processes = [];
            for (var r in repList) {
                for (var dp in repList[r]['data_processing']) {
                    data_processes.push({ rep: r, dp: repList[r]['data_processing'][dp]});
                }
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - creating ' + data_processes.length + ' data processing');

            // we create a new function for the call so that the entry variable is still
            // within scope for the then(), otherwise entry has a different value when
            // the promises are performed in allSettled() below.
            var agaveCall = function(entry) {
                return agaveIO.createMetadataForTypeWithPermissions(projectUuid, 'data_processing', entry['dp'])
                    .then(function(object) {
                        entry['uuid'] = object['uuid'];
                    });
            }

            // create records
            var promises = [];
            for (var i = 0; i < data_processes.length; i++) {
                var entry = data_processes[i];
                promises[i] = agaveCall(entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            // normalize the data processing
            for (var r in repList) repList[r]['data_processing'] = [];
            for (var dp in data_processes) {
                var rep = repList[data_processes[dp]['rep']];
                rep['data_processing'].push({ vdjserver_uuid: data_processes[dp]['uuid'] });
            }

            // now the repertoires are finally normalized

            // find any repertoires to be deleted
            // if replace operation, delete ones not in list
            // if append operation, nothing to delete
            var deleteList = [];
            if (operation == 'replace') {
                for (var r in repList) {
                    if (repList[r]['repertoire_id']) {
                        if (existingRepertoires[repList[r]['repertoire_id']]) {
                            delete existingRepertoires[repList[r]['repertoire_id']];
                        }
                    }
                }
                // any remaining are to be deleted
                for (var r in existingRepertoires) deleteList.push(r);
            }

            console.log('VDJ-API INFO: ProjectController.importMetadata - deleting ' + deleteList.length + ' old repertoires');

            // delete repertoires
            var promises = [];
            for (var i = 0; i < deleteList.length; i++) {
                var entry = deleteList[i];
                promises[i] = agaveIO.deleteMetadata(ServiceAccount.accessToken(), entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            console.log('VDJ-API INFO: ProjectController.importMetadata - creating/updating ' + repList.length + ' repertoires');

            // create/update repertoires
            var promises = [];
            for (var i = 0; i < repList.length; i++) {
                var entry = repList[i];
                if (entry['repertoire_id'])
                    promises[i] = agaveIO.updateMetadata(entry['repertoire_id'], 'repertoire', entry, [ projectUuid ]);
                else
                    promises[i] = agaveIO.createMetadataForTypeWithPermissions(projectUuid, 'repertoire', entry);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) return null;

            // get existing repertoires
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'repertoire');
        })
        .then(function(_reps) {
            if (! data) return null;

            console.log('VDJ-API INFO: ProjectController.importMetadata - updating repertoire_ids');

            // need to make sure each has repertoire_id
            for (var r in _reps) _reps[r]['value']['repertoire_id'] = _reps[r]['uuid'];

            // create/update repertoires
            var promises = [];
            for (var i = 0; i < _reps.length; i++) {
                var entry = _reps[i];
                promises[i] = agaveIO.updateMetadata(entry['uuid'], 'repertoire', entry['value'], [ projectUuid ]);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            if (! data) {
                var error_msg = 'VDJ-API ERROR: ProjectController.importMetadata - error - project: ' + projectUuid + ', error: ';
                if (msg) msg = 'Failed to import metadata: ' + msg;
                else msg = 'Failed to import metadata';
                console.error(error_msg + msg);
                webhookIO.postToSlack(error_msg + msg);
                apiResponseController.sendError(msg, 400, response);
            } else {
                console.log('VDJ-API INFO: ProjectController.importMetadata - successfully imported metadata');
                apiResponseController.sendSuccess('Successfully imported metadata', response);
            }
        })
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.importMetadata - error - project: ' + projectUuid + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);            
            apiResponseController.sendError(msg, 500, response);
        });
};

//
// Exporting is fairly simple as we just need to collect all the normalized objects
// and put into the denormalized AIRR metadata format. We already have a function that
// does that, so just call it and return the result.
//
ProjectController.exportMetadata = async function(request, response) {
    var context = 'ProjectController.exportMetadata';
    var projectUuid = request.params.project_uuid;
    var msg = null;

    config.log.info(context, 'start, project: ' + projectUuid);

    // gather the repertoire objects
    var repertoireMetadata = await agaveIO.gatherRepertoireMetadataForProject(projectUuid, true)
        .catch(function(error) {
            msg = config.log.error(context, 'agaveIO.gatherRepertoireMetadataForProject, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    config.log.info(context, 'gathered ' + repertoireMetadata.length + ' repertoire metadata for project: ' + projectUuid);

    // save in file
    var data = {};
    data['Info'] = config.info.schema;
    data['Repertoire'] = repertoireMetadata;
    var buffer = Buffer.from(JSON.stringify(data, null, 2));
    await agaveIO.uploadFileToProjectTempDirectory(projectUuid, 'repertoires.airr.json', buffer)
        .catch(function(error) {
            msg = config.log.error(context, 'agaveIO.uploadFileToProjectTempDirectory, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    config.log.info(context, 'Successfully exported metadata to repertoires.airr.json');
    apiResponseController.sendSuccess({ file: 'repertoires.airr.json' }, response);
};

//
// Import/Export metadata tables such as subject, sample, data_processing, etc
//

ProjectController.importTable = function(request, response) {
/*
    var projectUuid = request.params.projectUuid;
    var fileUuid = request.body.fileUuid;
    var fileName = request.body.fileName;
    var op = request.body.operation;
    var type = request.body.type;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.importMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    if (!type) {
        console.error('VDJ-API ERROR: ProjectController.importMetadata - missing metadata type parameter');
        apiResponseController.sendError('Metadata type required.', 400, response);
        return;
    }

    if (agaveSettings.metadataTypes.indexOf(type) < 0) {
        console.error('VDJ-API ERROR: ProjectController.importMetadata - invalid metadata type parameter');
        apiResponseController.sendError('Invalid metadata type.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: ProjectController.importMetadata - start, project: ' + projectUuid + ' file: ' + fileName + ' type: ' + type + ' operation: ' + op);

    var data;

    // get metadata to import
    agaveIO.getProjectFileContents(projectUuid, fileName)
        .then(function(fileData) {
            // create metadata items
            console.log('VDJ-API INFO: ProjectController.importMetadata - get import file contents');
            if (fileData) {
                //console.log(fileData);
                fileData = fileData.trim();

                data = d3.tsvParse(fileData);
                //console.log(data);

                return data;
            }
        })
        .then(function() {
            if (op == 'replace') {
                // delete existing metadata if requested
                console.log('VDJ-API INFO: ProjectController.importMetadata - delete existing metadata entries');
                return agaveIO.deleteAllMetadataForType(projectUuid, type);
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.importMetadata - get columns');
            return agaveIO.getMetadataColumnsForType(projectUuid, type)
                .then(function(responseObject) {
                    //console.log(responseObject);
                    if (responseObject.length == 0) {
                        // no existing columns defined
                        var value = { columns: data.columns };
                        return agaveIO.createMetadataColumnsForType(projectUuid, type, value, null);
                    } else {
                        if (op == 'replace') {
                            // replace existing columns
                            value = responseObject[0].value;
                            value.columns = data.columns;
                            return agaveIO.createMetadataColumnsForType(projectUuid, type, value, responseObject[0].uuid);
                        } else {
                            // merge with existing colums
                            value = responseObject[0].value;
                            for (var i = 0; i < data.columns.length; ++i) {
                                if (value.columns.indexOf(data.columns[i]) < 0) value.columns.push(data.columns[i]);
                            }
                            return agaveIO.createMetadataColumnsForType(projectUuid, type, value, responseObject[0].uuid);
                        }
                    }
                });
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.importMetadata - set permissions on subject columns');
            return agaveIO.getMetadataColumnsForType(projectUuid, type)
                .then(function(responseObject) {
                    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject[0].uuid);
                });
        })
        .then(function() {
            // special fields - filename_uuid
            console.log('VDJ-API INFO: ProjectController.importMetadata - special field: filename_uuid');
            if (data.columns.indexOf('filename_uuid') < 0) return null;
            else return agaveIO.getProjectFiles(projectUuid);
        })
        .then(function(projectFiles) {
            if (!projectFiles) return;

            // link to appropriate file
            for (var j = 0; j < data.length; ++j) {
                var dataRow = data[j];
                if (dataRow.filename_uuid) {
                    for (var i = 0; i < projectFiles.length; ++i) {
                        if (dataRow.filename_uuid == projectFiles[i].value.name) {
                            dataRow.filename_uuid = projectFiles[i].uuid;
                            break;
                        }
                    }
                }
            }
        })
        .then(function() {
            // special fields - subject_uuid
            console.log('VDJ-API INFO: ProjectController.importMetadata - special field: subject_uuid');
            if (data.columns.indexOf('subject_uuid') < 0) return null;
            else return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'subject');
        })
        .then(function(subjectMetadata) {
            if (!subjectMetadata) return;

            for (var j = 0; j < data.length; ++j) {
                var dataRow = data[j];
                if (dataRow.subject_uuid) {
                    for (var i = 0; i < subjectMetadata.length; ++i) {
                        if (dataRow.subject_uuid == subjectMetadata[i].value['subject_id']) {
                            dataRow.subject_uuid = subjectMetadata[i].uuid;
                            break;
                        }
                    }
                }
            }
        })
        .then(function() {
            // special fields - sample_uuid
            console.log('VDJ-API INFO: ProjectController.importMetadata - special field: sample_uuid');
            if (data.columns.indexOf('sample_uuid') < 0) return null;
            else return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'sample');
        })
        .then(function(metadataList) {
            if (!metadataList) return;

            for (var j = 0; j < data.length; ++j) {
                var dataRow = data[j];
                if (dataRow.sample_uuid) {
                    for (var i = 0; i < metadataList.length; ++i) {
                        if (dataRow.sample_uuid == metadataList[i].value['sample_id']) {
                            dataRow.sample_uuid = metadataList[i].uuid;
                            break;
                        }
                    }
                }
            }
        })
        .then(function() {
            // special fields - cell_processing_uuid
            console.log('VDJ-API INFO: ProjectController.importMetadata - special field: cell_processing_uuid');
            if (data.columns.indexOf('cell_processing_uuid') < 0) return null;
            else return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'cellProcessing');
        })
        .then(function(metadataList) {
            if (!metadataList) return;

            for (var j = 0; j < data.length; ++j) {
                var dataRow = data[j];
                if (dataRow.cell_processing_uuid) {
                    for (var i = 0; i < metadataList.length; ++i) {
                        if (dataRow.cell_processing_uuid == metadataList[i].value['cell_processing_id']) {
                            dataRow.cell_processing_uuid = metadataList[i].uuid;
                            break;
                        }
                    }
                }
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.importMetadata - create metadata entries');
            var promises = data.reverse().map(function(dataRow) {
                //console.log(dataRow);
                return function() {
                    return agaveIO.createMetadataForType(projectUuid, type, dataRow);
                }
            });

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, type);
        })
        .then(function(metadataList) {
            console.log('VDJ-API INFO: ProjectController.importMetadata - set permissions on metadata entries');
            var promises = metadataList.map(function(entry) {
                //console.log(entry);
                return function() {
                    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, entry.uuid);
                }
            });

            return promises.reduce(Q.when, new Q());
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.importMetadata - done');
            apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.importMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
*/
};

ProjectController.exportTable = async function(request, response) {
    var context = 'ProjectController.exportTable';
    var projectUuid = request.params.project_uuid;
    var tableName = request.params.table_name;
    var msg = null;

    if (!projectUuid) {
        msg = config.log.error('VDJ-API ERROR: ProjectController.exportTable - missing Project uuid parameter');
        apiResponseController.sendError(msg, 400, response);
        return;
    }

    if (!tableName) {
        console.error('VDJ-API ERROR: ProjectController.exportTable - missing table name parameter');
        apiResponseController.sendError(msg, 400, response);
        return;
    }

/*
    if (agaveSettings.metadataTypes.indexOf(type) < 0) {
        console.error('VDJ-API ERROR: ProjectController.exportMetadata - invalid metadata type parameter');
        apiResponseController.sendError('Invalid metadata type.', 400, response);
        return;
    }

    if (!format) format = 'TSV'; */

    config.log.info(context, 'start, project: ' + projectUuid + ' table: ' + tableName);

    var token = await ServiceAccount.getToken()
        .catch(function(error) {
            msg = config.log.error(context, 'ServiceAccount.getToken, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    var metadataList = await agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, tableName)
        .catch(function(error) {
            msg = config.log.error(context, 'agaveIO.getMetadataForType, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    var tsvData = '';
    var schema = null;
    if (tableName == 'subject') schema = airr.getSchema('Subject');
    if (tableName == 'diagnosis') schema = airr.getSchema('Diagnosis');
    if (tableName == 'sample_processing') schema = airr.getSchema('SampleProcessing');
    var all_columns = [ 'vdjserver_uuid' ];
    var columns = [ 'vdjserver_uuid' ];
    for (let i in schema.properties) {
        //console.log(i);
        //console.log(schema.properties[i]);
        all_columns.push(i);
        if (schema.type(i) == 'array') continue;
        if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
        columns.push(i);
    }

    // default
    if (metadataList.length == 0) {
        tsvData = columns.join('\t') + '\n';
    }

    // convert to TSV format
    for (var i = 0; i < metadataList.length; ++i) {
        var value = metadataList[i].value;

        // header
        if (i == 0) {
            var first = true;
            for (var j = 0; j < columns.length; ++j) {
                var prop = columns[j];
                if (!first) tsvData += '\t';
                tsvData += prop;
                first = false;
            }
            for (var prop in value) {
                if (all_columns.indexOf(prop) >= 0) continue;
                if (!first) tsvData += '\t';
                tsvData += prop;
                first = false;
            }
            tsvData += '\n';
        }

        // values
        var first = true;
        for (var j = 0; j < columns.length; ++j) {
            var prop = columns[j];
            if (!first) tsvData += '\t';
            if (prop == 'vdjserver_uuid') {
                tsvData += metadataList[i]['uuid'];
            } else if (prop in value) {
                if (schema.is_ontology(prop)) {
                    if (value[prop]['id'] != null) tsvData += value[prop]['id'];
                } else if (value[prop] != null) tsvData += value[prop];
            }
            first = false;
        }
        for (var prop in value) {
            if (all_columns.indexOf(prop) >= 0) continue;
            if (!first) tsvData += '\t';
            tsvData += value[prop];
            first = false;
        }
        tsvData += '\n';
    }

    var buffer = Buffer.from(tsvData);
    await agaveIO.uploadFileToProjectTempDirectory(projectUuid, tableName + '_metadata.tsv', buffer)
        .catch(function(error) {
            msg = config.log.error(context, 'agaveIO.uploadFileToProjectTempDirectory, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    await agaveIO.setFilePermissionsForProjectUsers(projectUuid, projectUuid + '/deleted/' + tableName + '_metadata.tsv', false)
        .catch(function(error) {
            msg = config.log.error(context, 'agaveIO.setFilePermissionsForProjectUsers, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    config.log.info(context, 'Successfully exported metadata to ' + tableName + '_metadata.tsv');
    apiResponseController.sendSuccess({ file: tableName + '_metadata.tsv' }, response);
};

/*
// Create download postit for public project file

ProjectController.createPublicPostit = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var fileUuid = request.params.fileUuid;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.createPublicPostit - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    if (!fileUuid) {
        console.error('VDJ-API ERROR: ProjectController.createPublicPostit - missing Metadata id parameter');
        apiResponseController.sendError('Metadata id required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: ProjectController.createPublicPostit - start, project: ' + projectUuid + ' file: ' + fileUuid);

    // Creating a postit requires a POST which cannot be done by
    // the guest account, so we create it here. The postit is used
    // for downloading public project data and job files.

    var msg = null;
    ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            // Verify it is a public project
            if (projectMetadata.name == 'publicProject') {
                return agaveIO.getMetadata(fileUuid);
            } else {
                msg = 'VDJ-API ERROR: ProjectController.createPublicPostit - project ' + projectUuid + ' is not a public project.';
                return Q.reject(new Error(msg));
            }
        })
        .then(function(fileMetadata) {
            if (fileMetadata.value.projectUuid != projectUuid) {
                msg = 'VDJ-API ERROR: ProjectController.createPublicPostit - file ' + fileUuid + ' is not a valid project file.';
                return Q.reject(new Error(msg));
            } else if (fileMetadata.name == 'projectFile') {
                // if project data file
                return agaveIO.createCommunityFilePostit(projectUuid, 'files/' + fileMetadata.value.name);
            } else if (fileMetadata.name == 'projectJobFile') {
                // if project job file
                return agaveIO.createCommunityFilePostit(projectUuid, 'analyses/' + fileMetadata.value.relativeArchivePath + '/' + fileMetadata.value.name);
            } else {
                msg = 'VDJ-API ERROR: ProjectController.createPublicPostit - file ' + fileUuid + ' is not a valid project file.';
                return Q.reject(new Error(msg));
            }
        })
        .then(function(targetUrl) {
            console.log('VDJ-API INFO: ProjectController.createPublicPostit - done, project: ' + projectUuid + ' file: ' + fileUuid);

            return apiResponseController.sendSuccess(targetUrl, response);
        })
        .catch(function(error) {
            if (!msg) msg = 'VDJ-API ERROR: ProjectController.createPublicPostit - project ' + projectUuid + ' error ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        })
        ;
};
*/
