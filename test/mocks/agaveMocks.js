
'use strict';

// Settings
var agaveSettings = require('../../app/scripts/config/agaveSettings');

// Fixtures
var agaveRequestFixture  = require('../fixtures/agaveRequestFixture');
var agaveResponseFixture = require('../fixtures/agaveResponseFixture');

var AgaveMocks = {};
module.exports = AgaveMocks;

// generic Agave errors
AgaveMocks.genericGetError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .filteringRequestBody(function() {
            return '*';
        })
        .filteringPath(function(path) {
            return '/';
        })
        .get('/', '*')
        .reply(401, JSON.stringify({'error': 'error here!'}))
    ;

    return nock;
};

AgaveMocks.genericPutError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .filteringRequestBody(function() {
            return '*';
        })
        .filteringPath(function(path) {
            return '/';
        })
        .put('/', '*')
        .reply(401, JSON.stringify({'error': 'error here!'}))
    ;

    return nock;
};

AgaveMocks.genericPostError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .filteringRequestBody(function() {
            return '*';
        })
        .filteringPath(function(path) {
            return '/';
        })
        .post('/', '*')
        .reply(401, JSON.stringify({'error': 'error here!'}))
    ;

    return nock;
};

AgaveMocks.genericDeleteError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .filteringRequestBody(function() {
            return '*';
        })
        .filteringPath(function(path) {
            return '/';
        })
        .delete('/', '*')
        .reply(401, JSON.stringify({'error': 'error here!'}))
    ;

    return nock;
};

// Agave interaction mocks
AgaveMocks.getToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .post('/token', 'grant_type=password&scope=PRODUCTION&username=' + agaveRequestFixture.username + '&password=' + agaveRequestFixture.password)
        .reply(200, JSON.stringify(agaveResponseFixture.tokenSuccess))
    ;

    return nock;
};

AgaveMocks.refreshToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .post('/token', 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + agaveRequestFixture.refreshToken)
        .reply(200, agaveResponseFixture.tokenSuccess)
    ;

    return nock;
};

AgaveMocks.getUserVerificationMetadata = function(nock) {

    nock('https://' + agaveSettings.hostname)
        //.matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        //.matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .get('/meta/v2/data?q='
                  + encodeURIComponent(
                        '{"name":"userVerification",'
                        + ' "value.username":"' + agaveRequestFixture.username + '",'
                        + ' "owner":"' + agaveSettings.serviceAccountKey + '"'
                        + '}',
                        function() {
                            console.log("userVer hit ok");
                        }
                  )
        )
        //.get('/meta/v2/data?q=')
        .reply(200, agaveResponseFixture.getUserVerificationMetadataSuccess)
    ;

    return nock;
};

AgaveMocks.createUser = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .post('/profiles/v2/', 'username=' + agaveRequestFixture.createUser.username + '&password=' + agaveRequestFixture.createUser.password + '&email=' + agaveRequestFixture.createUser.email)
        .reply(200, agaveResponseFixture.createUserSuccess)
    ;

    return nock;
};

AgaveMocks.createUserProfile = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .post('/meta/v2/data', {'name':'profile','value':agaveRequestFixture.createUserProfile})
        .reply(200, agaveResponseFixture.createUserProfileSuccess)
    ;

    return nock;
};

AgaveMocks.getUserProfile = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .get('/meta/v2/data?q=' + encodeURIComponent('{"name":"profile","owner":"' + agaveRequestFixture.username + '"}'))
        .reply(200, agaveResponseFixture.getUserProfileSuccess)
    ;

    return nock;
};

AgaveMocks.createProjectMetadata = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .post('/meta/v2/data', function(input) {
            return (JSON.stringify(input) === JSON.stringify(agaveRequestFixture.createProjectMetadata));
        })
        .reply(200, agaveResponseFixture.createProjectSuccess)
    ;

    return nock;
};

AgaveMocks.createProjectDirectory = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .put('/files/v2/media/system/data.vdjserver.org//projects/', 'action=mkdir&path=' + agaveRequestFixture.projectUuid)
        .reply(200, agaveResponseFixture.createProjectDirectorySuccess)
    ;

    return nock;
};

AgaveMocks.addUsernameToMetadataPermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .post('/meta/v2/data/' + agaveRequestFixture.projectUuid + '/pems', 'username=' + agaveRequestFixture.username + '&permission=READ_WRITE')
        .reply(200, agaveResponseFixture.addUsernameToMetadataPermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.removeUsernameFromMetadataPermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .delete('/meta/v2/data/' + agaveRequestFixture.projectUuid + '/pems/' + agaveRequestFixture.username)
        .reply(200, agaveResponseFixture.removeUsernameFromMetadataPermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.getMetadataPermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .get('/meta/v2/data/' + agaveRequestFixture.projectUuid + '/pems')
        .reply(200, agaveResponseFixture.getMetadataPermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.getProjectFileMetadataPermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .get('/meta/v2/data?q='
                + encodeURIComponent('{'
                    + '"name": { $in: ["projectFile", "projectJobFile"] },'
                    + '"value.projectUuid":"' + agaveRequestFixture.projectUuid + '"'
                + '}')
        )
        .reply(200, agaveResponseFixture.getProjectFileMetadataPermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.getFilePermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .get('/files/v2/pems/system/data.vdjserver.org//projects/' + agaveRequestFixture.filePath)
        .reply(200, agaveResponseFixture.getFilePermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.getFileListings = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .get('/files/v2/listings/system/data.vdjserver.org//projects/' + agaveRequestFixture.projectUuid + '/files')
        .reply(200, agaveResponseFixture.getFileListingsSuccess)
    ;

    return nock;
};

AgaveMocks.addUsernameToFullFilePermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .post(
            '/files/v2/pems/system/data.vdjserver.org//projects/' + agaveRequestFixture.filePath,
            {
                username: agaveRequestFixture.username,
                'permission':'ALL',
                'recursive': true,
            }
        )
        .reply(200, agaveResponseFixture.addUsernameToFullFilePermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.removeUsernameFromFilePermissions = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveRequestFixture.accessToken)
        .post(
            '/files/v2/pems/system/data.vdjserver.org//projects/' + agaveRequestFixture.filePath,
            function(input) {
                return JSON.stringify(input) === JSON.stringify(agaveRequestFixture.removeUsernameFromFilePermissions);
            }
        )
        .reply(200, agaveResponseFixture.removeUsernameFromFilePermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.createPasswordResetMetadata = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .post(
            '/meta/v2/data',
            {
                name: 'passwordReset',
                value: {
                    username: agaveRequestFixture.username,
                },
            }
        )
        .reply(200, agaveResponseFixture.removeUsernameFromFilePermissionsSuccess)
    ;

    return nock;
};

AgaveMocks.getPasswordResetMetadata = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .get('/meta/v2/data?q=' + encodeURIComponent('{"name":"passwordReset", "uuid":"' + agaveRequestFixture.metadataUuid + '", "owner":"' + agaveSettings.serviceAccountKey + '"}'))
        .reply(200, agaveResponseFixture.getPasswordResetMetadataSuccess)
    ;

    return nock;
};

AgaveMocks.deleteMetadata = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .delete('/meta/v2/data/' + agaveRequestFixture.metadataUuid)
        .reply(200, agaveResponseFixture.deleteMetadataSuccess)
    ;

    return nock;
};

AgaveMocks.updateUserPassword = function(nock) {
    nock('https://' + agaveSettings.hostname)
        //.matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .put(
            '/profiles/v2/' + agaveRequestFixture.createUser.username + '/',

            'username=' + agaveRequestFixture.createUser.username
                        + '&password=' + agaveRequestFixture.createUser.password
                        + '&email=' + agaveRequestFixture.createUser.email
        )
        .reply(200, agaveResponseFixture.updateUserPasswordSuccess)
    ;

    return nock;
};

AgaveMocks.createJobMetadata = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .post(
            '/meta/v2/data',
            {
                name: 'projectJob',
                value: {
                    projectUuid: agaveRequestFixture.projectUuid,
                    jobUuid: agaveRequestFixture.jobId,
                },
            }
        )
        .reply(200, agaveResponseFixture.createJobMetadataSuccess)
    ;

    return nock;
};
