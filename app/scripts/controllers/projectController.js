
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');
var d3 = require('d3');

var ProjectController = {};
module.exports = ProjectController;

// Creates a project and all initial directories
ProjectController.createProject = function(request, response) {

    var projectName = request.body.projectName;
    var username    = request.body.username;

    if (!projectName) {
        console.error('ProjectController.createProject - error - missing projectName parameter');
        apiResponseController.sendError('Project name required.', 400, response);
        return;
    }

    if (!username) {
        console.error('ProjectController.createProject - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    var projectMetadata;
    var uuid;

    console.log('ProjectController.createProject - event - begin for username: ' + username + ', project name: ' + projectName);

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.createProjectMetadata(projectName);
	})
        .then(function(_projectMetadata) {
            console.log('ProjectController.createProject - event - metadata for username: ' + username + ', project name: ' + projectName);

            // Save these for later
            projectMetadata = _projectMetadata;
            uuid = projectMetadata.uuid;

            return agaveIO.addUsernameToMetadataPermissions(username, ServiceAccount.accessToken(), uuid);
        })
        // create project/files directory
        .then(function() {
            console.log('ProjectController.createProject - event - metadata pems for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/files');
        })
        // create project/analyses directory
        .then(function() {
            console.log('ProjectController.createProject - event - files dir for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/analyses');
        })
        // create project/deleted directory
        .then(function() {
            console.log('ProjectController.createProject - event - analyses dir for username: ' + username + ', project name: ' + projectName);

            return agaveIO.createProjectDirectory(uuid + '/deleted');
        })
        // set project directory permissions recursively
        .then(function() {
            console.log('ProjectController.createProject - event - dir pems for username: ' + username + ', project name: ' + projectName);

            return agaveIO.addUsernameToFullFilePermissions(username, ServiceAccount.accessToken(), uuid);
        })
        .then(function() {
            console.log('ProjectController.createProject - event - complete for username: ' + username + ', project name: ' + projectName);

            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(projectMetadata, response);
        })
        .fail(function(error) {
            console.error('ProjectController.createProject - error - username ' + username + ', project name ' + projectName + ', error ' + error);
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

    // get metadata to import
    agaveIO.getProjectFileContents(projectUuid, fileName)
	.then(function(fileData) {
	    // create metadata items
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - get import file contents');
	    if (fileData) {
		console.log(fileData);

		var data = d3.tsvParse(fileData);
		console.log(data);

		return data;
	    }
	})
	.then(function(data) {
	    if (op == 'replace') {
		// delete existing metadata if requested
		console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - delete existing metadata entries');
		return agaveIO.deleteAllSubjectMetadata(projectUuid)
		    .then(function() {
			return data;
		    })
	    } else {
		return data;
	    }
	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - get subject columns');
	    return agaveIO.getSubjectColumns(projectUuid)
		.then(function(responseObject) {
		    console.log(responseObject);
		    if (responseObject.length == 0) {
			// no existing columns defined
			var value = { columns: data.columns };
			return agaveIO.createSubjectColumns(projectUuid, value, null)
			    .then(function(newObject) {
				return data;
			    })
		    } else {
			if (op == 'replace') {
			    // replace existing columns
			    value = responseObject[0].value;
			    value.columns = data.columns;
			    return agaveIO.createSubjectColumns(projectUuid, value, responseObject[0].uuid)
				.then(function() {
				    return data;
				})
			} else {
			    // merge with existing colums
			    value = responseObject[0].value;
			    for (var i = 0; i < data.columns.length; ++i) {
				if (value.columns.indexOf(data.columns[i]) < 0) value.columns.push(data.columns[i]);
			    }
			    return agaveIO.createSubjectColumns(projectUuid, value, responseObject[0].uuid)
				.then(function() {
				    return data;
				})
			}
		    }
		});
	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - set permissions on subject columns');
	    return agaveIO.getSubjectColumns(projectUuid)
		.then(function(responseObject) {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject[0].uuid)
			.then(function() {
			    return data;
			});
		});

	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSubjectMetadata - create metadata entries');
            var promises = data.map(function(dataRow) {
		console.log(dataRow);
                return function() {
		    agaveIO.createSubjectMetadata(projectUuid, dataRow)
			.then(function(responseObject) {
			    // set permissions on metadata item for all users
			    if (responseObject.uuid) {
				return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject.uuid);
			    }
			});
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
            console.log('VDJ-API INFO: ProjectController.exportSubjectMetadata - project ', projectUuid);
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

    // get metadata to import
    agaveIO.getProjectFileContents(projectUuid, fileName)
	.then(function(fileData) {
	    // create metadata items
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - get import file contents');
	    if (fileData) {
		console.log(fileData);

		var data = d3.tsvParse(fileData);
		console.log(data);

		return data;
	    }
	})
	.then(function(data) {
	    if (op == 'replace') {
		// delete existing metadata if requested
		console.log('VDJ-API INFO: ProjectController.importSampleMetadata - delete existing metadata entries');
		return agaveIO.deleteAllSampleMetadata(projectUuid)
		    .then(function() {
			return data;
		    })
	    } else {
		return data;
	    }
	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - get sample columns');
	    return agaveIO.getSampleColumns(projectUuid)
		.then(function(responseObject) {
		    console.log(responseObject);
		    if (responseObject.length == 0) {
			// no existing columns defined
			var value = { columns: data.columns };
			return agaveIO.createSampleColumns(projectUuid, value, null)
			    .then(function(newObject) {
				return data;
			    })
		    } else {
			if (op == 'replace') {
			    // replace existing columns
			    value = responseObject[0].value;
			    value.columns = data.columns;
			    return agaveIO.createSampleColumns(projectUuid, value, responseObject[0].uuid)
				.then(function() {
				    return data;
				})
			} else {
			    // merge with existing colums
			    value = responseObject[0].value;
			    for (var i = 0; i < data.columns.length; ++i) {
				if (value.columns.indexOf(data.columns[i]) < 0) value.columns.push(data.columns[i]);
			    }
			    return agaveIO.createSampleColumns(projectUuid, value, responseObject[0].uuid)
				.then(function() {
				    return data;
				})
			}
		    }
		});
	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - set permissions on sample columns');
	    return agaveIO.getSampleColumns(projectUuid)
		.then(function(responseObject) {
		    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject[0].uuid)
			.then(function() {
			    return data;
			});
		});

	})
	.then(function(data) {
	    console.log('VDJ-API INFO: ProjectController.importSampleMetadata - create metadata entries');
            var promises = data.map(function(dataRow) {
		console.log(dataRow);
                return function() {
		    agaveIO.createSampleMetadata(projectUuid, dataRow)
			.then(function(responseObject) {
			    // set permissions on metadata item for all users
			    if (responseObject.uuid) {
				return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, responseObject.uuid);
			    }
			});
		}
            });

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
	    return agaveIO.getSampleMetadata(ServiceAccount.accessToken(), projectUuid);
        })
	.then(function(sampleMetadata) {
	    //console.log(sampleMetadata);

	    // default
	    var tsvData = '';
	    if (sampleMetadata.length == 0) {		
		tsvData = 'Name\tDescription\tSampleID\tBarcode\tproject_file\n';
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
	    apiResponseController.sendSuccess('ok', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: ProjectController.exportSampleMetadata - project ', projectUuid, ' error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
