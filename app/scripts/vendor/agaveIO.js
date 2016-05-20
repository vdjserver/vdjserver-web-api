
'use strict';

// Settings
var agaveSettings = require('../config/agaveSettings');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Node Libraries
var Q = require('q');
var _ = require('underscore');
var jsonApprover = require('json-approver');

var agaveIO  = {};
module.exports = agaveIO;

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
                    console.log('Agave response is not json.');
                }

                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject);
            }
            else {

                if (agaveSettings.debugConsole === true) {
                    console.error('Agave returned an error. it is: ' + JSON.stringify(responseObject));
                    console.error('Agave returned an error. it is: ' + responseObject);
                }

                deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
            }

        });
    });

    request.on('error', function(error) {
        if (agaveSettings.debugConsole === true) {
            console.error('Agave connection error.' + JSON.stringify(error));
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
                    console.error('Agave token response is not json.');
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
                    console.error('Agave returned a token error. it is: ' + JSON.stringify(responseObject));
                    console.error('Agave returned a token error. it is: ' + responseObject);
                }

                deferred.reject(new Error('Agave response returned an error: ' + JSON.stringify(responseObject)));
            }

        });
    });

    request.on('error', function() {

        if (agaveSettings.debugConsole === true) {
            console.error('Agave token connection error.');
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
            'Content-Length': postData.length
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

    var postData = 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/token',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/profiles/v2/',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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
            'Content-Length': postData.length,
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data?q=' + encodeURIComponent('{"name":"profile","owner":"' + username + '"}') + '&limit=5000',
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.createProjectMetadata = function(projectName) {

    var deferred = Q.defer();

    var postData = {
        name: 'project',
        value: {
            'name': projectName
        }
    };

    postData = JSON.stringify(postData);

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.createProjectDirectory = function(directory) {

    var deferred = Q.defer();

    var postData = 'action=mkdir&path=' + directory;

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'PUT',
        path:     '/files/v2/media/system/' + agaveSettings.storageSystem + '//projects/',
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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

agaveIO.addUsernameToMetadataPermissions = function(username, accessToken, uuid) {

    var deferred = Q.defer();

    var postData = 'username=' + username + '&permission=READ_WRITE';

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
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

agaveIO.getProjectFileMetadataPermissions = function(accessToken, projectUuid) {

    var deferred = Q.defer();

    var requestSettings = {
        host:   agaveSettings.hostname,
        method: 'GET',
        path:   '/meta/v2/data?q='
                + encodeURIComponent('{'
                    + '"name": { $in: ["projectFile", "projectJobFile"] },'
                    + '"value.projectUuid":"' + projectUuid + '"'
                + '}')
                + '&limit=5000'
                ,
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

agaveIO.getFileHistory = function(relativePath) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/history/system/' + agaveSettings.storageSystem + '//projects/' + relativePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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
            'Content-Length': postData.length,
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

agaveIO.addUsernameToFullFilePermissions = function(username, accessToken, filePath) {

    var deferred = Q.defer();

    var postData = {
        'username': username,
        'permission': 'ALL',
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
            'Content-Length': postData.length,
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
            'Content-Length': postData.length,
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getUserVerificationMetadata = function(username) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data?q='
                  + encodeURIComponent(
                        '{"name":"userVerification",'
                        + ' "value.username":"' + username + '",'
                        + ' "owner":"' + serviceAccount.username + '"'
                        + '}'
                  )
                  + '&limit=5000'
                  ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data/' + verificationId,
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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

agaveIO.createPasswordResetMetadata = function(username) {

    var deferred = Q.defer();

    var postData = {
        name: 'passwordReset',
        value: {
            'username': username
        }
    };

    postData = JSON.stringify(postData);

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getJobMetadata = function(projectUuid, jobUuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

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
                    + '&limit=5000'
                    ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getJobMetadataForProject = function(projectUuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

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
                    + '&limit=5000'
                    ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getPasswordResetMetadata = function(uuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data?q='
                  + encodeURIComponent(
                        '{"name":"passwordReset",'
                        + ' "uuid":"' + uuid + '",'
                        + ' "owner":"' + serviceAccount.username + '"}'
                  )
                  + '&limit=5000'
                  ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getMetadata = function(uuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data/' + uuid,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.deleteMetadata = function(uuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'DELETE',
        path:     '/meta/v2/data/' + uuid,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'PUT',
        path:     '/profiles/v2/' + user.username + '/',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/x-www-form-urlencoded',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getJobOutput = function(jobId) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/jobs/v2/' + jobId,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getJobOutputFileListings = function(projectUuid, relativeArchivePath) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/listings/system'
                  + '/' + agaveSettings.storageSystem
                  + '//projects/' + projectUuid
                  + '/analyses'
                  + '/' + relativeArchivePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
        },
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

agaveIO.createProjectJobFileMetadata = function(projectUuid, jobUuid, jobFileListingName, jobFileListingLength, jobName, relativeArchivePath) {

    var deferred = Q.defer();

    var postData = {
        name: 'projectJobFile',
        value: {
            projectUuid: projectUuid,
            jobUuid: jobUuid,
            fileType: 2,
            name: jobFileListingName,
            length: jobFileListingLength,
            isDeleted: false,
            readDirection: '',
            relativeArchivePath: relativeArchivePath,
            jobName: jobName,
            publicAttributes: {
                'tags': [],
            },
        },
    };

    postData = JSON.stringify(postData);

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization':  'Bearer ' + serviceAccount.accessToken,
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

agaveIO.getProjectJobFileMetadatas = function(projectUuid, jobId) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

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
                    + '&limit=5000'
                    ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.createFileMetadata = function(fileUuid, projectUuid, fileType, name, length, readDirection, tags) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var postData = {
        associationIds: [
            fileUuid,
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

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken
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

agaveIO.getFileDetail = function(relativePath) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/listings/system/' + agaveSettings.storageSystem + '//projects/' + relativePath,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
        },
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

agaveIO.getProjectFileMetadataByFilename = function(projectUuid, fileUuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:   agaveSettings.hostname,
        method: 'GET',
        path:   '/meta/v2/data?q='
                + encodeURIComponent('{'
                    + '"name": "projectFile",'
                    + '"value.projectUuid": "' + projectUuid + '",'
                    + '"associationIds": { $in: ["' + fileUuid + '"] }'
                + '}')
                + '&limit=5000'
                ,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data',
        rejectUnauthorized: false,
        headers: {
            'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization':  'Bearer ' + serviceAccount.accessToken
        },
    };

    agaveIO.sendRequest(requestSettings, postData)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        })
        ;

    return deferred.promise;
};

agaveIO.getCommunityDataMetadata = function() {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

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
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:   agaveSettings.hostname,
        method: 'GET',
        path:   '/profiles/v2/' + username,
        rejectUnauthorized: false,
        headers: {
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
        }
    };

    agaveIO.sendRequest(requestSettings, null)
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

    var serviceAccount = new ServiceAccount();

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
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
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

agaveIO.launchJob = function(jobDataString) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/jobs/v2/'
                  ,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': jobDataString.length,
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + serviceAccount.accessToken,
        },
    };

    agaveIO.sendRequest(requestSettings, jobDataString)
        .then(function(responseObject) {
            deferred.resolve(responseObject.result);
        })
        .fail(function(errorObject) {
            deferred.reject(errorObject);
        });

    return deferred.promise;
};
