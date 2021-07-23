
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
var config = require('../config/config');

// Models
var ServiceAccount = require('../models/serviceAccount');
var MetadataPermissions = require('../models/metadataPermissions');

// Processing
var webhookIO = require('../vendor/webhookIO');
var airr = require('../vendor/airr');

// Node Libraries
var _ = require('underscore');
var jsonApprover = require('json-approver');
var FormData = require('form-data');

//
// Generic send request
//
agaveIO.sendRequest = function(requestSettings, postData) {

    return new Promise(function(resolve, reject) {
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
                    reject(new Error('Agave response is not json. Raw output: ' + output));
                }

                if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                    resolve(responseObject);
                }
                else {
                    reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
                }

            });
        });

        request.on('error', function(error) {
            reject(new Error('Agave connection error'));
        });

        if (postData) {
            // Request body parameters
            request.write(postData);
        }

        request.end();
    });
};

//
// This is specific to sending multi-part form post data, i.e. uploading files
//
agaveIO.sendFormRequest = function(requestSettings, formData) {

    return new Promise(function(resolve, reject) {
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
                    reject(new Error('Agave response is not json'));
                }

                if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                    resolve(responseObject);
                }
                else {
                    reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
                }
            });
        });

        request.on('error', function(error) {
            reject(new Error('Agave connection error. ' + JSON.stringify(error)));
        });
    });
};

agaveIO.sendTokenRequest = function(requestSettings, postData) {

    return new Promise(function(resolve, reject) {
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
                    reject(new Error('Agave response is not json'));
                }

                if (responseObject
                    && responseObject.access_token
                    && responseObject.refresh_token
                    && responseObject.token_type
                    && responseObject.expires_in)
                {
                    resolve(responseObject);
                } else {
                    reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
                }
            });
        });

        request.on('error', function() {
            reject(new Error('Agave connection error'));
        });

        if (postData) {
            // Request body parameters
            request.write(postData);
        }

        request.end();
    });
};

//
// For retrieving file data
//
agaveIO.sendFileRequest = function(requestSettings, postData) {

    return new Promise(function(resolve, reject) {
        var request = require('https').request(requestSettings, function(response) {

            var output = '';

            response.on('data', function(chunk) {
                output += chunk;
            });

            response.on('end', function() {

                // do not attempt to parse
                resolve(output);

            });
        });

        request.on('error', function(error) {
            reject(new Error('Agave connection error'));
        });

        if (postData) {
            // Request body parameters
            request.write(postData);
        }

        request.end();
    });
};

//
// For checking existence of files/folders
// does not reject promise with a 404 error
//
agaveIO.sendCheckRequest = function(requestSettings, postData) {

    return new Promise(function(resolve, reject) {
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
                    reject(new Error('Agave response is not json'));
                }

                if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                    resolve(responseObject);
                } else {
                    if (responseObject.status.toLowerCase() === 'error' && response.statusCode == 404) {
                        resolve(responseObject);
                    } else {
                        reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
                    }
                }           
            });
        });

        request.on('error', function(error) {
            reject(new Error('Agave connection error'));
        });

        if (postData) {
            // Request body parameters
            request.write(postData);
        }

        request.end();
    });
};

// Fetches a user token based on the supplied auth object
// and returns the auth object with token data on success
agaveIO.getToken = function(auth) {
    if (config.shouldInjectError("agaveIO.getToken")) return config.performInjectError();

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

    return agaveIO.sendTokenRequest(requestSettings, postData);
};

// Refreshes a token and returns it on success
agaveIO.refreshToken = function(auth) {
    if (config.shouldInjectError("agaveIO.refreshToken")) return config.performInjectError();

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

    return agaveIO.sendTokenRequest(requestSettings, postData);
};

agaveIO.createUser = function(user) {
    if (config.shouldInjectError("agaveIO.createUser")) return config.performInjectError();

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getAgaveUserProfile = function(accessToken, username) {
    if (config.shouldInjectError("agaveIO.getAgaveUserProfile")) return config.performInjectError();

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createUserProfile = function(user, userAccessToken) {
    if (config.shouldInjectError("agaveIO.createUserProfile")) return config.performInjectError();

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getUserProfile = function(username) {
    if (config.shouldInjectError("agaveIO.getUserProfile")) return config.performInjectError();

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

//
// Metadata operations
//

// generic metadata query
agaveIO.getMetadataForType = function(accessToken, projectUuid, type) {
    if (config.shouldInjectError("agaveIO.getMetadataForType")) return config.performInjectError();

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

// generic metadata creation
agaveIO.createMetadataForType = function(projectUuid, type, value) {
    if (config.shouldInjectError("agaveIO.createMetadataForType")) return config.performInjectError();

    var postData = {
        associationIds: [ projectUuid ],
        name: type,
        value: value,
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// create metadata record for a private project
agaveIO.createProjectMetadata = function(project) {
    if (config.shouldInjectError("agaveIO.createProjectMetadata")) return config.performInjectError();

    var postData = {
        name: 'private_project',
        value: project
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProjectMetadata = function(accessToken, projectUuid) {
    if (config.shouldInjectError("agaveIO.getProjectMetadata")) return config.performInjectError();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + projectUuid,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createProjectDirectory = function(directory) {

    var postData = 'action=mkdir&path=' + directory;

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.addUsernameToMetadataPermissions = function(username, accessToken, uuid) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.removeUsernameFromMetadataPermissions = function(username, accessToken, uuid) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'DELETE',
        path:     '/meta/v2/data/' + uuid + '/pems/' + username,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getMetadataPermissions = function(accessToken, uuid) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getMetadataPermissionsForUser = function(accessToken, uuid, username) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid + '/pems/' + username,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProjectFileMetadata = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getProjectFiles = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

//
// Retrieve all project associated metadata
// This relies upon associationIds having the project uuid
// This performs multiple requests to get all of the records
//
agaveIO.getAllProjectAssociatedMetadata = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getFilePermissions = function(accessToken, filePath) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getFileListings = function(accessToken, projectUuid) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//projects/' + projectUuid + '/files',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.enumerateFileListings = function(projectUuid) {

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
                    return doFetch(newOffset, filePath);
                } else {
                    // nothing left to enumerate
                    if (dirStack.length == 0)
                        return Promise.resolve(pathList);
                    else
                        return doFetch(0, dirStack.pop());
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    pathList.push('');
    return doFetch(0, '');
};

agaveIO.getFileHistory = function(relativePath) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProjectFileContents = function(projectUuid, fileName) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(fileData);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.addUsernameToJobPermissions = function(username, accessToken, jobId) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.removeUsernameFromJobPermissions = function(username, accessToken, jobId) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setJobPermissions = function(username, permission, accessToken, jobId) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.addUsernameToFullFilePermissions = function(username, accessToken, filePath, recursive) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setFilePermissionsForProjectUsers = function(projectUuid, filePath, recursive) {

    return ServiceAccount.getToken()
        .then(function(token) {
            // get list of users from project metadata permissions
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                var username = projectUsernames[i];
                promises[i] = agaveIO.addUsernameToFullFilePermissions(
                    username,
                    ServiceAccount.accessToken(),
                    filePath,
                    recursive
                );
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setFilePermissions = function(accessToken, username, permission, recursive, filePath) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.removeUsernameFromFilePermissions = function(username, accessToken, filePath) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.removeAllFilePermissions = function(accessToken, filePath, recursive) {

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

    return agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createUserVerificationMetadata = function(username) {
    if (config.shouldInjectError("agaveIO.createUserVerificationMetadata")) return config.performInjectError();

    var postData = {
        name: 'userVerification',
        value: {
            'username': username,
            'isVerified': false,
        },
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getUserVerificationMetadata = function(username) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.verifyUser = function(username, verificationId) {

    var postData = {
        name: 'userVerification',
        value: {
            'username': username,
            'isVerified': true,
        },
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createPasswordResetMetadata = function(username) {

    var postData = {
        name: 'passwordReset',
        value: {
            'username': username
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createJobMetadata = function(projectUuid, jobUuid, secondaryInputs) {

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

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.updateJobMetadata = function(uuid, name, value) {

    var postData = {
        associationIds: [ value.projectUuid, value.jobUuid ],
        name: name,
        value: value
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobMetadata = function(projectUuid, jobUuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobMetadataForProject = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getJobMetadataForJob = function(jobUuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobMetadataForArchivedJob = function(jobUuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobsForProject = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getPasswordResetMetadata = function(uuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getMetadata = function(uuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.updateMetadata = function(uuid, name, value, associationIds) {

    var postData = {
        name: name,
        value: value
    };
    if (associationIds) postData.associationIds = associationIds;

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            console.log('agaveIO.updateMetadata error: ' + errorObject);
            return Promise.reject(errorObject);
        });
};

agaveIO.deleteMetadata = function(accessToken, uuid) {

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'DELETE',
        path:     '/meta/v2/data/' + uuid,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.updateUserPassword = function(user) {

    var postData = 'username='  + user.username
                 + '&password=' + user.password
                 + '&email='    + user.email;

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobOutput = function(jobId) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobPermissions = function(jobId) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobOutputFileListings = function(projectUuid, relativeArchivePath) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getJobProcessMetadataFileListing = function(projectUuid, relativeArchivePath) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getJobProcessMetadataFileContents = function(projectUuid, relativeArchivePath) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(fileData);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createProcessMetadata = function(projectUuid, jobUuid, data) {

    var postData = {
        name: 'processMetadata',
        associationIds: [ projectUuid, jobUuid ],
        value: data
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProcessMetadataForProject = function(projectUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.getProcessMetadataForJob = function(jobUuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createProjectJobFileMetadata = function(projectUuid, jobUuid, jobFileListingName, jobFileListingLength, jobFileType, jobName, relativeArchivePath) {

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

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProjectJobFileMetadatas = function(projectUuid, jobId) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.createFileMetadata = function(fileUuid, projectUuid, fileType, name, length, readDirection, tags) {

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

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getFileDetail = function(relativePath) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getProjectFileMetadataByFilename = function(projectUuid, fileUuid) {

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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

agaveIO.createFeedbackMetadata = function(feedback, username, email) {

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

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.validateToken = function(token) {

    var requestSettings = {
        host:   agaveSettings.hostname,
        method: 'GET',
        path:   '/systems/v2/',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + token,
        }
    };

    return agaveIO.sendRequest(requestSettings, null)
        .then(function(responseObject) {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(new Error('Unable to validate token.'));
        });
};

agaveIO.isDuplicateUsername = function(username) {
    if (config.shouldInjectError("agaveIO.isDuplicateUsername")) return config.performInjectError();

    return ServiceAccount.getToken()
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
            return Promise.resolve(true);
        })
        .catch(function(errorObject) {
            return Promise.resolve(false);
        });
};

agaveIO.createJobArchiveDirectory = function(projectUuid, relativeArchivePath) {

    var postData = 'action=mkdir&path=' + relativeArchivePath;

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.uploadFileToJobArchiveDirectory = function(archivePath, filename, filedata) {

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.uploadFileToProjectDirectory = function(projectUuid, filename, filedata) {

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.uploadFileToProjectTempDirectory = function(projectUuid, filename, filedata) {

    // filedata should be data stored in a Buffer()
    var form = new FormData();
    form.append('fileToUpload', filedata);
    form.append('filename', filename);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.launchJob = function(jobDataString) {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

//
/////////////////////////////////////////////////////////////////////
//
// Community data
//

agaveIO.setCommunityFilePermissions = function(projectUuid, filePath, toCommunity) {

    return ServiceAccount.getToken()
        .then(function(token) {
            // get all user permissions
            var requestSettings = {
                host:     agaveSettings.hostname,
                method:   'GET',
                path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
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
            var promises = [];
            for (var i = 0; i < permissionsList.length; i++) {
                var entry = permissionsList[i];
                if (entry.username != agaveSettings.serviceAccountKey)
                    promises[i] = agaveIO.setFilePermissions(ServiceAccount.accessToken(), entry.username, 'NONE', false, '/projects/' + filePath);
            }

            return Promise.allSettled(promises);
        })
        .then(function(responseObject) {
            if (toCommunity) {
                // guest account READ only
                var postData = 'username=' + agaveSettings.guestAccountKey + '&permission=READ&recursive=false';

                var requestSettings = {
                    host:     agaveSettings.hostname,
                    method:   'POST',
                    path:     '/files/v2/pems/system/' + agaveSettings.storageSystem + '//projects/' + filePath,
                    rejectUnauthorized: false,
                    headers: {
                        'Content-Length': Buffer.byteLength(postData),
                        'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
                    }
                };

                return agaveIO.sendRequest(requestSettings, postData);
            } else {
                return agaveIO.setFilePermissionsForProjectUsers(projectUuid, filePath, false);
            }
        })
        .then(function(responseObject) {
            return Promise.resolve(responseObject);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

//
agaveIO.createCommunityCacheDirectory = function(directory) {

    var postData = 'action=mkdir&path=' + directory;

    return ServiceAccount.getToken()
        .then(function(token) {
            var requestSettings = {
                host:     agaveSettings.hostname,
                method:   'PUT',
                path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//community/cache/',
                rejectUnauthorized: false,
                headers: {
                    'Content-Length': Buffer.byteLength(postData),
                    'Authorization': 'Bearer ' + ServiceAccount.accessToken(),
                }
            };

            return agaveIO.sendRequest(requestSettings, postData);
        })
        .then(function(responseObject) {
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};


/*
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
                return Promise.resolve();
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
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });

    return deferred.promise;
};
*/

/*
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
                return Promise.resolve();
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
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });

    return deferred.promise;
};
*/

agaveIO.setCommunityJobPermissions = function(projectUuid, jobId, toCommunity) {

    var jobFiles = [];
    return ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getProjectJobFileMetadatas(projectUuid, jobId);
        })
        .then(function(_jobFiles) {
            jobFiles = _jobFiles;

            // permissions on the job archive path directory
            if (jobFiles.length > 0) {
                return agaveIO.setCommunityFilePermissions(projectUuid, projectUuid + '/analyses/' + jobFiles[0].value.relativeArchivePath, toCommunity);
            }
        })
        .then(function() {
            // permissions on each job file
            var promises = [];
            for (var i = 0; i < jobFiles.length; i++) {
                var file = jobFiles[i];
                promises[i] = agaveIO.setCommunityFilePermissions(projectUuid, projectUuid + '/analyses/' + file.value.relativeArchivePath + '/' + file.value.name, toCommunity);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            // permissions for the job itself
            return agaveIO.getJobPermissions(jobId);
        })
        .then(function(permissionsList) {
            // remove permissions
            var promises = [];
            for (var i = 0; i < permissionsList.length; i++) {
                var entry = permissionsList[i];
                if (entry.username != agaveSettings.serviceAccountKey)
                    promises[i] = agaveIO.removeUsernameFromJobPermissions(entry.username, ServiceAccount.accessToken(), jobId);
            }
 
            return Promise.allSettled(promises);
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
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

/*
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
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });

    return deferred.promise;
};
*/

agaveIO.clearCommunityMetadataPermissions = function(uuid) {

    return ServiceAccount.getToken()
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
            var promises = [];
            for (var i = 0; i < permissionsList.length; i++) {
                var entry = permissionsList[i];
                if (entry.username != agaveSettings.serviceAccountKey)
                    promises[i] = agaveIO.removeUsernameFromMetadataPermissions(entry.username, ServiceAccount.accessToken(), uuid);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setMetadataPermissionsForCommunity = function(uuid) {

    return ServiceAccount.getToken()
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
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setMetadataPermissionsForProject = function(projectUuid, uuid) {

    return ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.clearCommunityMetadataPermissions(uuid);
        })
        .then(function() {
            return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, uuid);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.setCommunityMetadataPermissions = function(projectUuid, toCommunity) {

    return agaveIO.getAllProjectAssociatedMetadata(projectUuid)
        .then(function(metadataList) {
            var promises = [];
            for (var i = 0; i < metadataList.length; i++) {
                var entry = metadataList[i];
                if (toCommunity) promises[i] = agaveIO.setMetadataPermissionsForCommunity(entry.uuid);
                else promises[i] = agaveIO.setMetadataPermissionsForProject(projectUuid, entry.uuid);
            }

            return Promise.allSettled(promises);
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
                var promises = [];
                for (var i = 0; i < permissionsList.length; i++) {
                    var entry = permissionsList[i];
                    if (entry.username == agaveSettings.serviceAccountKey) continue;
                    else if (entry.username == agaveSettings.guestAccountKey) continue;
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
                        promises[i] = agaveIO.sendRequest(requestSettings, postData);
                    }
                }

                return Promise.allSettled(promises);
            } else {
                // give users full permissions on project metadata
                return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, projectUuid);
            }
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getCommunityDataMetadata = function() {

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createCommunityFilePostit = function(projectUuid, path) {

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

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createPublicFilePostit = function(url, unlimited, maxUses, lifetime) {

    var postData = {
        url: url,
        method: 'GET'
    };
    if (unlimited) {
        postData["unlimited"] = true;
    } else {
        postData["maxUses"] = maxUses;
        postData["lifetime"] = lifetime;
    }
    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

//
/////////////////////////////////////////////////////////////////////
//
// Project load/unload from VDJServer ADC data repository
//

//
// Right now, all the project load/unload metadata is owned by the
// vdj account, no permissions for project users are given.
//

agaveIO.createProjectLoadMetadata = function(projectUuid, collection) {

    var postData = {
        name: 'projectLoad',
        associationIds: [ projectUuid ],
        value: {
            collection: collection,
            shouldLoad: true,
            isLoaded: false,
            repertoireMetadataLoaded: false,
            rearrangementDataLoaded: false
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// there should be only a single metadata record
agaveIO.getProjectLoadMetadata = function(projectUuid, collection) {

    return ServiceAccount.getToken()
        .then(function(token) {
            var requestSettings = {
                host:     agaveSettings.hostname,
                method:   'GET',
                path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{'
                            + '"name":"projectLoad",'
                            + '"value.collection":"' + collection + '",'
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// get list of projects to be loaded
agaveIO.getProjectsToBeLoaded = function(collection) {

    var models = [];

    var doFetch = function(offset) {
        return ServiceAccount.getToken()
            .then(function(token) {
                var requestSettings = {
                    host:     agaveSettings.hostname,
                    method:   'GET',
                    path:     '/meta/v2/data?q='
                        + encodeURIComponent('{"name":"projectLoad","value.collection":"' + collection +  '","value.shouldLoad":true,"value.isLoaded":false}')
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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

// status record for a rearrangement load
agaveIO.createRearrangementLoadMetadata = function(projectUuid, repertoire_id, collection) {

    var postData = {
        name: 'rearrangementLoad',
        associationIds: [ projectUuid ],
        value: {
            repertoire_id: repertoire_id,
            collection: collection,
            isLoaded: false,
            load_set: 0
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// get list of repertoires that need their rearrangement data to be loaded
agaveIO.getRearrangementsToBeLoaded = function(projectUuid, collection) {

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
                                + '"value.collection":"' + collection + '",'
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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

// Collect list of repertoire metadata for project.
// This function transforms the normalized metadata
// records into the denormalized AIRR metadata format.
agaveIO.gatherRepertoireMetadataForProject = function(projectUuid, keep_uuids) {

    var msg = null;
    var repertoireMetadata = [];
    var subjectMetadata = {};
    var sampleMetadata = {};
    var dpMetadata = {};
    var projectMetadata = null;

    return ServiceAccount.getToken()
        .then(function(token) {
            // get the project metadata
            return agaveIO.getProjectMetadata(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(_projectMetadata) {
            projectMetadata = _projectMetadata;

            // get repertoire objects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'repertoire');
        })
        .then(function(models) {
            // put into AIRR format
            var study = projectMetadata.value;
            var blank = airr.repertoireTemplate();

            // only the AIRR fields
            for (var o in blank['study']) {
                blank['study'][o] = study[o];
            }
            // always save vdjserver project uuid in custom field
            blank['study']['vdjserver_uuid'] = projectUuid;

            for (var i in models) {
                var model = models[i].value;
                model['study'] = blank['study']
                repertoireMetadata.push(model);
            }

            // get subject objects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'subject');
        })
        .then(function(models) {
            for (var i in models) {
                subjectMetadata[models[i].uuid] = models[i].value;
            }

            // get sample objects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'sample');
        })
        .then(function(models) {
            for (var i in models) {
                sampleMetadata[models[i].uuid] = models[i].value;
            }

            // get data processing objects
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, 'data_processing');
        })
        .then(function(models) {
            for (var i in models) {
                dpMetadata[models[i].uuid] = models[i].value;
            }
        })
        .then(function() {
            // put into AIRR format
            for (var i in repertoireMetadata) {
                var rep = repertoireMetadata[i];
                var subject = subjectMetadata[rep['subject']['vdjserver_uuid']];
                if (! subject) {
                    console.error('VDJ-API ERROR: agaveIO.gatherRepertoireMetadataForProject, cannot collect subject: '
                                  + rep['subject']['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                }
                if (keep_uuids) subject['vdjserver_uuid'] = rep['subject']['vdjserver_uuid'];
                rep['subject'] = subject;

                var samples = [];
                for (var j in rep['sample']) {
                    var sample = sampleMetadata[rep['sample'][j]['vdjserver_uuid']];
                    if (! sample) {
                        console.error('VDJ-API ERROR: agaveIO.gatherRepertoireMetadataForProject, cannot collect sample: '
                                      + rep['sample'][j]['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                    }
                    if (keep_uuids) sample['vdjserver_uuid'] = rep['sample'][j]['vdjserver_uuid'];
                    samples.push(sample);
                }
                rep['sample'] = samples;

                var dps = [];
                for (var j in rep['data_processing']) {
                    var dp = dpMetadata[rep['data_processing'][j]['vdjserver_uuid']];
                    if (! dp) {
                        console.error('VDJ-API ERROR: agaveIO.gatherRepertoireMetadataForProject, cannot collect data_processing: '
                                      + rep['data_processing'][j]['vdjserver_uuid'] + ' for repertoire: ' + rep['repertoire_id']);
                    }
                    if (keep_uuids) dp['vdjserver_uuid'] = rep['data_processing'][j]['vdjserver_uuid'];
                    dps.push(dp);
                }
                rep['data_processing'] = dps;
            }

            return repertoireMetadata;
        });
};

//
/////////////////////////////////////////////////////////////////////
//
// AIRR Data Commons functions
//

// the global/system list of ADC repositories
// this should be a singleton metadata entry owned by service account
agaveIO.getSystemADCRepositories = function() {

    return ServiceAccount.getToken()
        .then(function(token) {
            var requestSettings = {
                host:     agaveSettings.hostname,
                method:   'GET',
                path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{"name":"adc_system_repositories",'
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
}

// ADC download cache status
// this should be a singleton metadata entry owned by service account
agaveIO.createADCDownloadCache = function() {
    if (config.shouldInjectError("agaveIO.createADCDownloadCache")) return config.performInjectError();

    var postData = {
        name: 'adc_cache',
        value: {
            enable_cache: false
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.getADCDownloadCache = function() {
    if (config.shouldInjectError("agaveIO.getADCDownloadCache")) return config.performInjectError();

    return ServiceAccount.getToken()
        .then(function(token) {
            var requestSettings = {
                host:     agaveSettings.hostname,
                method:   'GET',
                path:     '/meta/v2/data?q='
                    + encodeURIComponent(
                        '{"name":"adc_cache",'
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
}

// create metadata entry for cached ADC study
agaveIO.createCachedStudyMetadata = function(repository_id, study_id, should_cache) {

    var postData = {
        name: 'adc_cache_study',
        value: {
            repository_id: repository_id,
            study_id: study_id,
            should_cache: should_cache,
            is_cached: false,
            archive_file: null,
            download_url: null
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// get list of studies cache entries
agaveIO.getStudyCacheEntries = function(repository_id, study_id, should_cache, not_cached) {

    var models = [];

    var query = '{"name":"adc_cache_study"';
    if (repository_id) query += ',"value.repository_id":"' + repository_id + '"';
    if (study_id) query += ',"value.study_id":"' + study_id + '"';
    if (should_cache) query += ',"value.should_cache":true';
    if (not_cached) query += ',"value.is_cached":false';
    query += '}';

    var doFetch = function(offset) {
        return ServiceAccount.getToken()
            .then(function(token) {
                var requestSettings = {
                    host:     agaveSettings.hostname,
                    method:   'GET',
                    path:     '/meta/v2/data?q='
                        + encodeURIComponent(query)
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
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

// create metadata entry for cached ADC rearrangements for a single repertoire
agaveIO.createCachedRepertoireMetadata = function(repository_id, study_id, repertoire_id, should_cache) {

    var postData = {
        name: 'adc_cache_repertoire',
        value: {
            repository_id: repository_id,
            study_id: study_id,
            repertoire_id: repertoire_id,
            should_cache: should_cache,
            is_cached: false,
            archive_file: null,
            download_url: null
        }
    };

    postData = JSON.stringify(postData);

    return ServiceAccount.getToken()
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
            return Promise.resolve(responseObject.result);
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// get list of repertoire cache entries
agaveIO.getRepertoireCacheEntries = function(repository_id, study_id, repertoire_id, should_cache, not_cached, max_limit) {

    var models = [];

    var query = '{"name":"adc_cache_repertoire"';
    if (repository_id) query += ',"value.repository_id":"' + repository_id + '"';
    if (study_id) query += ',"value.study_id":"' + study_id + '"';
    if (repertoire_id) query += ',"value.repertoire_id":"' + repertoire_id + '"';
    if (should_cache) query += ',"value.should_cache":true';
    if (not_cached) query += ',"value.is_cached":false';
    query += '}';

    var limit = 50;
    if (max_limit) {
        if (max_limit < limit) limit = max_limit;
        if (max_limit < 1) return Promise.resolve([]);
    }

    var doFetch = function(offset) {
        return ServiceAccount.getToken()
            .then(function(token) {
                var requestSettings = {
                    host:     agaveSettings.hostname,
                    method:   'GET',
                    path:     '/meta/v2/data?q='
                        + encodeURIComponent(query)
                        + '&limit=' + limit + '&offset=' + offset,
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
                    if ((max_limit) && (models.length >= max_limit))
                        return Promise.resolve(models);
                    var newOffset = offset + result.length;
                    return doFetch(newOffset);
                } else {
                    // no more data
                    return Promise.resolve(models);
                }
            })
            .catch(function(errorObject) {
                return Promise.reject(errorObject);
            });
    }

    return doFetch(0);
};

//
/////////////////////////////////////////////////////////////////////
//
// Higher level composite functions
//

agaveIO.addJobPermissionsForProjectUsers = function(projectUuid, jobId) {

    return ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                var username = projectUsernames[i];
                promises[i] = agaveIO.addUsernameToJobPermissions(
                    username,
                    ServiceAccount.accessToken(),
                    jobId
                );
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

// set permissions on a metadata object
agaveIO.addMetadataPermissionsForProjectUsers = function(projectUuid, metadataUuid) {

    return ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), projectUuid);
        })
        .then(function(projectPermissions) {
            var metadataPermissions = new MetadataPermissions();

            var projectUsernames = metadataPermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var promises = [];
            for (var i = 0; i < projectUsernames.length; i++) {
                var username = projectUsernames[i];
                promises[i] = agaveIO.addUsernameToMetadataPermissions(
                    username,
                    ServiceAccount.accessToken(),
                    metadataUuid
                );
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};

agaveIO.createMetadataForTypeWithPermissions = function(projectUuid, type, value) {
    var object = null;
    return agaveIO.createMetadataForType(projectUuid, type, value)
        .then(function(_obj) {
            object = _obj;
            return agaveIO.addMetadataPermissionsForProjectUsers(projectUuid, object['uuid']);
        })
        .then(function() {
            return Promise.resolve(object);
        });
};

// delete all metadata for type for a project
agaveIO.deleteAllMetadataForType = function(projectUuid, type) {

    return ServiceAccount.getToken()
        .then(function(token) {
            return agaveIO.getMetadataForType(ServiceAccount.accessToken(), projectUuid, type);
        })
        .then(function(metadataList) {

            console.log('VDJ-API INFO: agaveIO.deleteAllMetadataForType - deleting ' + metadataList.length + ' metadata entries for type: ' + type);
            var promises = [];
            for (var i = 0; i < metadataList.length; i++) {
                var metadata = metadataList[i];
                promises[i] = agaveIO.deleteMetadata(ServiceAccount.accessToken(), metadata.uuid);
            }

            return Promise.allSettled(promises);
        })
        .then(function() {
            return Promise.resolve();
        })
        .catch(function(errorObject) {
            return Promise.reject(errorObject);
        });
};
