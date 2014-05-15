
'use strict';

// Settings
var agaveSettings = require('../../app/scripts/config/agaveSettings');

// Fixtures
var agaveRequestFixture  = require('../fixtures/agaveRequestFixture');
var agaveResponseFixture = require('../fixtures/agaveResponseFixture');


var AgaveMocks = {};
module.exports = AgaveMocks;


// getToken
AgaveMocks.getToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post('/token', 'grant_type=password&scope=PRODUCTION&username=' + agaveRequestFixture.username + '&password=' + agaveRequestFixture.password)
        .reply(200, JSON.stringify(agaveResponseFixture.success))
    ;

    return nock;
};

AgaveMocks.getTokenError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post('/token')
        .reply(401)
    ;

    return nock;
};


// refreshToken
AgaveMocks.refreshToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post('/token', 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + agaveRequestFixture.refreshToken)
        .reply(200, agaveResponseFixture.success)
    ;

    return nock;
};

AgaveMocks.refreshTokenError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post('/token')
        .reply(401)
    ;

    return nock;
};
