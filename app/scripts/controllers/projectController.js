
'use strict';

// App
var app = require('../app');

// Settings
var agaveSettings = require('../config/agaveSettings');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Q = require('q');
var d3 = require('d3');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var ProjectController = {};
module.exports = ProjectController;

// Creates a project and all initial directories
ProjectController.createProject = function(request, response) {

    var projectName = request.body.projectName;
    var username    = request.body.username;

    if (!projectName) {
        console.error('VDJ-API ERROR: ProjectController.createProject - error - missing projectName parameter');
        apiResponseController.sendError('Project name required.', 400, response);
        return;
    }

    if (!username) {
        console.error('VDJ-API ERROR: ProjectController.createProject - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (username != request.user.username) {
        console.error('VDJ-API ERROR: ProjectController.createProject - error - cannot create project for different user');
        apiResponseController.sendError('Cannot create project for another user.', 400, response);
        return;
    }

    var projectMetadata;
    var uuid;

    console.log('VDJ-API INFO: ProjectController.createProject - event - begin for username: ' + username + ', project name: ' + projectName);

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.createProjectMetadata(projectName);
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
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.createProject - error - username ' + username + ', project name ' + projectName + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

//
// Import/export metadata
//

ProjectController.importMetadata = function(request, response) {
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
};

ProjectController.exportMetadata = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var format = request.query.format;
    var type = request.query.type;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.exportMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    if (!type) {
        console.error('VDJ-API ERROR: ProjectController.exportMetadata - missing metadata type parameter');
        apiResponseController.sendError('Metadata type required.', 400, response);
        return;
    }

    if (agaveSettings.metadataTypes.indexOf(type) < 0) {
        console.error('VDJ-API ERROR: ProjectController.exportMetadata - invalid metadata type parameter');
        apiResponseController.sendError('Invalid metadata type.', 400, response);
        return;
    }

    if (!format) format = 'TSV';

    ServiceAccount.getToken()
        .then(function(token) {
            console.log('VDJ-API INFO: ProjectController.exportMetadata - start project: ' + projectUuid + ' type: ' + type);
	    return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, type);
        })
	.then(function(metadataList) {
	    //console.log(subjectMetadata);
	    var tsvData = '';

	    // default
	    if (metadataList.length == 0) {
		tsvData = agaveSettings.defaultColumns[type].join('\t') + '\n';
	    }

	    // convert to TSV format
	    for (var i = 0; i < metadataList.length; ++i) {
		var value = metadataList[i].value;

		// header
		if (i == 0) {
		    var first = true;
		    for (var j = 0; j < agaveSettings.defaultColumns[type].length; ++j) {
			var prop = agaveSettings.defaultColumns[type][j];
			if (!first) tsvData += '\t';
			tsvData += prop;
			first = false;
		    }
		    for (var prop in value) {
			if (agaveSettings.defaultColumns[type].indexOf(prop) >= 0) continue;
			if (!first) tsvData += '\t';
			tsvData += prop;
			first = false;
		    }
		    tsvData += '\n';
		}

		// values
		var first = true;
		for (var j = 0; j < agaveSettings.defaultColumns[type].length; ++j) {
		    var prop = agaveSettings.defaultColumns[type][j];
		    if (!first) tsvData += '\t';
		    if (prop in value) tsvData += value[prop];
		    first = false;		    
		}
		for (var prop in value) {
		    if (agaveSettings.defaultColumns[type].indexOf(prop) >= 0) continue;
		    if (!first) tsvData += '\t';
		    tsvData += value[prop];
		    first = false;
		}
		tsvData += '\n';
	    }

	    var buffer = new Buffer(tsvData);
	    return agaveIO.uploadFileToProjectTempDirectory(projectUuid, type + '_metadata.tsv', buffer);
	})
        .then(function() {
	    return agaveIO.setFilePermissionsForProjectUsers(projectUuid, projectUuid + '/deleted/' + type + '_metadata.tsv', false);
        })
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.exportMetadata - done project ', projectUuid);
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.exportMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

// Publish project to community data

ProjectController.publishProject = function(request, response) {
    var projectUuid = request.params.projectUuid;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.publishProject - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

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
	    if (projectMetadata.name == 'project') {
		projectMetadata.name = 'projectPublishInProcess';
		//console.log(projectMetadata);
		return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
	    } else if (projectMetadata.name == 'projectPublishInProcess') {
		console.log('VDJ-API INFO: ProjectController.publishProject - project ' + projectUuid + ' - restarting publish.');
		return null;
	    } else {
		msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' is not in a publishable state.';
		return Q.reject(new Error(msg));
	    }
	})
        .then(function(responseObject) {
            console.log('VDJ-API INFO: ProjectController.publishProject - project ' + projectUuid + ' publishing in process.');
	    //console.log(responseObject);

	    taskQueue
		.create('publishProjectMoveFilesTask', projectUuid)
		.removeOnComplete(true)
		.attempts(5)
		.backoff({delay: 60 * 1000, type: 'fixed'})
		.save()
            ;

	    return apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
	    if (!msg) msg = 'VDJ-API ERROR: ProjectController.publishProject - project ' + projectUuid + ' error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
	    return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

// Unpublish project from community data

ProjectController.unpublishProject = function(request, response) {
    var projectUuid = request.params.projectUuid;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.unpublishProject - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

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
	    if (projectMetadata.name == 'publicProject') {
		projectMetadata.name = 'projectUnpublishInProcess';
		return agaveIO.updateMetadata(projectMetadata.uuid, projectMetadata.name, projectMetadata.value, null);
	    } else {
		msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' is not in an unpublishable state.';
		return Q.reject(new Error(msg));
	    }
	})
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.unpublishProject - project ' + projectUuid + ' unpublishing in process.');

	    taskQueue
		.create('unpublishProjectMoveFilesTask', projectUuid)
		.removeOnComplete(true)
		.attempts(5)
		.backoff({delay: 60 * 1000, type: 'fixed'})
		.save()
            ;

	    return apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
	    if (!msg) msg = 'VDJ-API ERROR: ProjectController.unpublishProject - project ' + projectUuid + ' error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
	    return apiResponseController.sendError(msg, 500, response);
        })
        ;
};

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
        .fail(function(error) {
	    if (!msg) msg = 'VDJ-API ERROR: ProjectController.createPublicPostit - project ' + projectUuid + ' error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
	    return apiResponseController.sendError(msg, 500, response);
        })
        ;
};
