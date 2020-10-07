
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

// Settings
var agaveSettings = require('../config/agaveSettings');
var mongoSettings = require('../config/mongoSettings');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');

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

ProjectController.loadProject = function(request, response) {
    var projectUuid = request.params.project_uuid;
    var msg;

    // check for project load metadata
    agaveIO.getProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
        .then(function(loadMetadata) {
            if (loadMetadata && loadMetadata[0]) {
                // TODO: check to re-load after being unloaded?
                var msg = 'VDJ-API ERROR: ProjectController.loadProject, project: ' + projectUuid + ', error: project already flagged for repository load'
                    + ', metadata: ' + loadMetadata[0].uuid;
                console.error(msg);
	        webhookIO.postToSlack(msg);            
                apiResponseController.sendError(msg, 400, response);
                return null;
            } else {
                // create the project load metadata
                return agaveIO.createProjectLoadMetadata(projectUuid, mongoSettings.loadCollection)
                    .then(function(loadMetadata) {
                        // trigger load queue if necessary
                        var msg = 'VDJ-API INFO: ProjectController.loadProject, project: ' + projectUuid + ' flagged for repository load'
                            + ', metadata: ' + loadMetadata.uuid;
                        console.log(msg);

	                taskQueue
		            .create('checkProjectsToLoadTask', null)
		            .removeOnComplete(true)
		            .attempts(5)
		            .backoff({delay: 60 * 1000, type: 'fixed'})
		            .save();

                        apiResponseController.sendSuccess(msg, response);
                    });
            }
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: ProjectController.loadProject, project: ' + projectUuid + ', error: ' + error;
            console.error(msg);
	    webhookIO.postToSlack(msg);            
            apiResponseController.sendError(msg, 500, response);
        });
};

//
// Unload project data from VDJServer ADC data repository

ProjectController.unloadProject = function(request, response) {
    var projectUuid = request.params.project_uuid;

    var msg = "VDJ-API ERROR: Not implemented.";
    apiResponseController.sendError(msg, 500, response);
};

//
// Import/export metadata
//

//
// Importing is complicated as we need to normalize the objects in the AIRR metadata file
//
ProjectController.importMetadata = function(request, response) {
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
                        msg = 'Repertoires have assigned repertoire_ids, they must be null when appending';
                        data = null;
                        return;
                    }
                }
            }

            // check that repertoire ids are valid for replace
            if (operation == 'replace') {
                for (var r in repList) {
                    if (repList[r]['repertoire_id']) {
                        if (! existingRepertoires[repList[r]['repertoire_id']]) {
                            msg = 'Repertoire has invalid repertoire_id: ' + repList[r]['repertoire_id'];
                            data = null;
                            return;
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
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'sample');
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
                return agaveIO.createMetadataForTypeWithPermissions(projectUuid, 'sample', entry['sample'])
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
ProjectController.exportMetadata = function(request, response) {
    var projectUuid = request.params.project_uuid;

    console.log('VDJ-API INFO: ProjectController.exportMetadata - start, project:', projectUuid);

    // gather the repertoire objects
    return agaveIO.gatherRepertoireMetadataForProject(projectUuid, true)
        .then(function(repertoireMetadata) {
	    console.log('VDJ-API INFO: ProjectController.exportMetadata, gathered ' + repertoireMetadata.length
                        + ' repertoire metadata for project: ' + projectUuid);

            // Not the normal response format
            var apiResponse = {};
            apiResponse['Repertoire'] = repertoireMetadata;
            response.status(200).json(apiResponse);
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: ProjectController.exportMetadata - error - project: ' + projectUuid + ', error: ' + error;
            console.error(msg);
	    webhookIO.postToSlack(msg);            
            apiResponseController.sendError(msg, 500, response);
        });
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
