
'use strict';

//
// agaveIO.js
// Encapsulation functions for the Tapis (Agave) APIs
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

var agaveIO  = {};
module.exports = agaveIO;

// Settings
var agaveSettings = require('../config/agaveSettings');

// Models
var ServiceAccount = require('../models/serviceAccount');
var MetadataPermissions = require('../models/metadataPermissions');

// Processing
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Q = require('q');
var _ = require('underscore');
var jsonApprover = require('json-approver');
var FormData = require('form-data');

//
// Generic send request
//
agaveIO.sendRequest = function(requestSettings, postData) {

    var deferred = Q.defer();

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && jsonApprover.isJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave response is not json. Raw output: ' + output);
                }

                deferred.reject(new Error('Agave response is not json. Raw output: ' + output));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave returned an error. it is: ' + JSON.stringify(responseObject));
                    console.error('VDJ-API ERROR: Agave returned an error. it is: ' + responseObject);
                }

                deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
            }

        });
    });

    request.on('error', function(error) {
        if (agaveSettings.debugConsole === true) {
            console.error('VDJ-API ERROR: Agave connection error.' + JSON.stringify(error));
        }

        deferred.reject(new Error('Agave connection error'));
    });

    if (postData) {
        // Request body parameters
        request.write(postData);
    }

    request.end();

    return deferred.promise;
};

//
// This is specific to sending multi-part form post data, i.e. uploading files
//
agaveIO.sendFormRequest = function(requestSettings, formData) {

    var deferred = Q.defer();

    var request = formData.submit(requestSettings, function(error, response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && jsonApprover.isJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave response is not json.');
                }

                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave returned an error. it is: ' + JSON.stringify(responseObject));
                    console.error('VDJ-API ERROR: Agave returned an error. it is: ' + responseObject);
                }

                deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
            }

        });
    });

    request.on('error', function(error) {
        if (agaveSettings.debugConsole === true) {
            console.error('VDJ-API ERROR: Agave connection error.' + JSON.stringify(error));
        }

        deferred.reject(new Error('Agave connection error. ' + JSON.stringify(error)));
    });

    return deferred.promise;
};

agaveIO.sendTokenRequest = function(requestSettings, postData) {

    var deferred = Q.defer();

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && jsonApprover.isJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave token response is not json.');
                }

                deferred.reject(new Error('Agave response is not json'));
            }

            if (
                responseObject
                && responseObject.access_token
                && responseObject.refresh_token
                && responseObject.token_type
                && responseObject.expires_in
            ) {
                deferred.resolve(responseObject);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave returned a token error. it is: ' + JSON.stringify(responseObject));
                    console.error('VDJ-API ERROR: Agave returned a token error. it is: ' + responseObject);
                }

                deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
            }

        });
    });

    request.on('error', function() {

        if (agaveSettings.debugConsole === true) {
            console.error('VDJ-API ERROR: Agave token connection error.');
        }

        deferred.reject(new Error('Agave connection error'));
    });

    if (postData) {
        // Request body parameters
        request.write(postData);
    }

    request.end();

    return deferred.promise;
};

//
// For retrieving file data
//
agaveIO.sendFileRequest = function(requestSettings, postData) {

    var deferred = Q.defer();

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

	    // do not attempt to parse
	    deferred.resolve(output);

        });
    });

    request.on('error', function(error) {
        if (agaveSettings.debugConsole === true) {
            console.error('VDJ-API ERROR: Agave connection error.' + JSON.stringify(error));
        }

        deferred.reject(new Error('Agave connection error'));
    });

    if (postData) {
        // Request body parameters
        request.write(postData);
    }

    request.end();

    return deferred.promise;
};

//
// For checking existence of files/folders
// does not reject promise with a 404 error
//
agaveIO.sendCheckRequest = function(requestSettings, postData) {

    var deferred = Q.defer();

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && jsonApprover.isJSON(output)) {
                responseObject = JSON.parse(output);
            } else {

                if (agaveSettings.debugConsole === true) {
                    console.error('VDJ-API ERROR: Agave response is not json.');
                }

                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
		deferred.resolve(responseObject);
            } else {
		if (responseObject.status.toLowerCase() === 'error' && response.statusCode == 404) {
		    deferred.resolve(responseObject);
		} else {
                    if (agaveSettings.debugConsole === true) {
			console.error('VDJ-API ERROR: Agave returned an error. it is: ' + JSON.stringify(responseObject));
			console.error('VDJ-API ERROR: Agave returned an error. it is: ' + responseObject);
                    }
                    deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
		}
	    }	    
        });
    });

    request.on('error', function(error) {
        if (agaveSettings.debugConsole === true) {
            console.error('VDJ-API ERROR: Agave connection error.' + JSON.stringify(error));
        }

        deferred.reject(new Error('Agave connection error'));
    });

    if (postData) {
        // Request body parameters
        request.write(postData);
    }

    request.end();

    return deferred.promise;
};

// Fetches a user token based on the supplied auth object
// and returns the auth object with token data on success
agaveIO.getToken = function(auth) {

    var deferred = Q.defer();

    var postData = 'grant_type=password&scope=PRODUCTION&username=' + auth.username + '&password=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    agaveIO.sendTokenRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth) {

    var deferred = Q.defer();

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.refresh_token;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    agaveIO.sendTokenRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createUser = function(user) {

    var deferred = Q.defer();

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/profiles/v2/',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/x-www-form-urlencoded',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getAgaveUserProfile = function(accessToken, username) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/profiles/v2/' + username,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + accessToken
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createUserProfile = function(user, userAccessToken) {

    var deferred = Q.defer();

    var postData = {
        name: 'profile',
        value: user
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + userAccessToken
        }
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getUserProfile = function(username) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data?q=' + encodeURIComponent('{"name":"profile","owner":"' + username + '"}') + '&limit=1',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// create metadata record for a private project
agaveIO.createProjectMetadata = function(project) {

    var deferred = Q.defer();

    var postData = {
        name: 'privateProject',
        value: project
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProjectMetadata = function(accessToken, projectUuid) {

    var deferred = Q.defer();

    var requestSettings = {
	host:     agaveSettings.hostname,
	method:   'GET',
	path:     '/meta/v2/data/' + projectUuid,
	rejectUnauthorized: false,
	headers: {
	    'Authorization': 'Bearer ' + accessToken
	}
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createProjectDirectory = function(directory) {

    var deferred = Q.defer();

    var postData = 'action=mkdir&path=' + directory;

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'PUT',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//projects/',
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.addUsernameToMetadataPermissions = function(username, accessToken, uuid) {

    var deferred = Q.defer();

    var postData = 'username=' + username + '&permission=READ_WRITE';

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.removeUsernameFromMetadataPermissions = function(username, accessToken, uuid) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'DELETE',
        path:     '/meta/v2/data/' + uuid + '/pems/' + username,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getMetadataPermissions = function(accessToken, uuid) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getMetadataPermissionsForUser = function(accessToken, uuid, username) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid + '/pems/' + username,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProjectFileMetadata = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent('{'
					     + '"name": { $in: ["projectFile", "projectJobFile"] },'
					     + '"value.projectUuid":"' + projectUuid + '"'
					     + '}')
			+ '&limit=50&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getProjectFiles = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent('{'
					     + '"name": { $in: ["projectFile"] },'
					     + '"associationIds":"' + projectUuid + '"'
					     + '}')
			+ '&limit=50&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

//
// Retrieve all project associated metadata
// This relies upon associationIds having the project uuid
// This performs multiple requests to get all of the records
//
agaveIO.getAllProjectAssociatedMetadata = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent('{'
					     + '"associationIds":"' + projectUuid + '"'
					     + '}')
			+ '&limit=100&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getFilePermissions = function(accessToken, filePath) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getFileListings = function(accessToken, projectUuid) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//projects/' + projectUuid + '/files',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.enumerateFileListings = function(projectUuid) {

    var deferred = Q.defer();

    var pathList = [];
    var dirStack = [];

    var doFetch = function(offset, filePath) {
	//console.log(dirStack);
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'GET',
		    path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//projects/' + projectUuid + filePath
			+ '?limit=100&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};
		//console.log(requestSettings);

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // parse results between directories and files
		    for (var i = 0; i < result.length; ++i) {
			var obj = result[i];
			if (obj.name == '.') continue;
			if (obj.type == 'dir') {
			    var path = obj.path.replace('/projects/' + projectUuid, '');
			    //console.log(path);
			    // don't recurse down into the job files
			    if (filePath != 'analyses') dirStack.push(path);
			    pathList.push(path);
			} else if (obj.type == 'file') {
			    var path = obj.path.replace('/projects/' + projectUuid, '');
			    pathList.push(path);
			} else {
			    console.error('VDJ-API ERROR: Unknown file type: ' + obj);
			}
		    }
		    // maybe more data
		    var newOffset = offset + result.length;
		    doFetch(newOffset, filePath);
		} else {
		    // nothing left to enumerate
		    if (dirStack.length == 0)
			deferred.resolve(pathList);
		    else
			doFetch(0, dirStack.pop());
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    pathList.push('');
    doFetch(0, '');

    return deferred.promise;
};

agaveIO.getFileHistory = function(relativePath) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/history/system/' + agaveSettings.storageSystem + '//projects/' + relativePath,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProjectFileContents = function(projectUuid, fileName) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/media/system'
                    + '/' + agaveSettings.storageSystem
                    + '//projects/' + projectUuid
                    + '/files'
                    + '/' + fileName,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendFileRequest(requestSettings, null);
	})
        .then(function(fileData) {
            deferred.resolve(fileData);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.addUsernameToJobPermissions = function(username, accessToken, jobId) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': 'ALL',
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/jobs/v2/' + jobId + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.removeUsernameFromJobPermissions = function(username, accessToken, jobId) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': 'NONE',
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/jobs/v2/' + jobId + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setJobPermissions = function(username, permission, accessToken, jobId) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': permission,
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/jobs/v2/' + jobId + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.addUsernameToFullFilePermissions = function(username, accessToken, filePath, recursive) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': 'ALL',
        'recursive': recursive,
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        }
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setFilePermissionsForProjectUsers = function(projectUuid, filePath, recursive) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    // get list of users from project metadata permissions
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	})
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = projectUsernames.map(function(username) {

                return function() {
                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        ServiceAccount.accessToken(),
                        filePath,
			recursive
                    );
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setFilePermissions = function(accessToken, username, permission, recursive, filePath) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': permission,
        'recursive': recursive,
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.removeUsernameFromFilePermissions = function(username, accessToken, filePath) {

    var deferred = Q.defer();

    //var postData = 'username=' + username + '&read=false&write=false&execute=false';
    var postData = {
        'username': username,
        'permission': 'NONE',
        'recursive': true,
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.removeAllFilePermissions = function(accessToken, filePath, recursive) {

    var deferred = Q.defer();

    var postData = {
        'username': '*',
        'permission': 'NONE',
        'recursive': recursive,
    };

    postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Authorization': 'Bearer ' + accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createUserVerificationMetadata = function(username) {

    var deferred = Q.defer();

    var postData = {
        name: 'userVerification',
        value: {
            'username': username,
            'isVerified': false,
        },
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getUserVerificationMetadata = function(username) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{"name":"userVerification",'
                            + ' "value.username":"' + username + '",'
                            + ' "owner":"' + ServiceAccount.username + '"'
                            + '}'
                    )
                    + '&limit=1'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.verifyUser = function(username, verificationId) {

    var deferred = Q.defer();

    var postData = {
        name: 'userVerification',
        value: {
            'username': username,
            'isVerified': true,
        },
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data/' + verificationId,
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createPasswordResetMetadata = function(username) {

    var deferred = Q.defer();

    var postData = {
        name: 'passwordReset',
        value: {
            'username': username
        }
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createJobMetadata = function(projectUuid, jobUuid, secondaryInputs) {

    var deferred = Q.defer();

    var postData = {
	associationIds: [ projectUuid, jobUuid ],
        name: 'projectJob',
        value: {
            projectUuid: projectUuid,
            jobUuid: jobUuid,
        },
    };
    if (secondaryInputs) postData.value.secondaryInputs = secondaryInputs;

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization':  'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.updateJobMetadata = function(uuid, name, value) {

    var deferred = Q.defer();

    var postData = {
	associationIds: [ value.projectUuid, value.jobUuid ],
        name: name,
        value: value
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data/' + uuid,
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobMetadata = function(projectUuid, jobUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"projectJob",'
                            + '"value.projectUuid":"' + projectUuid + '",'
                            + '"value.jobUuid":"' + jobUuid + '",'
                            + '}'
                    )
                    + '&limit=1'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobMetadataForProject = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent(
                            '{'
				+ '"name":"projectJob",'
				+ '"value.projectUuid":"' + projectUuid + '"'
				+ '}'
			)
			+ '&limit=50&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getJobMetadataForJob = function(jobUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"projectJob",'
                            + '"associationIds":"' + jobUuid + '"'
                            + '}'
                    )
                    + '&limit=1'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobMetadataForArchivedJob = function(jobUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"projectJobArchive",'
                            + '"associationIds":"' + jobUuid + '"'
                            + '}'
                    )
                    + '&limit=1'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobsForProject = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/jobs/v2/?archivePath.like=/projects/' + projectUuid + '*'
			+ '&limit=50&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getPasswordResetMetadata = function(uuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{"name":"passwordReset",'
                            + ' "uuid":"' + uuid + '",'
                            + ' "owner":"' + ServiceAccount.username + '"}'
                    )
                    + '&limit=1'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getMetadata = function(uuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data/' + uuid,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.updateMetadata = function(uuid, name, value, associationIds) {

    var deferred = Q.defer();

    var postData = {
        name: name,
        value: value
    };
    if (associationIds) postData.associationIds = associationIds;

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data/' + uuid,
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };
	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.deleteMetadata = function(accessToken, uuid) {

    var deferred = Q.defer();

    var requestSettings = {
	host:     agaveSettings.hostname,
	method:   'DELETE',
	path:     '/meta/v2/data/' + uuid,
	rejectUnauthorized: false,
	headers: {
	    'Authorization': 'Bearer ' + accessToken
	}
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.updateUserPassword = function(user) {

    var deferred = Q.defer();

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'PUT',
		path:     '/profiles/v2/' + user.username + '/',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/x-www-form-urlencoded',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobOutput = function(jobId) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/jobs/v2/' + jobId,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobPermissions = function(jobId) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/jobs/v2/' + jobId + '/pems',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobOutputFileListings = function(projectUuid, relativeArchivePath) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'GET',
		    path:     '/files/v2/listings/system'
			+ '/' + agaveSettings.storageSystem
			+ '//projects/' + projectUuid
			+ '/analyses'
			+ '/' + relativeArchivePath
			+ '?limit=50&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    },
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getJobProcessMetadataFileListing = function(projectUuid, relativeArchivePath) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system'
                    + '/' + agaveSettings.storageSystem
                    + '//projects/' + projectUuid
                    + '/analyses'
                    + '/' + relativeArchivePath + '/process_metadata.json',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getJobProcessMetadataFileContents = function(projectUuid, relativeArchivePath) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/media/system'
                    + '/' + agaveSettings.storageSystem
                    + '//projects/' + projectUuid
                    + '/analyses'
                    + '/' + relativeArchivePath + '/process_metadata.json',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendFileRequest(requestSettings, null);
	})
        .then(function(fileData) {
            deferred.resolve(fileData);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createProcessMetadata = function(projectUuid, jobUuid, data) {

    var deferred = Q.defer();

    var postData = {
        name: 'processMetadata',
	associationIds: [ projectUuid, jobUuid ],
        value: data
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProcessMetadataForProject = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'GET',
		    path:     '/meta/v2/data?q='
			+ encodeURIComponent(
                            '{'
				+ '"name":"processMetadata",'
				+ '"associationIds":"' + projectUuid + '"'
				+ '}'
			)
			+ '&limit=50&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.getProcessMetadataForJob = function(jobUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"processMetadata",'
                            + '"associationIds":"' + jobUuid + '"'
                            + '}'
                    )
                    + '&limit=1',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createProjectJobFileMetadata = function(projectUuid, jobUuid, jobFileListingName, jobFileListingLength, jobFileType, jobName, relativeArchivePath) {

    var deferred = Q.defer();

    var postData = {
        name: 'projectJobFile',
	associationIds: [ projectUuid, jobUuid ],
        value: {
            projectUuid: projectUuid,
            jobUuid: jobUuid,
            fileType: jobFileType,
            name: jobFileListingName,
            length: jobFileListingLength,
            isDeleted: false,
	    showInProjectData: false,
            readDirection: '',
            relativeArchivePath: relativeArchivePath,
            jobName: jobName,
            publicAttributes: {
                'tags': [],
            },
        },
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization':  'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProjectJobFileMetadatas = function(projectUuid, jobId) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent(
                            '{'
				+ '"name":"projectJobFile",'
				+ '"value.projectUuid":"' + projectUuid + '",'
				+ '"value.jobUuid":"' + jobId + '"'
				+ '}'
			)
			+ '&limit=50&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.createFileMetadata = function(fileUuid, projectUuid, fileType, name, length, readDirection, tags) {

    var deferred = Q.defer();

    var postData = {
        associationIds: [
            fileUuid,
	    projectUuid,
        ],
        name: 'projectFile',
        owner: '',
        value: {
            'projectUuid': projectUuid,
            'fileType': fileType,
            'name': name,
            'length': length,
            'isDeleted': false,
            'readDirection': readDirection,
            'publicAttributes': {
                'tags': tags,
            },
        },
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getFileDetail = function(relativePath) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//projects/' + relativePath,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getProjectFileMetadataByFilename = function(projectUuid, fileUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:   agaveSettings.hostname,
		    method: 'GET',
		    path:   '/meta/v2/data?q='
			+ encodeURIComponent('{'
					     + '"name": "projectFile",'
					     + '"value.projectUuid": "' + projectUuid + '",'
					     + '"associationIds": { $in: ["' + fileUuid + '"] }'
					     + '}')
			+ '&limit=50&offset=' + offset
                    ,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.createFeedbackMetadata = function(feedback, username, email) {

    var deferred = Q.defer();

    var valueData = {
        feedbackMessage: feedback,
    };

    if (username.length > 0) {
        valueData.username = username;
    }

    if (email.length > 0) {
        valueData.email = email;
    }

    var postData = {
        name: 'feedback',
        value: valueData,
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization':  'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        })
        ;

    return deferred.promise;
};

agaveIO.validateToken = function(token) {

    var deferred = Q.defer();

    var requestSettings = {
        host:   agaveSettings.hostname,
        method: 'GET',
        path:   '/systems/v2/',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + token,
        }
    };

    agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(new Error('Unable to validate token.'));
        });

    return deferred.promise;
};

agaveIO.isDuplicateUsername = function(username) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/profiles/v2/' + username,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(true);
        })
        .fail(function(errorObject) {
            deferred.resolve(false);
        });

    return deferred.promise;
};

agaveIO.createJobArchiveDirectory = function(projectUuid, relativeArchivePath) {

    var deferred = Q.defer();

    var postData = 'action=mkdir&path=' + relativeArchivePath;

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'PUT',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem
                    + '//projects/'
                    + '/' + projectUuid
                    + '/analyses'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.uploadFileToJobArchiveDirectory = function(archivePath, filename, filedata) {

    var deferred = Q.defer();

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    ServiceAccount.getToken()
	.then(function(token) {
	    var formHeaders = form.getHeaders();
	    formHeaders.Authorization = 'Bearer ' + ServiceAccount.accessToken();
	    var requestSettings = {
		host:     agaveSettings.hostname,
		protocol: 'https:',
		method:   'POST',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem
                    + '/' + archivePath,
		rejectUnauthorized: false,
		headers: formHeaders
	    };

	    return agaveIO.sendFormRequest(requestSettings, form);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.uploadFileToProjectDirectory = function(projectUuid, filename, filedata) {

    var deferred = Q.defer();

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    ServiceAccount.getToken()
	.then(function(token) {
	    var formHeaders = form.getHeaders();
	    formHeaders.Authorization = 'Bearer ' + ServiceAccount.accessToken();
	    var requestSettings = {
		host:     agaveSettings.hostname,
		protocol: 'https:',
		method:   'POST',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem
                    + '//projects/' + projectUuid + '/files',
		rejectUnauthorized: false,
		headers: formHeaders
	    };

	    return agaveIO.sendFormRequest(requestSettings, form);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.uploadFileToProjectTempDirectory = function(projectUuid, filename, filedata) {

    var deferred = Q.defer();

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    ServiceAccount.getToken()
	.then(function(token) {
	    var formHeaders = form.getHeaders();
	    formHeaders.Authorization = 'Bearer ' + ServiceAccount.accessToken();
	    var requestSettings = {
		host:     agaveSettings.hostname,
		protocol: 'https:',
		method:   'POST',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem
                    + '//projects/' + projectUuid + '/deleted',
		rejectUnauthorized: false,
		headers: formHeaders
	    };

	    return agaveIO.sendFormRequest(requestSettings, form);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.launchJob = function(jobDataString) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/jobs/v2/'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(jobDataString),
		    'Content-Type': 'application/json',
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		},
	    };

	    return agaveIO.sendRequest(requestSettings, jobDataString);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

//
/////////////////////////////////////////////////////////////////////
//
// Community data
//

agaveIO.setCommunityFilePermissions = function(filePath) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    // get all user permissions
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//community/' + filePath,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
	.then(function(requestObject) {
	    var permissionsList = requestObject.result;

	    // remove permissions
            var promises = permissionsList.map(function(entry) {
                return function() {
		    if (entry.username == agaveSettings.serviceAccountKey) return;
		    else return agaveIO.setFilePermissions(ServiceAccount.accessToken(), entry.username, 'NONE', false, '/community/' + filePath);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function(responseObject) {
	    // guest account READ only
	    var postData = 'username=' + agaveSettings.guestAccountKey + '&permission=READ&recursive=false';

	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//community/' + filePath,
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
	.then(function(responseObject) {
            deferred.resolve(responseObject);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createCommunityDirectory = function(directory) {

    var deferred = Q.defer();

    var postData = 'action=mkdir&path=' + directory;

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'PUT',
		path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//community/',
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function() {
	    return agaveIO.setCommunityFilePermissions(directory);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.moveProjectFileToCommunity = function(projectUuid, filename, toCommunity) {

    var deferred = Q.defer();

    var fromPath;
    var toPath;
    if (toCommunity) {
	fromPath = 'projects';
	toPath = 'community';
    } else {
	fromPath = 'community';
	toPath = 'projects';
    }
    var performMove = false;

    ServiceAccount.getToken()
	.then(function(token) {
	    // check that file is there
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//' + fromPath + '/' + projectUuid + '/files/' + filename,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendCheckRequest(requestSettings, null);
	})
	.then(function(responseObject) {
	    if (responseObject.status === 'success') {
		performMove = true;
		return null;
	    }

	    // if file does not exist in from directory, see if already moved
	    console.log('VDJ-API INFO: File ' + filename + ' does not exist in ' + fromPath + ' directory, looking to see if already moved.');
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//' + toPath + '/' + projectUuid + '/files/' + filename,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendCheckRequest(requestSettings, null);
	})
	.then(function(responseObject) {
	    if (performMove) return;

	    if (responseObject.status === 'success') {
		performMove = false;
		console.log('VDJ-API INFO: File ' + filename + ' was already moved.');
		return;
	    } else {
		// do not abort the process if cannot find file
		performMove = false;
		var msg = 'VDJ-API ERROR: project publish/unpublish: ' + projectUuid + ', File ' + filename + ' does not exist in either the project or community directory, trying to continue...';
		console.error(msg);
		webhookIO.postToSlack(msg);
		deferred.resolve();
	    }
	})
	.then(function() {
	    if (performMove) {
		var postData = 'action=move&path=/' + toPath + '/' + projectUuid + '/files/' + filename;
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'PUT',
		    path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//' + fromPath + '/' + projectUuid + '/files/' + filename,
		    rejectUnauthorized: false,
		    headers: {
			'Content-Length': Buffer.byteLength(postData),
			'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		    }
		};

		return agaveIO.sendRequest(requestSettings, postData);
	    }
	})
        .then(function() {
	    if (toCommunity) return agaveIO.setCommunityFilePermissions(projectUuid + '/files/' + filename);
	    else return agaveIO.setFilePermissionsForProjectUsers(projectUuid, projectUuid + '/files/' + filename, false);
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.moveJobFileToCommunity = function(projectUuid, jobPath, filename, toCommunity) {

    var deferred = Q.defer();

    var fromPath;
    var toPath;
    if (toCommunity) {
	fromPath = 'projects';
	toPath = 'community';
    } else {
	fromPath = 'community';
	toPath = 'projects';
    }
    var performMove = false;

    ServiceAccount.getToken()
	.then(function(token) {
	    // check that file is there
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//' + fromPath + '/' + projectUuid + '/analyses/' + jobPath + '/' + filename,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendCheckRequest(requestSettings, null);
	})
	.then(function(responseObject) {
	    if (responseObject.status === 'success') {
		performMove = true;
		return null;
	    }

	    // if file does not exist in from directory, see if already moved
	    console.log('VDJ-API INFO: File ' + filename + ' does not exist in ' + fromPath + ' job directory ' + jobPath + ', looking to see if already moved.');
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//' + toPath + '/' + projectUuid + '/analyses/' + jobPath + '/' + filename,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendCheckRequest(requestSettings, null);
	})
	.then(function(responseObject) {
	    if (performMove) return;

	    if (responseObject.status === 'success') {
		performMove = false;
		console.log('VDJ-API INFO: File ' + filename + ' was already moved.');
		return;
	    } else {
		// do not abort the process if cannot find file
		performMove = false;
		var msg = 'VDJ-API ERROR: project publish/unpublish: ' + projectUuid + ', File ' + filename
		    + ' does not exist in either the project or community jobs directory' + jobPath + ', trying to continue...';
		console.error(msg);
		webhookIO.postToSlack(msg);
		deferred.resolve();
	    }
	})
	.then(function() {
	    if (performMove) {
		var postData = 'action=move&path=/' + toPath + '/' + projectUuid + '/analyses/' + jobPath + '/' + filename;
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'PUT',
		    path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//' + fromPath + '/' + projectUuid + '/analyses/' + jobPath + '/' + filename,
		    rejectUnauthorized: false,
		    headers: {
			'Content-Length': Buffer.byteLength(postData),
			'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		    }
		};

		return agaveIO.sendRequest(requestSettings, postData);
	    }
	})
        .then(function() {
	    if (toCommunity) return agaveIO.setCommunityFilePermissions(projectUuid + '/analyses/' + jobPath + '/' + filename);
	    else return agaveIO.setFilePermissionsForProjectUsers(projectUuid, projectUuid + '/analyses/' + jobPath + '/' + filename, false);
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setCommunityJobPermissions = function(projectUuid, jobId, toCommunity) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getJobPermissions(jobId);
	})
	.then(function(permissionsList) {
	    // remove permissions
            var promises = permissionsList.map(function(entry) {
                return function() {
		    if (entry.username == agaveSettings.serviceAccountKey) return;
		    else return agaveIO.removeUsernameFromJobPermissions(entry.username, ServiceAccount.accessToken(), jobId);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    if (toCommunity) {
		// guest account READ only
		return agaveIO.setJobPermissions(agaveSettings.guestAccountKey, 'READ', ServiceAccount.accessToken(), jobId);
	    } else {
		// add permisions for project users
		return agaveIO.addJobPermissionsForProjectUsers(projectUuid, jobId);
	    }
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.moveJobToCommunity = function(projectUuid, jobId, toCommunity) {

    var deferred = Q.defer();

    var jobFiles = [];
    agaveIO.getProjectJobFileMetadatas(projectUuid, jobId)
        .then(function(_jobFiles) {
	    jobFiles = _jobFiles;
	    if (!toCommunity) return;
	    if (jobFiles.length > 0) return agaveIO.createCommunityDirectory(projectUuid + '/analyses/' + jobFiles[0].value.relativeArchivePath);
	})
	.then(function() {
            var promises = jobFiles.map(function(file) {
                return function() {
                    return agaveIO.moveJobFileToCommunity(projectUuid, file.value.relativeArchivePath, file.value.name, toCommunity);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    // set permission on the job
	    return agaveIO.setCommunityJobPermissions(projectUuid, jobId, toCommunity);
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.clearCommunityMetadataPermissions = function(uuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    // get all user permissions
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data/' + uuid + '/pems',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
	.then(function(requestObject) {
	    var permissionsList = requestObject.result;

	    // remove permissions
            var promises = permissionsList.map(function(entry) {
                return function() {
		    if (entry.username == agaveSettings.serviceAccountKey) return;
		    else return agaveIO.removeUsernameFromMetadataPermissions(entry.username, ServiceAccount.accessToken(), uuid);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
	.then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setMetadataPermissionsForCommunity = function(uuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.clearCommunityMetadataPermissions(uuid);
	})
        .then(function() {
	    // guest account READ only
	    var postData = 'username=' + agaveSettings.guestAccountKey + '&permission=READ';

	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data/' + uuid + '/pems',
		rejectUnauthorized: false,
		headers: {
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		},
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
	.then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setMetadataPermissionsForProject = function(projectUuid, uuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.clearCommunityMetadataPermissions(uuid);
	})
        .then(function() {
	    return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, uuid);
	})
	.then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.setCommunityMetadataPermissions = function(projectUuid, toCommunity) {

    var deferred = Q.defer();

    agaveIO.getAllProjectAssociatedMetadata(projectUuid)
        .then(function(metadataList) {
            var promises = metadataList.map(function(entry) {
                return function() {
		    if (toCommunity) return agaveIO.setMetadataPermissionsForCommunity(entry.uuid);
		    else return agaveIO.setMetadataPermissionsForProject(projectUuid, entry.uuid);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
	    if (toCommunity) {
		// guest account READ only
		var postData = 'permission=READ';

		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'POST',
		    path:     '/meta/v2/data/' + projectUuid + '/pems/' + agaveSettings.guestAccountKey,
		    rejectUnauthorized: false,
		    headers: {
			'Content-Length': Buffer.byteLength(postData),
			'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		    },
		};

		return agaveIO.sendRequest(requestSettings, postData);
	    } else {
		// remove guest account access
		var postData = 'permission=NONE';

		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'POST',
		    path:     '/meta/v2/data/' + projectUuid + '/pems/' + agaveSettings.guestAccountKey,
		    rejectUnauthorized: false,
		    headers: {
			'Content-Length': Buffer.byteLength(postData),
			'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		    },
		};

		return agaveIO.sendRequest(requestSettings, postData);
	    }
	})
        .then(function() {
	    // get all user permissions
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data/' + projectUuid + '/pems',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
	.then(function(requestObject) {
	    console.log(requestObject);
	    var permissionsList = requestObject.result;

	    if (toCommunity) {
		// change user permissions to READ only on project metadata
		var promises = permissionsList.map(function(entry) {
                    return function() {
			if (entry.username == agaveSettings.serviceAccountKey) return;
			else if (entry.username == agaveSettings.guestAccountKey) return;
			else {
			    var postData = 'permission=READ';

			    var requestSettings = {
				host:     agaveSettings.hostname,
				method:   'POST',
				path:     '/meta/v2/data/' + projectUuid + '/pems/' + entry.username,
				rejectUnauthorized: false,
				headers: {
				    'Content-Length': Buffer.byteLength(postData),
				    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
				},
			    };

			    console.log(requestSettings);
			    return agaveIO.sendRequest(requestSettings, postData);
			}
                    };
		});

		return promises.reduce(Q.when, new Q());
	    } else {
		// give users full permissions on project metadata
		return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, projectUuid);
	    }
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getCommunityDataMetadata = function() {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:   agaveSettings.hostname,
		method: 'GET',
		path:   '/meta/v2/data?q='
                    + encodeURIComponent('{'
					 + '"name": "communityDataSRA"'
					 + '}')
                    + '&limit=5000'
                ,
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createCommunityFilePostit = function(projectUuid, path) {

    var deferred = Q.defer();

    var url = 'https://' + agaveSettings.hostname
	+ '/files/v2/media/system/'
	+ agaveSettings.storageSystem
	+ '//community/' + projectUuid
	+ '/' + path
	+ '?force=true';

    var postData = {
	url: url,
	method: 'GET',
	maxUses: 1,
	lifetime: 3600,
	noauth: false
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/postits/v2/',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

//
/////////////////////////////////////////////////////////////////////
//
// Project load/unload from VDJServer ADC data repository
//

agaveIO.createProjectLoadMetadata = function(projectUuid) {

    var deferred = Q.defer();

    var postData = {
        name: 'projectLoad',
	associationIds: [ projectUuid ],
        value: {
            shouldLoad: true,
            isLoaded: false,
            repertoireMetadataLoaded: false,
            rearrangementDataLoaded: false
        }
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// there should be only a single metadata record
agaveIO.getProjectLoadMetadata = function(projectUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"projectLoad",'
                            + '"associationIds":"' + projectUuid + '"'
                            + '}'
                    )
                    + '&limit=1',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// get list of projects to be loaded
agaveIO.getProjectsToBeLoaded = function() {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'GET',
		    path:     '/meta/v2/data?q='
			+ encodeURIComponent('{"name":"projectLoad","value.shouldLoad":true,"value.isLoaded":false}')
			+ '&limit=50&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

// status record for a rearrangement load
agaveIO.createRearrangementLoadMetadata = function(projectUuid, repertoire_id) {

    var deferred = Q.defer();

    var postData = {
        name: 'rearrangementLoad',
	associationIds: [ projectUuid ],
        value: {
            repertoire_id: repertoire_id,
            isLoaded: false,
            load_set: 0
        }
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// get list of repertoires that need their rearrangement data to be loaded
agaveIO.getRearrangementsToBeLoaded = function(projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	return ServiceAccount.getToken()
	    .then(function(token) {
		var requestSettings = {
		    host:     agaveSettings.hostname,
		    method:   'GET',
		    path:     '/meta/v2/data?q='
                        + encodeURIComponent(
                            '{'
                                + '"name":"rearrangementLoad",'
                                + '"associationIds":"' + projectUuid + '"'
                                + '}'
                        )
			+ '&limit=50&offset=' + offset,
		    rejectUnauthorized: false,
		    headers: {
			'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		    }
		};

		return agaveIO.sendRequest(requestSettings, null)
	    })
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

// gather list of repertoire metadata for project
// TODO: this function should transform the normalized metadata
// records into the denormalized AIRR metadata format.
agaveIO.gatherRepertoireMetadataForProject = function(projectUuid) {

    return ServiceAccount.getToken()
	.then(function(token) {
            // get repertoire objects first
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'repertoire');
        })
	.then(function(models) {
            // put into AIRR format
            var repertoireMetadata = [];
            for (var i in models) {
                repertoireMetadata.push(models[i].value);
            }
            return repertoireMetadata;
        })
	.then(function(models) {
            // save vdjserver project uuid in custom field
            for (var i in models) {
                models[i]['study']['vdjserver_uuid'] = projectUuid;
            }
            return models;
        });
};

//
/////////////////////////////////////////////////////////////////////
//
// Study metadata
//

agaveIO.getMetadataForType = function(accessToken, projectUuid, type) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	var requestSettings = {
	    host:     agaveSettings.hostname,
	    method:   'GET',
	    path:   '/meta/v2/data?q='
		+ encodeURIComponent('{'
				     + '"name": "' + type + '",'
				     + '"associationIds": "' + projectUuid + '"'
				     + '}')
		+ '&limit=50&offset=' + offset,
	    rejectUnauthorized: false,
	    headers: {
		'Authorization': 'Bearer ' + accessToken
	    }
	};

	return agaveIO.sendRequest(requestSettings, null)
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

agaveIO.createMetadataForType = function(projectUuid, type, value) {

    var deferred = Q.defer();

    var postData = {
	associationIds: [ projectUuid ],
        name: type,
        value: value,
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     '/meta/v2/data',
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.getMetadataColumnsForType = function(projectUuid, type) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'GET',
		path:   '/meta/v2/data?q='
		    + encodeURIComponent('{'
		    + '"name": "' + agaveSettings.metadataColumns[type] + '",'
		    + '"associationIds": "' + projectUuid + '"'
		    + '}')
		    + '&limit=1',
		rejectUnauthorized: false,
		headers: {
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, null)
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

agaveIO.createMetadataColumnsForType = function(projectUuid, type, value, metadataUuid) {

    var deferred = Q.defer();

    var postData = {
	associationIds: [ projectUuid ],
        name: agaveSettings.metadataColumns[type],
        value: value,
    };

    postData = JSON.stringify(postData);

    ServiceAccount.getToken()
	.then(function(token) {
	    var path = '/meta/v2/data'
	    if (metadataUuid) path = path + '/' + metadataUuid;
	    var requestSettings = {
		host:     agaveSettings.hostname,
		method:   'POST',
		path:     path,
		rejectUnauthorized: false,
		headers: {
		    'Content-Type':   'application/json',
		    'Content-Length': Buffer.byteLength(postData),
		    'Authorization': 'Bearer ' + ServiceAccount.accessToken()
		}
	    };

	    return agaveIO.sendRequest(requestSettings, postData);
	})
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

//
/////////////////////////////////////////////////////////////////////
//
// Sample groups metadata
//

agaveIO.getSampleGroupsMetadata = function(accessToken, projectUuid) {

    var deferred = Q.defer();

    var models = [];

    var doFetch = function(offset) {
	var requestSettings = {
	    host:     agaveSettings.hostname,
	    method:   'GET',
	    path:   '/meta/v2/data?q='
		+ encodeURIComponent('{'
				     + '"name": "sampleGroup",'
				     + '"associationIds": "' + projectUuid + '"'
				     + '}')
		+ '&limit=50&offset=' + offset,
	    rejectUnauthorized: false,
	    headers: {
		'Authorization': 'Bearer ' + accessToken
	    }
	};

	return agaveIO.sendRequest(requestSettings, null)
            .then(function(responseObject) {
		var result = responseObject.result;
		if (result.length > 0) {
		    // maybe more data
		    models = models.concat(result);
		    var newOffset = offset + result.length;
		    doFetch(newOffset);
		} else {
		    // no more data
		    deferred.resolve(models);
		}
	    })
            .fail(function(errorObject) {
		deferred.reject(errorObject);
            });
    }

    doFetch(0);

    return deferred.promise;
};

//
/////////////////////////////////////////////////////////////////////
//
// Higher level composite functions
//

agaveIO.addJobPermissionsForProjectUsers = function(projectUuid, jobId) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	})
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = projectUsernames.map(function(username) {

                return function() {
                    return agaveIO.addUsernameToJobPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        jobId
                    );
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// 
agaveIO.addMetadataPermissionsForProjectUsers = function(projectUuid, metadataUuid) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
	})
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = projectUsernames.map(function(username) {

                return function() {
                    return agaveIO.addUsernameToMetadataPermissions(
                        username,
                        ServiceAccount.accessToken(),
                        metadataUuid
                    );
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};

// delete all metadata for type for a project
agaveIO.deleteAllMetadataForType = function(projectUuid, type) {

    var deferred = Q.defer();

    ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, type);
	})
        .then(function(metadataList) {

	    console.log('VDJ-API INFO: agaveIO.deleteAllMetadataForType - deleting ' + metadataList.length + ' metadata entries for type: ' + type);
            var promises = metadataList.map(function(metadata) {

                return function() {
                    return agaveIO.deleteMetadata(ServiceAccount.accessToken(), metadata.uuid);
                };
            });

            return promises.reduce(Q.when, new Q());
	})
        .then(function() {
            deferred.resolve();
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};
