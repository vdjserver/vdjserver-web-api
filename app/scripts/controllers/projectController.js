
'use strict';

// App
var app = require('../app');

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

// Import/export metadata

ProjectController.importSubjectMetadata = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var fileUuid = request.body.fileUuid;
    var fileName = request.body.fileName;
    var op = request.body.operation;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.importSubjectMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - start, project: ' + projectUuid + ' file: ' + fileName + ' operation: ' + op);

    var data;

    // get metadata to import
    agaveIO.getProjectFileContents(projectUuid, fileName)
	.then(function(fileData) {
	    // create metadata items
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - get import file contents');
	    if (fileData) {
		//console.log(fileData);

		data = d3.tsvParse(fileData);
		//console.log(data);

		return data;
	    }
	})
	.then(function() {
	    if (op == 'replace') {
		// delete existing metadata if requested
		console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - delete existing metadata entries');
		return agaveIO.deleteAllSubjectMetadata(projectUuid);
	    }
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - get subject columns');
	    return agaveIO.getSubjectColumns(projectUuid)
		.then(function(responseObject) {
		    //console.log(responseObject);
		    if (responseObject.length == 0) {
			// no existing columns defined
			var value = { columns: data.columns };
			return agaveIO.createSubjectColumns(projectUuid, value, null);
		    } else {
			if (op == 'replace') {
			    // replace existing columns
			    value = responseObject[0].value;
			    value.columns = data.columns;
			    return agaveIO.createSubjectColumns(projectUuid, value, responseObject[0].uuid);
			} else {
			    // merge with existing colums
			    value = responseObject[0].value;
			    for (var i = 0; i < data.columns.length; ++i) {
				if (value.columns.indexOf(data.columns[i]) < 0) value.columns.push(data.columns[i]);
			    }
			    return agaveIO.createSubjectColumns(projectUuid, value, responseObject[0].uuid);
			}
		    }
		});
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - set permissions on subject columns');
	    return agaveIO.getSubjectColumns(projectUuid)
		.then(function(responseObject) {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject[0].uuid);
		});
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - create metadata entries');
            var promises = data.map(function(dataRow) {
		//console.log(dataRow);
                return function() {
		    return agaveIO.createSubjectMetadata(projectUuid, dataRow);
		}
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    return agaveIO.getSubjectMetadata(ServiceAccount.accessToken(), projectUuid);
	})
        .then(function(subjectMetadata) {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - set permissions on metadata entries');
            var promises = subjectMetadata.map(function(entry) {
		//console.log(entry);
                return function() {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, entry.uuid);
		}
	    });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - done');
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.importSubjectMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

ProjectController.exportSubjectMetadata = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var format = request.query.format;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.exportSubjectMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    if (!format) format = 'TSV';

    ServiceAccount.getToken()
        .then(function(token) {
            console.log('VDJ-API INFO: ProjectController.exportSubjectMetadata - start project ', projectUuid);
	    return agaveIO.getSubjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
	.then(function(subjectMetadata) {
	    //console.log(subjectMetadata);
	    var tsvData = '';

	    // default
	    if (subjectMetadata.length == 0) {		
		tsvData = 'Name\tCategory\tSpecies\tStrain\tGender\tAge\n';
	    }

	    // convert to TSV format
	    for (var i = 0; i < subjectMetadata.length; ++i) {
		var value = subjectMetadata[i].value;

		// header
		if (i == 0) {
		    var first = true;
		    for (var prop in value) {
			if (!first) tsvData += '\t';
			tsvData += prop;
			first = false;
		    }
		    tsvData += '\n';
		}

		// values
		var first = true;
		for (var prop in value) {
		    if (!first) tsvData += '\t';
		    tsvData += value[prop];
		    first = false;		    
		}
		tsvData += '\n';
	    }

	    var buffer = new Buffer(tsvData);
	    return agaveIO.uploadFileToProjectTempDirectory(projectUuid, "subject_metadata.tsv", buffer);
	})
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.exportSubjectMetadata - done project ', projectUuid);
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.exportSubjectMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

ProjectController.importSampleMetadata = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var fileUuid = request.body.fileUuid;
    var fileName = request.body.fileName;
    var op = request.body.operation;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.importSampleMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - start, project: ' + projectUuid + ' file: ' + fileName + ' operation: ' + op);

    var data;

    // get metadata to import
    agaveIO.getProjectFileContents(projectUuid, fileName)
	.then(function(fileData) {
	    // create metadata items
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - get import file contents');
	    if (fileData) {
		//console.log(fileData);

		data = d3.tsvParse(fileData);
		//console.log(data);

		return data;
	    }
	})
	.then(function() {
	    if (op == 'replace') {
		// delete existing metadata if requested
		console.log('VDJ-API INFO: ProjectController.importSampleMetadata - delete existing metadata entries');
		return agaveIO.deleteAllSampleMetadata(projectUuid);
	    } else {
		return;
	    }
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - get sample columns');
	    return agaveIO.getSampleColumns(projectUuid)
		.then(function(responseObject) {
		    // remove special columns
		    var columns = data.columns;
		    var idx = columns.indexOf('project_file');
		    if (idx >= 0) columns.splice(idx, 1);
		    idx = columns.indexOf('subject_uuid');
		    if (idx >= 0) columns.splice(idx, 1);
		    //console.log(columns);

		    if (responseObject.length == 0) {
			// no existing columns defined
			var value = { columns: columns };
			return agaveIO.createSampleColumns(projectUuid, value, null);
		    } else {
			if (op == 'replace') {
			    // replace existing columns
			    value = responseObject[0].value;
			    value.columns = columns;
			    return agaveIO.createSampleColumns(projectUuid, value, responseObject[0].uuid);
			} else {
			    // merge with existing columns
			    value = responseObject[0].value;
			    for (var i = 0; i < columns.length; ++i) {
				if (value.columns.indexOf(columns[i]) < 0) value.columns.push(columns[i]);
			    }
			    return agaveIO.createSampleColumns(projectUuid, value, responseObject[0].uuid);
			}
		    }
		});
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - set permissions on sample columns');
	    return agaveIO.getSampleColumns(projectUuid)
		.then(function(responseObject) {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject[0].uuid);
		});
	})
	.then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - create metadata entries');
	    return agaveIO.getProjectFiles(projectUuid)
		.then(function(projectFiles) {
		    var promises = data.map(function(dataRow) {
			// link to appropriate file
			if (dataRow.project_file) {
			    for (var i = 0; i < projectFiles.length; ++i) {
				if (dataRow.project_file == projectFiles[i].value.name) {
				    dataRow.project_file = projectFiles[i].uuid;
				    break;
				}
			    }
			}
			//console.log(dataRow);

			return function() {
			    return agaveIO.createSampleMetadata(ServiceAccount.accessToken(), projectUuid, dataRow);
			}
		    });

		    return promises.reduce(Q.when, new Q());
		})
	})
	.then(function() {
	    return agaveIO.getSampleMetadata(ServiceAccount.accessToken(), projectUuid);
        })
	.then(function(sampleMetadata) {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - set permission on metadata entries');
	    var promises = sampleMetadata.map(function(anEntry) {
		return function() {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, anEntry.uuid);
		};
	    })
	    return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - done');
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.importSampleMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

ProjectController.exportSampleMetadata = function(request, response) {
    var projectUuid = request.params.projectUuid;
    var format = request.query.format;

    if (!projectUuid) {
        console.error('VDJ-API ERROR: ProjectController.exportSampleMetadata - missing Project id parameter');
        apiResponseController.sendError('Project id required.', 400, response);
        return;
    }

    if (!format) format = 'TSV';

    ServiceAccount.getToken()
        .then(function(token) {
            console.log('VDJ-API INFO: ProjectController.exportSampleMetadata - start project ', projectUuid);
	    return agaveIO.getSampleMetadata(ServiceAccount.accessToken(), projectUuid);
        })
	.then(function(sampleMetadata) {
	    //console.log(sampleMetadata);

	    // default
	    var tsvData = '';
	    if (sampleMetadata.length == 0) {		
		tsvData = 'Name\tDescription\tSampleID\tBarcode\tsubject_uuid\tproject_file\n';
	    }

	    // convert to TSV format
	    for (var i = 0; i < sampleMetadata.length; ++i) {
		var value = sampleMetadata[i].value;

		// header
		if (i == 0) {
		    var first = true;
		    for (var prop in value) {
			if (!first) tsvData += '\t';
			tsvData += prop;
			first = false;
		    }
		    tsvData += '\n';
		}

		// values
		var first = true;
		for (var prop in value) {
		    if (!first) tsvData += '\t';
		    tsvData += value[prop];
		    first = false;		    
		}
		tsvData += '\n';
	    }

	    var buffer = new Buffer(tsvData);
	    return agaveIO.uploadFileToProjectTempDirectory(projectUuid, "sample_metadata.tsv", buffer);
	})
        .then(function() {
            console.log('VDJ-API INFO: ProjectController.exportSampleMetadata - done project ', projectUuid);
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.exportSampleMetadata - project ', projectUuid, ' error ' + error);
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
