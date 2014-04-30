
'use strict';

// Settings
var agaveSettings = require('../../config/agaveSettings');

// Models
var ServiceAccount = require('../../models/serviceAccount');

// Promises
var Q = require('q');

var agaveIO  = {};
module.exports = agaveIO;

var isJSON = function(input) {
    try {
        JSON.parse(input);
    }
    catch (error) {
        return false;
    }

    return true;
};

agaveIO.sendRequest = function(requestSettings, postData) {

    var deferred = Q.defer();

    var request = require('https').request(requestSettings, function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {

            var responseObject;

            if (output && isJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.status && responseObject.status.toLowerCase() === 'success') {
                deferred.resolve(responseObject);
            }
            else {
                console.log('Agave returned an error. it is: ' + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error.'));
            }

        });
    });

    request.on('error', function() {
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

            if (output && isJSON(output)) {
                responseObject = JSON.parse(output);
            }
            else {
                deferred.reject(new Error('Agave response is not json'));
            }

            if (responseObject && responseObject.access_token && responseObject.refresh_token && responseObject.token_type && responseObject.expires_in) {
                deferred.resolve(responseObject);
            }
            else {
                console.log('Agave returned an error. it is: ' + JSON.stringify(responseObject));
                deferred.reject(new Error('Agave response returned an error'));
            }

        });
    });

    request.on('error', function() {
        deferred.reject(new Error('Agave connection error'));
    });

    if (postData) {
        // Request body parameters
        request.write(postData);
    }

    request.end();

    return deferred.promise;
};

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
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

    console.log("refreshToken auth is: " + JSON.stringify(auth));

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

// Deletes a token
agaveIO.deleteToken = function(auth) {

    var deferred = Q.defer();

    var postData = 'token=' + auth.password;

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        auth:     agaveSettings.clientKey + ':' + agaveSettings.clientSecret,
        path:     '/revoke',
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

// Fetches an internal user token based on the supplied auth object and returns the auth object with token data on success
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
        path:     '/meta/v2/data?q=' + encodeURIComponent('{"name":"profile","owner":"' + username + '"}'),
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

agaveIO.createProject = function(projectName) {

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
        path:     '/files/v2/media/system/data.vdjserver.org//projects/',
        rejectUnauthorized: false,
        headers: {
            //'Content-Type':   'application/json',
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

    //postData = JSON.stringify(postData);

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/meta/v2/data/' + uuid + '/pems',
        rejectUnauthorized: false,
        headers: {
            //'Content-Type':   'application/json',
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
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
                    + '"name":"projectFile",'
                    + '"value.projectUuid":"' + projectUuid + '"'
                + '}'),
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

/*
agaveIO.
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
*/

agaveIO.getFilePermissions = function(accessToken, filePath) {

    var deferred = Q.defer();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/files/v2/pems/system/data.vdjserver.org//projects/' + filePath,
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
        path:     '/files/v2/listings/system/data.vdjserver.org//projects/' + projectUuid + '/files',
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

agaveIO.addUsernameToFullFilePermissions = function(username, accessToken, filePath) {

    var deferred = Q.defer();

    var postData = 'username=' + username + '&all=true&recursive=true';

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/data.vdjserver.org//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
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
/*
agaveIO.addUsernameToLimitedFilePermissions = function(username, accessToken, filePath) {

    var deferred = Q.defer();

    console.log("opening limitedFilePem. username is: " + username + " and accessToken is: " + accessToken + " and filePath is: " + filePath);

    var postData = 'username=' + username + '&read=true&execute=true&recursive=true';

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/data.vdjserver.org//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
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
*/
agaveIO.removeUsernameFromFilePermissions = function(username, accessToken, filePath) {

    var deferred = Q.defer();

    var postData = 'username=' + username + '&read=false&write=false&execute=false';

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'POST',
        path:     '/files/v2/pems/system/data.vdjserver.org//projects/' + filePath,
        rejectUnauthorized: false,
        headers: {
            'Content-Length': postData.length,
            'Authorization': 'Bearer ' + accessToken
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

agaveIO.getPasswordResetMetadata = function(uuid) {

    var deferred = Q.defer();

    var serviceAccount = new ServiceAccount();

    var requestSettings = {
        host:     agaveSettings.hostname,
        method:   'GET',
        path:     '/meta/v2/data?q=' + encodeURIComponent('{"name":"passwordReset", "uuid":"' + uuid + '", "owner":"' + serviceAccount.username + '"}'),
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
