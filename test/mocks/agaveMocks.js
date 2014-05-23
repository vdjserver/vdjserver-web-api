
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

AgaveMocks.createProject = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .matchHeader('Content-Type', 'application/json')
        .matchHeader('Authorization', 'Bearer ' + agaveSettings.serviceAccountToken)
        .post('/meta/v2/data', agaveRequestFixture.createProject)
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
                 + '"name":"projectFile",'
                 + '"value.projectUuid":"' + agaveRequestFixture.projectUuid + '"'
             + '}')
        )
        .reply(200, agaveResponseFixture.getProjectFileMetadataPermissionsSuccess)
    ;

    return nock;
};
