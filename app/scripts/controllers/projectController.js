
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
var mongoSettings = require('../config/mongoSettings');

// Controllers
var apiResponseController = require('./apiResponseController');
var authController = require('./authController');

// Models
var FileUploadJob = require('../models/fileUploadJob');
var AnalysisDocument = require('../models/AnalysisDocument');

var airr = require('airr-js');
var vdj_schema = require('vdjserver-schema');

// Queues
var filePermissionsQueueManager = require('../queues/filePermissionsQueueManager');
var projectQueueManager = require('../queues/projectQueueManager');
var adcDownloadQueueManager = require('../queues/adcDownloadQueueManager');

// Processing
var webhookIO = require('../vendor/webhookIO');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;
var ServiceAccount = tapisIO.serviceAccount;

// Node Libraries
var requestLib = require('request');
var yaml = require('js-yaml');
var d3 = require('d3');
const { v4: uuidv4 } = require('uuid');
var moment = require('moment');

var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

//
// Creates a project and all initial directories
//
ProjectController.createProject = function(request, response) {
    const context = 'ProjectController.createProject';

    var project = request.body.project;
    var projectName = project['study_title'];
    var username    = request.user.username;

    var projectMetadata;
    var uuid;

    // set the username as the project owner
    //project['owner'] = username;

    config.log.info(context, 'username: ' + username + ', project name: ' + projectName);

    ServiceAccount.getToken()
        .then(function(token) {
            return tapisIO.createProjectMetadata(username, project);
        })
        .then(function(_projectMetadata) {
            // Save these for later
            projectMetadata = _projectMetadata;
            uuid = projectMetadata.uuid;

            config.log.info(context, 'created project metadata for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            // create project/files directory
            return tapisIO.createProjectDirectory(uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            config.log.info(context, 'created files dir for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return tapisIO.createProjectDirectory(uuid + '/analyses');
        })
        // create project/deleted directory
        .then(function() {
            config.log.info(context, 'created analyses dir for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return tapisIO.createProjectDirectory(uuid + '/deleted');
        })
        // set permissions on project directories
        .then(function() {
            config.log.info(context, 'set file permissions for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            return tapisIO.grantProjectFilePermissions(username, uuid, '');
        })
        .then(function() {
            return tapisIO.grantProjectFilePermissions(username, uuid, 'files');
        })
        .then(function() {
            return tapisIO.grantProjectFilePermissions(username, uuid, 'analyses');
        })
        .then(function() {
            return tapisIO.grantProjectFilePermissions(username, uuid, 'deleted');
        })
        .then(function() {
            config.log.info(context, 'complete for username: ' + username + ', project name: ' + projectName + ' uuid: ' + uuid);

            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(projectMetadata, response);
        })
        .catch(function(error) {
            var msg = 'error - username ' + username + ', project name ' + projectName + ', error ' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 500, response);
        });
};

//
// Project metadata operations
//
ProjectController.getProjectMetadata = async function(request, response) {
    const context = 'ProjectController.getProjectMetadata';
    var msg = null;
    var username = request['user']['username'];

    config.log.info(context, 'user: ' + username);

    // get metadata
    var metadata = await tapisIO.getProjectMetadata(username)
        .catch(function(error) {
            msg = 'got error for ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(metadata, response);
};

ProjectController.queryMetadata = async function(request, response) {
    const context = 'ProjectController.queryMetadata';
    var project_uuid = request.params.project_uuid;
    var meta_name = request.params.name;
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'project: ' + project_uuid + ' with name: ' + meta_name + ' by user: ' + username);

    // get metadata
    var metadata = await tapisIO.queryMetadataForProject(project_uuid, meta_name)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' with name: ' + meta_name + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(metadata, response);
};

ProjectController.createMetadata = async function(request, response) {
    const context = 'ProjectController.createMetadata';
    var project_uuid = request.params.project_uuid;
    var meta_name = request.params.name;
    var obj = request.body;
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'project: ' + project_uuid + ' with name: ' + meta_name + ' by user: ' + username);

    // create metadata
    var metadata = await tapisIO.createMetadataForProject(project_uuid, meta_name, obj)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' with name: ' + meta_name + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(metadata, response);
};

ProjectController.getMetadata = async function(request, response) {
    const context = 'ProjectController.getMetadata';
    var project_uuid = request.params.project_uuid;
    var meta_uuid = request.params.uuid;
    var username = request['user']['username'];
    var msg = null;
    var metadata = null;

    config.log.info(context, 'project: ' + project_uuid + ' with uuid: ' + meta_uuid);

    // the project metadata does not have associationIds set to itself, so handle it specially
    if (project_uuid == meta_uuid) {
        metadata = await tapisIO.getProjectMetadata(username, meta_uuid)
            .catch(function(error) {
                msg = 'got error for project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username
                    + ', error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }
    } else {
        metadata = await tapisIO.getMetadataForProject(project_uuid, meta_uuid)
            .catch(function(error) {
                msg = 'got error for project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username
                    + ', error: ' + error;
            });
        if (msg) {
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }
    }

    // record with uuid not found, so return 404
    if (!metadata) return apiResponseController.sendError('Not found', 404, response);

    return apiResponseController.sendSuccess(metadata, response);
};

// security: project authorization has confirmed user has write access for project
ProjectController.updateMetadata = async function(request, response) {
    const context = 'ProjectController.updateMetadata';
    var project_uuid = request.params.project_uuid;
    var meta_uuid = request.params.uuid;
    var obj = request.body;
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'project: ' + project_uuid + ' with uuid: ' + meta_uuid);

    // if object uuid is provided, it must match
    if (obj['uuid'] && obj['uuid'] != meta_uuid)
        return apiResponseController.sendError('Metadata uuid: ' + meta_uuid + ' does not match object uuid: ' + obj['uuid'], 400, response);

    var metadata = await tapisIO.updateMetadataForProject(project_uuid, meta_uuid, obj)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // record with uuid not found, so return 404
    if (!metadata) return apiResponseController.sendError('Not found', 404, response);

    return apiResponseController.sendSuccess(metadata, response);
};

ProjectController.deleteMetadata = async function(request, response) {
    const context = 'ProjectController.deleteMetadata';
    var project_uuid = request.params.project_uuid;
    var meta_uuid = request.params.uuid;
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context,'project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username);

    if (project_uuid == meta_uuid)
        return apiResponseController.sendError('Project uuid matches metadata uuid, cannot delete project, use archive endpoint instead.', 400, response);

    var metadata = await tapisIO.getMetadataForProject(project_uuid, meta_uuid)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // record with uuid not found, so return 404
    if (!metadata) return apiResponseController.sendError('Not found', 404, response);

    // don't use for deleting project files
    if (metadata['name'] == 'project_file')
        return apiResponseController.sendError('Cannot delete project file, use deleteProjectFileMetadata endpoint instead.', 400, response);

    var metadata = await tapisIO.deleteMetadataForProject(project_uuid, meta_uuid)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' with uuid: ' + meta_uuid + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess('Deleted', response);
};

//
// Attach an uploaded file to the project
// security: project authorization has confirmed user has write access for project
//
ProjectController.importFile = async function(request, response) {
    const context = 'ProjectController.importFile';
    var projectUuid = request.params.project_uuid;
    var msg = null;

    config.log.info(context, 'start, project: ' + projectUuid);

    console.log(request.body);
    var fileNotification = {
        project_file: request.body,
        filePath:    request.body.path,
        projectUuid: projectUuid
    };

    // verify file notification
    var fileUploadJob = new FileUploadJob(fileNotification);
    await fileUploadJob.verifyFileNotification()
        .catch(function(error) {
            msg = 'failed verifyFileNotification: ' + JSON.stringify(fileNotification) + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    console.log(fileUploadJob);

    filePermissionsQueueManager.importFile(fileUploadJob);

    config.log.info(context,'queued for file uuid ' + fileUploadJob.fileUuid);
    return apiResponseController.sendSuccess('Importing file', response);
};

//
// Generate postit for project fil
// security: project authorization has confirmed user has write access for project
//
ProjectController.postitFile = async function(request, response) {
    const context = 'ProjectController.postitFile';
    var project_uuid = request.params.project_uuid;
    var obj = request.body;
    var path = request.body.path;
    var msg = null;

    config.log.info(context, 'start, project: ' + project_uuid + ' path:' + path);

    // TODO: can .. be in the path?

    // get file detail, the path should be relative to the project directory
    var detail = await tapisIO.getProjectFileDetail(project_uuid + '/' + path)
        .catch(function(error) {
            msg = 'Cannot get file detail, error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }
    if (!detail) {
        return Promise.reject(new Error('Could not get file detail for path: ' + path));
    }
    if (detail.length != 1) {
        return Promise.reject(new Error('Invalid length (!= 1) for file detail query for path: ' + path));
    }
    detail = detail[0];
    if (detail.type != 'file') {
        return Promise.reject(new Error('file path: ' + path + ' is not a file.'))
    }

    // create postit
    var postit = await tapisIO.createProjectFilePostit(project_uuid, obj)
        .catch(function(error) {
            msg = 'Could not create postit, error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    //console.log(postit);

    config.log.info(context,'created postit: ' + postit['result']['id'] + ' url: ' + postit['result']['redeemUrl']);

    return apiResponseController.sendSuccess(postit['result'], response);
};

// get project file metadata by file name
// security: project authorization has confirmed user has write access for project
ProjectController.getProjectFileMetadata = async function(request, response) {
    const context = 'ProjectController.getProjectFileMetadata';
    var project_uuid = request.params.project_uuid;
    var filename = decodeURIComponent(request.params.name);
    var username = request['user']['username'];
    var msg = null;

    var filter = { "value.name": filename };
    var metadata = await tapisIO.queryMetadataForProject(project_uuid, 'project_file', filter)
        .catch(function(error) {
            msg = 'got error for project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // record with uuid not found, so return 404
    if (!metadata) return apiResponseController.sendError('Not found', 404, response);

    return apiResponseController.sendSuccess(metadata, response);
};

// delete project file and metadata by file name
// security: project authorization has confirmed user has write access for project
ProjectController.deleteProjectFileMetadata = async function(request, response) {
    const context = 'ProjectController.deleteProjectFileMetadata';
    var project_uuid = request.params.project_uuid;
    var filename = decodeURIComponent(request.params.name);
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'start, project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username);

    // we do a soft delete by moving the file and changing metadata name
    // rough provenance for jobs and such that might reference the file

    // first get the metadata entry
    var filter = { "value.name": filename };
    var metadata = await tapisIO.queryMetadataForProject(project_uuid, 'project_file', filter)
        .catch(function(error) {
            msg = 'tapisIO.queryMetadataForProject error for project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // this shouldn't happen
    if (!metadata) return Promise.reject(new Error('empty query response.'));
    // 404 not found
    if (metadata.length == 0) return apiResponseController.sendError('Not found', 404, response);
    // yikes!
    if (metadata.length != 1) return Promise.reject(new Error('internal error, multiple records have the same filename.'));
    // eliminate array
    metadata = metadata[0];

    // a time-based directory allows for soft deletion of files with the same name
    var fromPath = metadata['value']['path'];
    var datetimeDir = moment().format('YYYY-MM-DD-HH-mm-ss-SS');
    var moveDir = project_uuid + '/deleted/' + datetimeDir;
    await tapisIO.createProjectDirectory(moveDir)
        .catch(function(error) {
            msg = 'tapisIO.createProjectDirectory error for project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // update the metadata entry
    metadata['name'] = 'deleted_file';
    metadata['value']['path'] = '/projects/' + moveDir + '/' + metadata['value']['name'];
    metadata['value']['url'] = 'tapis://' + tapisSettings.storageSystem + metadata['value']['path'];
    await tapisIO.updateMetadataForProject(project_uuid, metadata['uuid'], metadata)
        .catch(function(error) {
            msg = 'tapisIO.updateMetadata error for project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // move the file
    await tapisIO.moveProjectFile(fromPath, metadata['value']['path'])
        .catch(function(error) {
            msg = 'tapisIO.moveProjectFile error for project: ' + project_uuid + ' filename: ' + filename + ' by user: ' + username
                + ', error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(metadata, response);
};

// Add user to a project by giving them permissions on all of the project objects
// security: project authorization has confirmed user has write access for project
ProjectController.addPermissionsForUsername = async function(request, response) {
    const context = 'ProjectController.addPermissionsForUsername';
    var project_uuid = request.params.project_uuid;
    var username    = request.body.username;

    config.log.info(context, 'start, project: ' + project_uuid + ' for user: ' + username);

    // verify the user
    var result = await authController.verifyUser(username)
        .catch(function(error) {
            msg = 'error attempting to validate user: ' + username + ' error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (!result) {
        var msg = 'attempt to add invalid user: ' + username;
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    // submit job to queue
    var projectData = { username: username, project_uuid: project_uuid };
    projectQueueManager.addUserToProject(projectData);

    return apiResponseController.sendSuccess('ok', response);
};

//
// Remove user frome a project by removing permissions on all of the project objects
// Verify the user then kick off task to queue
// The task processing code is in queues/projectQueueManager.js
//
// security: project authorization has confirmed user has write access for project
ProjectController.removePermissionsForUsername = async function(request, response) {
    var context = 'ProjectController.removePermissionsForUsername';
    var project_uuid = request.params.project_uuid;
    var username    = request.body.username;

    config.log.info(context, 'start, project: ' + project_uuid + ' for user: ' + username);

    // verify the user
    var result = await authController.verifyUser(username)
        .catch(function(error) {
            msg = 'error attempting to validate user: ' + username + ' error: ' + error;
        });
    if (msg) {
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (!result) {
        var msg = 'attempt to remove invalid user: ' + username;
        msg = config.log.error(context, msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    // submit job to queue
    var projectData = { username: username, project_uuid: project_uuid };
    projectQueueManager.removeUserFromProject(projectData);

    return apiResponseController.sendSuccess('ok', response);
};

//
//
//
ProjectController.validatePROV = function(request, response) {
    var context = 'ProjectController.validatePROV';
    var projectUuid = request.params.project_uuid;

    config.log.info(context, 'start, project: ' + projectUuid);

    // should be able to do this interactively
    // doing this requires querying Tapis about apps
    // pre-validate parameters for Tapis apps? can we parse the parameters?


    return apiResponseController.sendError('Not implemented.', 500, response);
};

ProjectController.checkPROVStatus = function(request, response) {
    var context = 'ProjectController.validatePROV';
    var projectUuid = request.params.project_uuid;

    config.log.info(context, 'start, project: ' + projectUuid);

    // store PROV model, then asynchronously validate it

    return apiResponseController.sendError('Not implemented.', 500, response);
};

ProjectController.executeWorkflow = async function(request, response) {
    var context = 'ProjectController.executeWorkflow';
    var projectUuid = request.params.project_uuid;
    var audit_only = request.query.audit_only;
    var use_alternate_app = request.query.use_alternate_app;
    var obj = request.body;

    config.log.info(context, 'start, project: ' + projectUuid);

    var doc = new AnalysisDocument(obj['value']);
    config.log.info(context, 'analysis document:' + JSON.stringify(doc, null, 2));

    // validate
    var errors = await doc.validate(projectUuid, use_alternate_app)
        .catch(function(error) {
            let msg = 'Error while validating workflow.\n' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        });
    if (errors.length > 0) return apiResponseController.sendError('Workflow is not valid.\n' + JSON.stringify(errors), 400, response);
    else if (audit_only === true) {
        return apiResponseController.sendSuccess('Workflow is valid.', response);
    } else config.log.info(context, 'Workflow is valid.');

    // create meta for analysis document
    config.log.info(context, 'create metadata for analysis document.');
    obj['value']['status'] = 'STARTED';
    var result = await tapisIO.createMetadataForProject(projectUuid, 'analysis_document', obj)
        .catch(function(error) {
            let msg = 'Error while saving analysis document.\n' + error;
            msg = config.log.error(context, msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        });
    config.log.info(context, 'result:' + JSON.stringify(result, null, 2));

    return apiResponseController.sendSuccess('Workflow submitted.', response);
};

ProjectController.getPendingPROV = function(request, response) {
    var context = 'ProjectController.getPendingPROV';
    var projectUuid = request.params.project_uuid;

    config.log.info(context, 'start, project: ' + projectUuid);

    // query list of pending PROV executions

    return apiResponseController.sendError('Not implemented.', 500, response);
};


//
// Generate visualizations
//

// This end point is a proxy for the plumber API to generate R visualizations.
// Instead of worrying about how to secure the plumber API end points and/or
// do authorization in R, we keep the API private. The plumber API is only
// accessible by docker services and not the public client/browser.
//
// Authorization for the generateVisualization end point is secured in the
// normal way for project access.

ProjectController.generateVisualization = async function(request, response) {
    var context = 'ProjectController.generateVisualization';
    var projectUuid = request.params.project_uuid;
    var visualization = request.body.visualization;
    var uuid = uuidv4();
    var repertoire_id = request.body.repertoire_id;
    var repertoire_group_id = request.body.repertoire_group_id;
    var processing_stage = request.body.processing_stage;

    config.log.info(context, 'start ' + visualization['name'] + ', project: ' + projectUuid
        + ' with uuid: ' + uuid);
    config.log.info(context, 'repertoire_id: ' + repertoire_id);
    config.log.info(context, 'repertoire_group_id: ' + repertoire_group_id);
    config.log.info(context, 'processing_stage: ' + processing_stage);

    // TODO: verify the data requested in the visualization request is accessible by user/project

//    var accessToken = authController.extractToken();
//    console.log(accessToken);

    var requestSettings = {
        url: 'http://' + 'vdj-plumber:8000' + '/plumber/v1/',
        method: 'GET'
    };

    switch (visualization['name']) {
        case 'mutational_hedgehog':
            requestSettings['url'] += visualization['name'] + '?uuid=' + uuid;
            return requestLib(requestSettings).pipe(response);
        case 'heartbeat':
        default:
            requestSettings['url'] += 'mean';
            return requestLib(requestSettings).pipe(response);
    }

/*
    var postData = {
        a: 5,
        b: 7
    };

    var requestSettings = {
        url: 'http://' + 'vdj-plumber:8000' + '/plumber/v1/sum',
        method: 'POST',
        data: postData,
        headers: {
            'Content-Type': 'application/json'
        }
    }; */


//    return requestLib(requestSettings).pipe(response);
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
            return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'private_project') {
                projectMetadata.name = 'projectPublishInProcess';
                //console.log(projectMetadata);
                return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
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
            return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'public_project') {
                projectMetadata.name = 'projectUnpublishInProcess';
                return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
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
    var loadMetadata = await tapisIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.loadProject - tapisIO.getProjectLoadMetadata, error: ' + error;
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
        await tapisIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.loadProject - tapisIO.updateMetadata, error: ' + error;
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
       loadMetadata = await tapisIO.createProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.loadProject - tapisIO.createProjectLoadMetadata, error: ' + error;
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
    var loadMetadata = await tapisIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.unloadProject - tapisIO.getProjectLoadMetadata, error: ' + error;
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
        await tapisIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.unloadProject - tapisIO.getProjectLoadMetadata, error: ' + error;
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
            var projectMetadata = await tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR (ProjectController.unloadProject): tapisIO.getProjectMetadata, error: ' + error;
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
    var loadMetadata = await tapisIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ProjectController.reloadProject - tapisIO.getProjectLoadMetadata, error: ' + error;
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
        await tapisIO.updateMetadata(loadMetadata.uuid, loadMetadata.name, loadMetadata.value, loadMetadata.associationIds)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ProjectController.reloadProject - tapisIO.getProjectLoadMetadata, error: ' + error;
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
        var projectMetadata = await tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid)
            .catch(function(error) {
                msg = 'VDJ-API ERROR (ProjectController.reloadProject): tapisIO.getProjectMetadata, error: ' + error;
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
            return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'private_project') {
                projectMetadata.name = 'archive_project';
                //console.log(projectMetadata);
                return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
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
            return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            if (projectMetadata.name == 'archive_project') {
                projectMetadata.name = 'private_project';
                //console.log(projectMetadata);
                return tapisIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
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
ProjectController.importMetadata = async function(request, response) {
    var context = 'ProjectController.importMetadata';
    var projectUuid = request.params.project_uuid;
    var fileName = request.body.filename;
    var operation = request.body.operation;

    config.log.info(context, 'start, project: ' + projectUuid + ' file: ' + fileName + ' operation: ' + operation);

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

    // get metadata to import
    var fileData = await tapisIO.getProjectFileContents(projectUuid, fileName)
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });
    // somehow in Tapis V3, the file data is coming back already as a parsed json object
    // TODO: what about yaml?
    data = fileData;

    if (! data) {
        msg = config.log.error(context, 'Could not read import file contents.');
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }
    config.log.info(context, 'parse file contents');

    // get existing repertoires
    var _reps = await tapisIO.queryMetadataForProject(projectUuid, 'repertoire')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });

    for (let r in _reps) {
        existingRepertoires[_reps[r]['uuid']] = _reps[r]['value'];
    }

    // get existing jobs
    var _jobs = await tapisIO.getJobsForProject(projectUuid)
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });

    for (let r in _jobs) {
        existingJobs[_jobs[r]['id']] = _jobs[r];
    }

    // get existing data processing objects
    var _dps = await tapisIO.queryMetadataForProject(projectUuid, 'data_processing')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });

    for (let r in _dps) {
        existingDPs[_dps[r]['uuid']] = _dps[r]['value'];
        existingDPs_by_job[_dps[r]['value']['data_processing_id']] = _dps[r]['uuid'];
    }

    // Do some error checking

    repList = data['Repertoire'];
    if (! repList) {
        msg = config.log.error(context, 'file is not valid AIRR repertoire metadata, missing Repertoire key');
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    config.log.info(context, 'file contains ' + repList.length + ' repertoires');

    // check no existing repertoire ids for append
    if (operation == 'append') {
        for (var r in repList) {
            if (repList[r]['repertoire_id']) {
                config.log.info(context, 'Repertoire has an assigned repertoire_id, setting to null');
                repList[r]['repertoire_id'] = null;
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
                }
            }
        }
    }

    for (let r in repList) {
        // check that data processing records are valid
        var found = false;
        for (let dp in repList[r]['data_processing']) {
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
            msg = config.log.error(context, 'Repertoire has no data_processing marked as primary_annotation');
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 400, response);
        }

        // check that subjects have ids
        if ((! repList[r]['subject']['subject_id']) || (repList[r]['subject']['subject_id'].length == 0)) {
            msg = config.log.error(context, 'Repertoire has subject with missing or blank subject_id');
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 400, response);
        }
    }

    // TODO: should we update the project/study metadata?
    // Let's assume it was entered in the GUI...

    // normalize the study
    for (let r in repList) {
        repList[r]['study'] = { vdjserver_uuid: projectUuid };
    }

    // get existing subjects
    var _subjects = await tapisIO.queryMetadataForProject(projectUuid, 'subject')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });
    config.log.info(context, _subjects.length + ' existing subjects');

    for (let r in _subjects) {
        existingSubjects[_subjects[r]['value']['subject_id']] = _subjects[r]['uuid'];
    }

    // pull out the subjects
    for (let r in repList) {
        let rep = repList[r];
        let obj = existingSubjects[rep['subject']['subject_id']];
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

    config.log.info(context, 'creating/updating ' + subjectList.length + ' subjects');
    for (let i = 0; i < subjectList.length; i++) {
        let entry = subjectList[i];
        entry['genotype'] = null; // TODO: hack as we don't support genotype yet
        if (entry['vdjserver_uuid']) delete entry['vdjserver_uuid']; // old schema
        if (existingSubjects[entry['subject_id']])
            await tapisIO.updateMetadataForProject(projectUuid, existingSubjects[entry['subject_id']], { "value": entry })
                .catch(function(error) {
                    msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                    webhookIO.postToSlack(msg);            
                    return apiResponseController.sendError(msg, 500, response);
                });
        else
            await tapisIO.createMetadataForProject(projectUuid, 'subject', { "value": entry })
                .catch(function(error) {
                    msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                    webhookIO.postToSlack(msg);            
                    return apiResponseController.sendError(msg, 500, response);
                });
    }

    // do we need to delete any subjects
    let deleteList = [];
    if (operation == 'replace') {
        // if its existing subject but not among the subjects to be imported
        for (let r in existingSubjects) {
            if (! subjects[r]) deleteList.push(existingSubjects[r]);
        }
    }

    config.log.info(context, 'deleting ' + deleteList.length + ' old subjects');
    // delete subjects
    for (let i = 0; i < deleteList.length; i++) {
        let entry = deleteList[i];
        await tapisIO.deleteMetadataForProject(projectUuid, entry['uuid'])
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
    }

    // get existing subjects
    _subjects = await tapisIO.queryMetadataForProject(projectUuid, 'subject')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });

    for (let r in _subjects) {
        existingSubjects[_subjects[r]['value']['subject_id']] = _subjects[r]['uuid'];
    }
    config.log.info(context, _subjects.length + ' total subjects');

    // normalize the subjects
    for (let r in repList) {
        let obj = existingSubjects[repList[r]['subject']['subject_id']];
        if (! obj) {
            msg = config.log.error(context, 'Cannot find subject: ' + repList[r]['subject']['subject_id'] + ' for repertoire');
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 400, response);
        }
        repList[r]['subject'] = { vdjserver_uuid: obj };
    }

    // get existing samples
    var _samples = await tapisIO.queryMetadataForProject(projectUuid, 'sample_processing')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });
    config.log.info(context, _samples.length + ' existing samples');

    // find any samples to be deleted
    // if replace operation, delete all and create new records
    // if append operation, nothing to delete
    deleteList = [];
    if (operation == 'replace') {
        // we delete all the existing ones
        for (let r in _samples) deleteList.push(_samples[r]['uuid']);
    }

    config.log.info(context, 'deleting ' + deleteList.length + ' old samples');
    // delete samples
    for (let i = 0; i < deleteList.length; i++) {
        let entry = deleteList[i];
        await tapisIO.deleteMetadataForProject(projectUuid, entry)
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
    }

    samples = [];
    for (let r in repList) {
        for (let s in repList[r]['sample']) {
            samples.push({ rep: r, sample: repList[r]['sample'][s]});
        }
    }

    config.log.info(context, 'creating ' + samples.length + ' samples');
    // create samples
    for (let i = 0; i < samples.length; i++) {
        let entry = samples[i];
        if (entry['sample']['vdjserver_uuid']) delete entry['sample']['vdjserver_uuid']; // old schema
        let object = await tapisIO.createMetadataForProject(projectUuid, 'sample_processing', { "value": entry['sample'] })
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
        entry['uuid'] = object['uuid'];
    }

    // normalize the samples
    for (let r in repList) repList[r]['sample'] = [];
    for (let s in samples) {
        let rep = repList[samples[s]['rep']];
        rep['sample'].push({ vdjserver_uuid: samples[s]['uuid'] });
    }

    // find any data_processing to be deleted
    // if replace operation, delete all and create new records
    // if append operation, nothing to delete
    deleteList = [];
    if (operation == 'replace') {
        // we delete all the existing ones
        for (let r in existingDPs) deleteList.push(r);
    }

    config.log.info(context, 'deleting ' + deleteList.length + ' old data processing');
    // delete data processing
    for (let i = 0; i < deleteList.length; i++) {
        let entry = deleteList[i];
        await tapisIO.deleteMetadataForProject(projectUuid, entry)
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
    }

    data_processes = [];
    for (var r in repList) {
        for (var dp in repList[r]['data_processing']) {
            data_processes.push({ rep: r, dp: repList[r]['data_processing'][dp]});
        }
    }

    config.log.info(context, 'creating ' + data_processes.length + ' data processing');
    for (let i = 0; i < data_processes.length; i++) {
        let entry = data_processes[i];
        if (entry['dp']['vdjserver_uuid']) delete entry['dp']['vdjserver_uuid']; // old schema
        let object = await tapisIO.createMetadataForProject(projectUuid, 'data_processing', { "value": entry['dp'] })
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
        entry['uuid'] = object['uuid'];
    }

    // normalize the data processing
    for (let r in repList) repList[r]['data_processing'] = [];
    for (let dp in data_processes) {
        let rep = repList[data_processes[dp]['rep']];
        rep['data_processing'].push({ vdjserver_uuid: data_processes[dp]['uuid'] });
    }

    // now the repertoires are finally normalized

    // find any repertoires to be deleted
    // if replace operation, delete ones not in list
    // if append operation, nothing to delete
    deleteList = [];
    if (operation == 'replace') {
        for (let r in repList) {
            if (repList[r]['repertoire_id']) {
                if (existingRepertoires[repList[r]['repertoire_id']]) {
                    delete existingRepertoires[repList[r]['repertoire_id']];
                }
            }
        }
        // any remaining are to be deleted
        for (let r in existingRepertoires) deleteList.push(r);
    }

    config.log.info(context, 'deleting ' + deleteList.length + ' old repertoires');
    // delete repertoires
    for (let i = 0; i < deleteList.length; i++) {
        let entry = deleteList[i];
        await tapisIO.deleteMetadataForProject(projectUuid, entry)
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
    }

    config.log.info(context, 'creating/updating ' + repList.length + ' repertoires');
    // create/update repertoires
    for (let i = 0; i < repList.length; i++) {
        let entry = repList[i];
        if (entry['repertoire_id'])
            await tapisIO.updateMetadataForProject(projectUuid, entry['repertoire_id'], { "value": entry })
                .catch(function(error) {
                    msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                    webhookIO.postToSlack(msg);            
                    return apiResponseController.sendError(msg, 500, response);
                });
        else
            await tapisIO.createMetadataForProject(projectUuid, 'repertoire', { "value": entry })
                .catch(function(error) {
                    msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                    webhookIO.postToSlack(msg);            
                    return apiResponseController.sendError(msg, 500, response);
                });
    }

    // get existing repertoires
    _reps = await tapisIO.queryMetadataForProject(projectUuid, 'repertoire')
        .catch(function(error) {
            msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
            webhookIO.postToSlack(msg);            
            return apiResponseController.sendError(msg, 500, response);
        });
    config.log.info(context, 'updating repertoire_ids');

    // need to make sure each has repertoire_id
    for (let r in _reps) _reps[r]['value']['repertoire_id'] = _reps[r]['uuid'];

    // create/update repertoires
    for (let i = 0; i < _reps.length; i++) {
        let entry = _reps[i];
        await tapisIO.updateMetadataForProject(projectUuid, entry['uuid'], entry)
            .catch(function(error) {
                msg = config.log.error(context, 'project: ' + projectUuid + ', error: ' + error);
                webhookIO.postToSlack(msg);            
                return apiResponseController.sendError(msg, 500, response);
            });
    }

    config.log.info(context, 'successfully imported metadata');
    apiResponseController.sendSuccess('Successfully imported metadata', response);
};

ProjectController.gatherRepertoireMetadataForProject = async function(username, projectUuid, keep_uuids) {
    var context = 'ProjectController.gatherRepertoireMetadataForProject';

    var msg = null;
    var repertoireMetadata = [];
    var subjectMetadata = {};
    var sampleMetadata = {};
    var dpMetadata = {};
    var projectMetadata = null;

    return ServiceAccount.getToken()
        .then(function(token) {
            // get the project metadata
            return tapisIO.getProjectMetadata(username, projectUuid);
        })
        .then(function(_projectMetadata) {
            // 404 not found
            if (_projectMetadata.length == 0) return Promise.reject(new Error('project: ' + projectUuid + ' not found.'));
            // yikes!
            if (_projectMetadata.length != 1) return Promise.reject(new Error('internal error, multiple records have the same uuid.'));

            projectMetadata = _projectMetadata[0];

            // get repertoire objects
            return tapisIO.queryMetadataForProject(projectUuid, 'repertoire');
        })
        .then(function(models) {
            config.log.info(context, 'gathered ' + models.length + ' repertoires.');

            // put into AIRR format
            var study = projectMetadata.value;
            var schema = airr.get_schema('Repertoire');
            var blank = schema.template();
            //console.log(JSON.stringify(study, null, 2));
            //console.log(JSON.stringify(blank, null, 2));

            if (!keep_uuids) delete study['vdjserver'];

            for (var i in models) {
                var model = models[i].value;
                model['repertoire_id'] = models[i].uuid;
                model['study'] = study;
                repertoireMetadata.push(model);
            }

            // get subject objects
            return tapisIO.queryMetadataForProject(projectUuid, 'subject');
        })
        .then(function(models) {
            config.log.info(context, 'gathered ' + models.length + ' subjects.');

            for (var i in models) {
                subjectMetadata[models[i].uuid] = models[i].value;
            }

            // get sample processing objects
            return tapisIO.queryMetadataForProject(projectUuid, 'sample_processing');
        })
        .then(function(models) {
            config.log.info(context, 'gathered ' + models.length + ' sample processings.');

            for (var i in models) {
                sampleMetadata[models[i].uuid] = models[i].value;
            }

            // get data processing objects
            return tapisIO.queryMetadataForProject(projectUuid, 'data_processing');
        })
        .then(function(models) {
            config.log.info(context, 'gathered ' + models.length + ' data processings.');
             for (var i in models) {
                dpMetadata[models[i].uuid] = models[i].value;
            }
        })
        .then(function() {
            var dpschema = airr.get_schema('DataProcessing');

            // put into AIRR format
            for (var i in repertoireMetadata) {
                var rep = repertoireMetadata[i];
                var subject = subjectMetadata[rep['subject']['vdjserver_uuid']];
                if (! subject) {
                    console.error('VDJ-API ERROR: tapisIO.gatherRepertoireMetadataForProject, cannot collect subject: '
                                  + rep['subject']['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                }
                if (!keep_uuids) delete subject['value']['vdjserver'];
                rep['subject'] = subject;

                var samples = [];
                for (var j in rep['sample']) {
                    var sample = sampleMetadata[rep['sample'][j]['vdjserver_uuid']];
                    if (! sample) {
                        console.error('VDJ-API ERROR: tapisIO.gatherRepertoireMetadataForProject, cannot collect sample: '
                                      + rep['sample'][j]['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                    }
                    if (!keep_uuids) delete sample['value']['vdjserver'];
                    samples.push(sample);
                }
                rep['sample'] = samples;

                var dps = [];
                for (var j in rep['data_processing']) {
                    // can be null if no analysis has been done
                    if (rep['data_processing'][j]['vdjserver_uuid']) {
                        var dp = dpMetadata[rep['data_processing'][j]['vdjserver_uuid']];
                        if (! dp) {
                            console.error('VDJ-API ERROR: tapisIO.gatherRepertoireMetadataForProject, cannot collect data_processing: '
                                          + rep['data_processing'][j]['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                        }
                        if (!keep_uuids) delete dp['value']['vdjserver'];
                        dps.push(dp);
                    }
                }
                if (dps.length == 0) {
                    rep['data_processing'] = [ dpschema.template() ];
                } else rep['data_processing'] = dps;
            }

            return repertoireMetadata;
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
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'start, project: ' + projectUuid + ' by user: ' + username);

    // gather the repertoire objects
//    var repertoireMetadata = await tapisIO.gatherRepertoireMetadataForProject(projectUuid, true)
    var repertoireMetadata = await ProjectController.gatherRepertoireMetadataForProject(username, projectUuid, true)
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.gatherRepertoireMetadataForProject, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    config.log.info(context, 'gathered ' + repertoireMetadata.length + ' repertoire metadata for project: ' + projectUuid);

    // gather the repertoire group objects
    var groupMetadata = await tapisIO.queryMetadataForProject(projectUuid, 'repertoire_group')
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.queryMetadataForProject, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
    if (groupMetadata.length == 0) groupMetadata = null;
    var groups = null;
    if (groupMetadata) {
        groups = [];
        for (let i in groupMetadata) {
            let obj = groupMetadata[i]['value'];
            if (!obj['repertoire_group_id']) obj['repertoire_group_id'] = groupMetadata[i]['uuid'];
            groups.push(obj);
        }
    }

    if (groups) config.log.info(context, 'gathered ' + groups.length + ' repertoire groups for project: ' + projectUuid);

    // save in file
    var data = {};
    data['Info'] = airr.get_info();
    data['Repertoire'] = repertoireMetadata;
    if (groups) data['RepertoireGroup'] = groups;
    var buffer = Buffer.from(JSON.stringify(data, null, 2));
    await tapisIO.uploadFileToProjectTempDirectory(projectUuid, 'repertoires.airr.json', buffer)
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.uploadFileToProjectTempDirectory, error: ' + error);
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

ProjectController.importTable = async function(request, response) {
    var context = 'ProjectController.importTable';
    var projectUuid = request.params.project_uuid;
    var username = request['user']['username'];
    var tableName = request.params.table_name;
    var filename = request.body.filename;
    var op = request.body.operation;
    var msg = null;

    config.log.info(context, 'start, project: ' + projectUuid + ' file: ' + filename + ' table: ' + tableName + ' operation: ' + op);

    // TODO: check size of file, error if too big

    // get metadata to import
    var fileData = await tapisIO.getProjectFileContents(projectUuid, filename)
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.getProjectFileContents, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    fileData = fileData.trim();
    var data = d3.tsvParse(fileData);
    config.log.info(context, 'import file has ' + data.length + ' rows.');
    //console.log(data);

    if (data.length > 1000) {
        msg = config.log.error(context, 'Data file exceeds 1000 records! Use force parameter or import smaller files.');
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 400, response);
    }

    // used to determine if an array entry flattened as columns has any data
    var checkFlatArray = function(name, row, idx, cols) {
        let hasData = false;
        for (let i in cols) {
            let col_name = name + '.' + idx + '.' + cols[i];
            if (row[col_name] == null) continue;
            if (row[col_name] == '') continue;
            hasData = true;
            break;
        }
        return hasData;
    }

    var validation_errors = [];
    var ontology_errors = [];
    var curie_cache = {};

    // convert to object form
    if (tableName == 'subject') {
        // determine max number of diagnosis entries from column names
        let max_diagnosis = 0;
        for (let i = 0; i < data.columns.length; ++i) {
            let fields = data.columns[i].split('.');
            if (fields.length < 3) continue;
            if (fields[0] != 'diagnosis') continue;
            let idx = parseInt(fields[1]);
            if (idx > max_diagnosis) max_diagnosis = idx;
        }
        config.log.info(context, 'max_diagnosis: ' + max_diagnosis);

        // TODO: no support for custom fields beyond the schema

        var manualTranslation = function(field, value) {
            if (value == '') return value;
            if (value == null) return null;
            if (value == undefined) return null;
            switch (field) {
                case 'species':
                    switch (value.toLowerCase()) {
                        case 'human':
                        case 'h':
                        case 'homo':
                        case 'homo sapiens':
                            return 'NCBITAXON:9606';
                        case 'mouse':
                        case 'm':
                        case 'mice':
                        case 'mus':
                        case 'mus musculus':
                            return 'NCBITAXON:10088';
                        case 'monkey':
                        case 'macaque':
                        case 'macaca mulatta':
                            return 'NCBITAXON:9544';
                        default:
                            return value;
                    }
                case 'age_unit':
                    switch(value.toLowerCase()) {
                        case 'h':
                        case 'hr':
                        case 'hrs':
                        case 'hour':
                        case 'hours':
                            return 'UO:0000032';
                        case 'd':
                        case 'day':
                        case 'days':
                        case 'dy':
                            return 'UO:0000033';
                        case 'w':
                        case 'week':
                        case 'weeks':
                        case 'wk':
                            return 'UO:0000034';
                        case 'm':
                        case 'mth':
                        case 'mths':
                        case 'mnth':
                        case 'month':
                        case 'months':
                            return 'UO:0000035';
                        case 'y':
                        case 'yr':
                        case 'yrs':
                        case 'year':
                        case 'years':
                            return 'UO:0000036';
                        default:
                            return value;
                    }
                case 'sex':
                    switch(value.toLowerCase()) {
                        case 'm':
                            return 'male';
                        case 'f':
                            return 'female';
                        default:
                            return value.toLowerCase();
                    }
            }
            return value;
        }

        // simple fields
        let subject_columns = [];
        let airr_schema = new airr.SchemaDefinition('Subject');
        let schema = new vdj_schema.SchemaDefinition('Subject');
        for (let i in schema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            if (data.columns.indexOf(i) < 0) continue;
            subject_columns.push(i);
        }
        let diagnosis_columns = [];
        let diagnosisSchema = new airr.SchemaDefinition('Diagnosis');
        for (let i in diagnosisSchema.properties) {
            if (diagnosisSchema.type(i) == 'array') continue;
            if ((diagnosisSchema.type(i) == 'object') && (! diagnosisSchema.is_ontology(i))) continue;
            let col_name = 'diagnosis.0.' + i;
            if (data.columns.indexOf(col_name) < 0) continue;
            diagnosis_columns.push(i);
        }

        let new_subjects;
        if (op == 'replace') {
            // delete and replace
            new_subjects = [];
            for (let i = 0; i < data.length; ++i) {
                let dataRow = data[i];
                let subject = schema.template();
                // TODO: currently do not support genotype
                subject['genotype'] = null;
                //console.log(JSON.stringify(subject));
                new_subjects.push(subject);

                // assign subject values
                for (let j in subject_columns) {
                    let data_value = manualTranslation(subject_columns[j], dataRow[subject_columns[j]]);
                    if (schema.is_ontology(subject_columns[j])) {
                        if (data_value != '') {
                            if (curie_cache[data_value]) subject[subject_columns[j]] = curie_cache[data_value];
                            else {
                                let term_url = airr_schema.resolve_curie(subject_columns[j], data_value);
                                if (!term_url) ontology_errors.push({ message: 'row ' + i + ', subject ontology field ' + subject_columns[j] + ', could not be resolved.'});
                                else {
                                    let requestSettings = {
                                        url: term_url,
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json'
                                        }
                                    };
                                    let term = await tapisIO.sendRequest(requestSettings)
                                        .catch(function(error) {
                                            config.log.error(context, 'row ' + i + ', subject ontology field ' + subject_columns[j] + ', could not be resolved. Error: ' + error);
                                            ontology_errors.push({ message: 'row ' + i + ', subject ontology field ' + subject_columns[j] + ', could not be resolved. Error: ' + error});
                                        });
                                    if (term && term['_embedded'] && term['_embedded']['terms'] && term['_embedded']['terms'][0] && term['_embedded']['terms'][0]['label']) {
                                        subject[subject_columns[j]] = { id: data_value, label: term['_embedded']['terms'][0]['label'] };
                                        curie_cache[data_value] = subject[subject_columns[j]];
                                    }
                                }
                            }
                        }
                    } else
                        subject[subject_columns[j]] = schema.map_value({header: subject_columns[j], value: data_value});
                }
                //console.log(JSON.stringify(subject));

                // at least 1 diagnosis, add more if data
                for (let idx = 0; idx <= max_diagnosis; ++idx) {
                    let hasData = checkFlatArray('diagnosis', dataRow, idx, diagnosis_columns);
                    if (!hasData) continue;
                    let diag = subject['diagnosis'][0];
                    if (idx != 0) {
                        diag = diagnosisSchema.template();
                        subject['diagnosis'].push(diag);
                    }
                    for (let j in diagnosis_columns) {
                        let col_name = 'diagnosis.' + idx + '.' + diagnosis_columns[j];
                        if (diagnosisSchema.is_ontology(diagnosis_columns[j])) {
                            if (dataRow[col_name] != '') {
                                if (curie_cache[dataRow[col_name]]) diag[diagnosis_columns[j]] = curie_cache[dataRow[col_name]];
                                else {
                                    let term_url = diagnosisSchema.resolve_curie(diagnosis_columns[j], dataRow[col_name]);
                                    if (!term_url) ontology_errors.push({ message: 'row ' + i + ', diagnosis ontology field ' + diagnosis_columns[j] + ', could not be resolved.'});
                                    else {
                                        let requestSettings = {
                                            url: term_url,
                                            method: 'GET',
                                            headers: {
                                                'Accept': 'application/json'
                                            }
                                        };
                                        let term = await tapisIO.sendRequest(requestSettings)
                                            .catch(function(error) {
                                                config.log.error(context, 'row ' + i + ', diagnosis ontology field ' + diagnosis_columns[j] + ', could not be resolved. Error: ' + error);
                                                ontology_errors.push({ message: 'row ' + i + ', diagnosis ontology field ' + diagnosis_columns[j] + ', could not be resolved. Error: ' + error});
                                            });
                                        if (term && term['_embedded'] && term['_embedded']['terms'] && term['_embedded']['terms'][0] && term['_embedded']['terms'][0]['label']) {
                                            diag[diagnosis_columns[j]] = { id: dataRow[col_name], label: term['_embedded']['terms'][0]['label'] };
                                            curie_cache[dataRow[col_name]] = diag[diagnosis_columns[j]];
                                        }
                                    }
                                }
                            }
                        } else
                            diag[diagnosis_columns[j]] = diagnosisSchema.map_value({header: diagnosis_columns[j], value: dataRow[col_name]});
                    }
                }
                //console.log(JSON.stringify(subject));
            }

            // validate
            for (let i in new_subjects) {
                let error = schema.validate_object(new_subjects[i]);
                if (error) validation_errors.push({ message: 'row ' + i + ', validation error', validation_error: error });
            }

            // TODO: we are missing VDJServer specific validation

            // abort if any errors
            if (ontology_errors.length > 0) validation_errors.concat(ontology_errors);
            if (validation_errors.length > 0) {
                config.log.error(context, 'import table has validation errors.');
                return apiResponseController.sendError(validation_errors, 400, response);
            }

            if (new_subjects.length == 0) {
                msg = config.log.error(context, 'import table has no entries.');
                return apiResponseController.sendError(msg, 400, response);
            }

            // no errors so delete existing metadata
            config.log.info(context, 'delete existing subject entries.');
            var resp = await tapisIO.deleteAllProjectMetadataForName(projectUuid, tableName)
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.deleteAllProjectMetadataForName, error: ' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }
            config.log.info(context, 'deleted ' + resp + ' subject entries.');

            // insert the subjects
            for (let i in new_subjects) {
                await tapisIO.createMetadataForProject(projectUuid, tableName, { value: new_subjects[i] })
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.createMetadataForProject, error: ' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return apiResponseController.sendError(msg, 500, response);
                }
            }
            config.log.info(context, 'inserted ' + new_subjects.length + ' subject entries');

            // TODO: would be nice to re-assign the subjects in the repertoires

        } else {
            // merge/append
            new_subjects = await tapisIO.queryMetadataForProject(projectUuid, tableName)
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.queryMetadataForProject, error: ' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }

            return apiResponseController.sendError('merge/append not implemented.', 500, response);
        }
        //console.log(JSON.stringify(new_subjects, null, 2));

    } else if (tableName == 'sample_processing') {
        // get the project metadata
        let projectMetadata = await tapisIO.getProjectMetadata(username, projectUuid)
            .catch(function(error) {
                msg = config.log.error(context, 'tapisIO.getProjectMetadata, error: ' + error);
            });
        if (msg) {
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        // get current subjects
        let subjectMetadata = await tapisIO.queryMetadataForProject(projectUuid, 'subject')
            .catch(function(error) {
                msg = config.log.error(context, 'tapisIO.queryMetadataForProject, error: ' + error);
            });
        if (msg) {
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }
        let current_subjects = {};
        for (let i in subjectMetadata) {
            current_subjects[subjectMetadata[i]['value']['subject_id']] = subjectMetadata[i];
        }

        // determine max number of pcr target entries from column names
        let max_pcr = 0;
        for (let i = 0; i < data.columns.length; ++i) {
            let fields = data.columns[i].split('.');
            if (fields.length < 3) continue;
            if (fields[0] != 'pcr_target') continue;
            let idx = parseInt(fields[1]);
            if (idx > max_pcr) max_pcr = idx;
        }
        config.log.info(context, 'max_pcr: ' + max_pcr);

        // TODO: no support for custom fields beyond the schema

        // simple fields
        let sample_columns = [];
        let airr_schema = new airr.SchemaDefinition('SampleProcessing');
        let schema = new vdj_schema.SchemaDefinition('SampleProcessing');
        for (let i in schema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            if (data.columns.indexOf(i) < 0) continue;
            sample_columns.push(i);
        }
        let pcr_columns = [];
        let pcrSchema = new airr.SchemaDefinition('PCRTarget');
        for (let i in pcrSchema.properties) {
            if (pcrSchema.type(i) == 'array') continue;
            if ((pcrSchema.type(i) == 'object') && (! pcrSchema.is_ontology(i))) continue;
            let col_name = 'pcr_target.0.' + i;
            if (data.columns.indexOf(col_name) < 0) continue;
            pcr_columns.push(i);
        }
        var sd_columns = [];
        var sdSchema = new airr.SchemaDefinition('SequencingData');
        for (let i in sdSchema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            let col_name = 'sequencing_files.' + i;
            if (data.columns.indexOf(col_name) < 0) continue;
            sd_columns.push(i);
        }

        // standard import is one repertoire per sample processing row
        // multiple samples per repertoire should be multiple rows with same repertoire_id

        let airr_rep_schema = new airr.SchemaDefinition('Repertoire');
        let rep_schema = new vdj_schema.SchemaDefinition('Repertoire');

        let match_repertoires = {};
        let new_repertoires = [];
        let new_samples = [];
        if (op == 'replace') {
            // delete and replace
            for (let i = 0; i < data.length; ++i) {
                let dataRow = data[i];

                // repertoire entry
                let rep = null;
                if (dataRow['repertoire_id'] && dataRow['repertoire_id'] != '') {
                    rep = match_repertoires[dataRow['repertoire_id']];
                    if (!rep) {
                        rep = rep_schema.template();
                        rep['sample'] = [];
                        match_repertoires[dataRow['repertoire_id']] = rep;
                        new_repertoires.push(rep);
                    }
                } else {
                    rep = rep_schema.template();
                    rep['sample'] = [];
                    new_repertoires.push(rep);
                }
                rep['study']['vdjserver_uuid'] = projectUuid;

                // assign subject
                if (dataRow['subject_id'] && dataRow['subject_id'] != '') {
                    let s = current_subjects[dataRow['subject_id']];
                    if (!s) validation_errors.push({ message: 'row ' + i + ', cannot find existing subject with subject_id: ' + dataRow['subject_id'] });
                    else rep['subject']['vdjserver_uuid'] = s['uuid'];
                } else validation_errors.push({ message: 'row ' + i + ', missing subject_id' });

                let sample = schema.template();
                new_samples.push(sample);
                rep['sample'].push(i);

                // assign sample values
                for (let j in sample_columns) {
                    let data_value = dataRow[sample_columns[j]];
                    if (schema.is_ontology(sample_columns[j])) {
                        if (data_value != '') {
                            if (curie_cache[data_value]) sample[sample_columns[j]] = curie_cache[data_value];
                            else {
                                let term_url = airr_schema.resolve_curie(sample_columns[j], data_value);
                                if (!term_url) ontology_errors.push({ message: 'row ' + i + ', sample ontology field ' + sample_columns[j] + ', could not be resolved.'});
                                else {
                                    let requestSettings = {
                                        url: term_url,
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json'
                                        }
                                    };
                                    let term = await tapisIO.sendRequest(requestSettings)
                                        .catch(function(error) {
                                            config.log.error(context, 'row ' + i + ', sample ontology field ' + sample_columns[j] + ', could not be resolved. Error: ' + error);
                                            ontology_errors.push({ message: 'row ' + i + ', sample ontology field ' + sample_columns[j] + ', could not be resolved. Error: ' + error});
                                        });
                                    if (term && term['_embedded'] && term['_embedded']['terms'] && term['_embedded']['terms'][0] && term['_embedded']['terms'][0]['label']) {
                                        sample[sample_columns[j]] = { id: data_value, label: term['_embedded']['terms'][0]['label'] };
                                        curie_cache[data_value] = sample[sample_columns[j]];
                                    }
                                }
                            }
                        }
                    } else
                        sample[sample_columns[j]] = schema.map_value({header: sample_columns[j], value: data_value});
                }
                //console.log(JSON.stringify(sample));

                // assign sequencing files values, no ontology fields
                for (let j in sd_columns) {
                    let col_name = 'sequencing_files.' + sd_columns[j];
                    sample['sequencing_files'][sd_columns[j]] = sdSchema.map_value({header: sd_columns[j], value: dataRow[col_name]});
                }

                // at least 1 pcr target, add more if data, no ontology fields
                for (let idx = 0; idx <= max_pcr; ++idx) {
                    let hasData = checkFlatArray('pcr_target', dataRow, idx, pcr_columns);
                    if (!hasData) continue;
                    let pcr = sample['pcr_target'][0];
                    if (idx != 0) {
                        pcr = pcrSchema.template();
                        sample['pcr_target'].push(pcr);
                    }
                    for (let j in pcr_columns) {
                        let col_name = 'pcr_target.' + idx + '.' + pcr_columns[j];
                        pcr[pcr_columns[j]] = pcrSchema.map_value({header: pcr_columns[j], value: dataRow[col_name]});
                    }
                }
                //console.log(JSON.stringify(sample));
            }

            // validate
            for (let i in new_samples) {
                let error = schema.validate_object(new_samples[i]);
                if (error) validation_errors.push({ message: 'row ' + i + ', validation error', validation_error: error });
            }

            // TODO: we are missing VDJServer specific validation

            // abort if any errors
            if (ontology_errors.length > 0) validation_errors.concat(ontology_errors);
            if (validation_errors.length > 0) {
                config.log.error(context, 'import table has validation errors.');
                return apiResponseController.sendError(validation_errors, 400, response);
            }

            if (new_samples.length == 0) {
                msg = config.log.error(context, 'import table has no entries.');
                return apiResponseController.sendError(msg, 400, response);
            }

            // no errors so delete existing sample and repertoire metadata
            config.log.info(context, 'delete existing sample entries.');
            var resp = await tapisIO.deleteAllProjectMetadataForName(projectUuid, tableName)
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.deleteAllProjectMetadataForName, error: ' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }
            config.log.info(context, 'deleted ' + resp + ' sample entries.');

            config.log.info(context, 'delete existing repertoire entries.');
            var resp = await tapisIO.deleteAllProjectMetadataForName(projectUuid, 'repertoire')
                .catch(function(error) {
                    msg = config.log.error(context, 'tapisIO.deleteAllProjectMetadataForName, error: ' + error);
                });
            if (msg) {
                webhookIO.postToSlack(msg);
                return apiResponseController.sendError(msg, 500, response);
            }
            config.log.info(context, 'deleted ' + resp + ' repertoire entries.');

            // insert the samples
            let created_samples = [];
            for (let i in new_samples) {
                let cs = await tapisIO.createMetadataForProject(projectUuid, tableName, { value: new_samples[i] })
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.createMetadataForProject, error: ' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return apiResponseController.sendError(msg, 500, response);
                }
                created_samples.push(cs);
            }
            config.log.info(context, 'inserted ' + new_samples.length + ' sample entries');

            // assign sample uuids to repertoires, we rely upon the index number
            for (let i in new_repertoires) {
                let s = [];
                for (let j in new_repertoires[i]['sample']) {
                    s.push({ vdjserver_uuid: created_samples[new_repertoires[i]['sample'][j]].uuid });
                }
                new_repertoires[i]['sample'] = s;
            }
            //console.log(JSON.stringify(new_repertoires, null, 2));

            // insert the repertoires
            for (let i in new_repertoires) {
                let cs = await tapisIO.createMetadataForProject(projectUuid, 'repertoire', { value: new_repertoires[i] })
                    .catch(function(error) {
                        msg = config.log.error(context, 'tapisIO.createMetadataForProject, error: ' + error);
                    });
                if (msg) {
                    webhookIO.postToSlack(msg);
                    return apiResponseController.sendError(msg, 500, response);
                }
            }
            config.log.info(context, 'inserted ' + new_repertoires.length + ' repertoire entries');

        } else {
            // merge/append
            return apiResponseController.sendError('merge/append not implemented.', 500, response);
        }
    }

    config.log.info(context, 'Successfully imported table');
    apiResponseController.sendSuccess('Successfully imported table', response);
};

ProjectController.exportTable = async function(request, response) {
    var context = 'ProjectController.exportTable';
    var projectUuid = request.params.project_uuid;
    var tableName = request.params.table_name;
    var username = request['user']['username'];
    var msg = null;

    config.log.info(context, 'start, project: ' + projectUuid + ' table: ' + tableName + ' by user: ' + username);

    var metadataList = await tapisIO.queryMetadataForProject(projectUuid, tableName)
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.queryMetadataForProject, error: ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    var tsvData = '';
    if (tableName == 'subject') {
        // determine columns to be exported from the schema
        var columns = [ 'vdjserver_uuid' ];

        var schema = new vdj_schema.SchemaDefinition('Subject');
        var subject_columns = [ 'vdjserver_uuid' ];
        for (let i in schema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            columns.push(i);
            subject_columns.push(i);
        }

        var diagnosisSchema = new airr.SchemaDefinition('Diagnosis');
        var diagnosis_columns = [ ];
        for (let i in diagnosisSchema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            diagnosis_columns.push(i);
        }

        // determine max diagnosis entries
        let max_diag = 1;
        for (let i = 0; i < metadataList.length; ++i) {
            let value = metadataList[i].value;
            if (value['diagnosis'] && value['diagnosis'].length > max_diag)
                max_diag = value['diagnosis'].length;
        }
        for (let j = 0; j < max_diag; ++j) {
            for (let i in diagnosis_columns) columns.push('diagnosis.' + j + '.' + diagnosis_columns[i]);
        }

        // header
        tsvData = columns.join('\t') + '\n';

        // convert to TSV format
        for (var i = 0; i < metadataList.length; ++i) {
            var value = metadataList[i].value;
            console.log("INSIDE SUBJECT EXPORT");
            //console.log(value);
            // subject values
            var first = true;
            for (var j=0; j<subject_columns.length; j++) {
                var prop = columns[j];
                if (!first) tsvData += '\t';
                if (prop == 'vdjserver_uuid') { 
                    tsvData += metadataList[i]['uuid'];
                } else if (prop in value) {
                    if (schema.is_ontology(prop)) {
                        if (value[prop]['id'] != null) {
                            tsvData += value[prop]['id'];
                        }
                    } else if (value[prop] != null) {
                        tsvData += value[prop];
                    }
                }
                first = false;
            } //end for

            // diagnosis values
            for (let z = 0; z < max_diag; ++z) {
                //var diagnosis_name = 'diagnosis.' + z + '.' + diagnosis_columns[k];
                if (z >= metadataList[i]['value']['diagnosis'].length) {
                    // fill out
                    for (let k=0; k<diagnosis_columns.length; k++) tsvData += '\t';
                } else {
                    let diag = metadataList[i]['value']['diagnosis'][z];
                    for (var k=0; k<diagnosis_columns.length; k++) {
                        var prop = diagnosis_columns[k];

                        tsvData += '\t';
                        if (prop in diag) {
                            if (diagnosisSchema.is_ontology(prop)) {
                                if (diag[prop]['id'] != null) {
                                    tsvData += diag[prop]['id'];
                                }
                            } else if (diag[prop] != null) {
                                tsvData += diag[prop];
                            }
                        }
                    }
                }
            }
            tsvData += '\n';
        }
    } else if (tableName == 'sample_processing') {
        // sample table is a simplified version of the repertoires
        // with sample actually being the sample processing record

        // gather the repertoire objects
        var repertoireMetadata = await ProjectController.gatherRepertoireMetadataForProject(username, projectUuid, true)
            .catch(function(error) {
                msg = config.log.error(context, 'tapisIO.gatherRepertoireMetadataForProject, error: ' + error);
            });
        if (msg) {
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        config.log.info(context, 'gathered ' + repertoireMetadata.length + ' repertoire metadata for project: ' + projectUuid);

        // determine columns to be exported from the schema
        var columns = [ 'repertoire_id', 'subject_id' ];

        var schema = new vdj_schema.SchemaDefinition('SampleProcessing');
        var sample_columns = [];
        for (let i in schema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            columns.push(i);
            sample_columns.push(i);
        }

        // we handle the pcr target and sequencing data files specially
        var pcrSchema = new airr.SchemaDefinition('PCRTarget');
        var pcr_columns = [];
        for (let i in pcrSchema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            pcr_columns.push(i);
        }

        // determine max pcr target entries
        let max_pcr = 1;
        for (let i = 0; i < repertoireMetadata.length; ++i) {
            let rep = repertoireMetadata[i];
            for (let j = 0; j < rep['sample'].length; ++j) {
                if (rep['sample'][j]['pcr_target'].length > max_pcr)
                    max_pcr = rep['sample'][j]['pcr_target'].length;
            }
        }
        
        for (let j = 0; j < max_pcr; ++j) {
            for (let i in pcr_columns) columns.push('pcr_target.' + j + '.' + pcr_columns[i]);
        }

        var sdSchema = new airr.SchemaDefinition('SequencingData');
        var sd_columns = [];
        for (let i in sdSchema.properties) {
            if (schema.type(i) == 'array') continue;
            if ((schema.type(i) == 'object') && (! schema.is_ontology(i))) continue;
            columns.push('sequencing_files.' + i);
            sd_columns.push(i);
        }

        // console.log(sample_columns);
        // console.log(pcr_columns);
        // console.log(sd_columns);


        // header
        tsvData = columns.join('\t') + '\n';

        // loop through repertoires
        for (var i = 0; i < repertoireMetadata.length; ++i){
            var p = 0;
            var value = repertoireMetadata[i];

            

            // for each sample
            for (let k = 0; k < value['sample'].length; k++){
                //initialize for each sample
                tsvData += value['repertoire_id'];
                tsvData += '\t';
                tsvData += value['subject']['subject_id'];

                var sampleData = value['sample'][k];

                //sample values
                for (var j=0; j<sample_columns.length; j++){
                    var prop = sample_columns[j];

                    tsvData += '\t';
                    if (schema.is_ontology(prop)){
                        //console.log(prop, sampleData[prop]);
                        if (sampleData[prop] && sampleData[prop]['id'] != null){
                            tsvData += sampleData[prop]['id'];
                        }
                    }else if(sampleData[prop] != null){
                        tsvData += sampleData[prop];
                    }
                }

                // iterate through pcr_target(s)
                for (var j = 0; j < max_pcr; ++j) {
                    if (j >= sampleData['pcr_target'].length){
                        // fill out empty columns
                        for (let l=0; l < pcr_columns.length; l++) tsvData += '\t';
                    }else{
                        var pcrTarget = sampleData['pcr_target'][j];
                        for (let k = 0; k < pcr_columns.length; ++k) {
                            let prop = pcr_columns[k];
                            tsvData += '\t';
                            if (pcrSchema.is_ontology(prop)){
                                if(pcrTarget[prop] && pcrTarget[prop]['id'] != null){
                                    tsvData += pcrTarget[prop]['id'];
                                }
                            }else if(pcrTarget[prop] != null){
                                tsvData += pcrTarget[prop];
                            }
                        }
                    }
                }

                // sequencing data values
                for (let j = 0; j < sd_columns.length; ++j) {
                    let prop = sd_columns[j];

                    let seqData = sampleData['sequencing_files'];
                    tsvData += '\t';
                    if (sdSchema.is_ontology(prop)){
                        if (seqData[prop] && seqData[prop]['id'] != null){
                            tsvData += seqData[prop]['id'];
                        }
                    }else if (seqData[prop] != null){
                        tsvData += seqData[prop];
                    }
                }

                // each sample in the repertoire is on its own row
                // this avoids explosion of columns with sample indexing, e.g. sample.0.sample_id
                tsvData += '\n';
            }
        }

        //console.log("PRINTING TSV DATA")
        //console.log(tsvData);

    }

    var buffer = Buffer.from(tsvData);
    await tapisIO.uploadFileToProjectTempDirectory(projectUuid, tableName + '_metadata.tsv', buffer)
        .catch(function(error) {
            msg = config.log.error(context, 'tapisIO.uploadFileToProjectTempDirectory, error: ' + error);
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
            return tapisIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectMetadata) {
            // Verify it is a public project
            if (projectMetadata.name == 'publicProject') {
                return tapisIO.getMetadata(fileUuid);
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
                return tapisIO.createCommunityFilePostit(projectUuid, 'files/' + fileMetadata.value.name);
            } else if (fileMetadata.name == 'projectJobFile') {
                // if project job file
                return tapisIO.createCommunityFilePostit(projectUuid, 'analyses/' + fileMetadata.value.relativeArchivePath + '/' + fileMetadata.value.name);
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
