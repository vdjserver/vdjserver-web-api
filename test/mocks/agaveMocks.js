
// Settings
var agaveSettings = require('../../app/scripts/config/agave-settings');

// Fixtures
var agaveRequestFixture  = require('../fixtures/agaveRequestFixture');
var agaveResponseFixture = require('../fixtures/agaveResponseFixture');


var AgaveMocks = {};
module.exports = AgaveMocks;


// getToken
AgaveMocks.getToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post(agaveSettings.authEndpoint, 'grant_type=password&scope=PRODUCTION&username=' + agaveRequestFixture.username + '&password=' + agaveRequestFixture.password)
        .reply(200, agaveResponseFixture.success)
    ;

    return nock;
};

AgaveMocks.getTokenError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post(agaveSettings.authEndpoint)
        .reply(401)
    ;

    return nock;
};

/*

// refreshToken
AgaveMocks.refreshToken = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post(agaveSettings.authEndpoint, 'grant_type=refresh_token&scope=PRODUCTION&refresh_token=' + agaveResponseFixture.refreshToken)
        .reply(200, agaveResponseFixture.vdjResponse)
    ;

    return nock;
};

AgaveMocks.refreshTokenError = function(nock) {
    nock('https://' + agaveSettings.hostname)
        .post(agaveSettings.authEndpoint)
        .reply(401)
    ;

    return nock;
};
*/
