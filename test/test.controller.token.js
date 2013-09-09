
// Models
var TokenAuth      = require('../app/scripts/models/tokenAuth');
var InternalUser   = require('../app/scripts/models/internalUser');
var AppCredentials = require('../app/scripts/models/appCredentials');

// Controllers
var tokenController = require('../app/scripts/controllers/tokenController');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks = require('./mocks/agaveMocks');


describe("tokenController functions", function() {

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });

    it("should be able to provide a tokenAuth for appCredentials", function() {

        var appCredentials = new AppCredentials();
        appCredentials.username = "David Lee Roth";

        var tokenAuth = tokenController.getTokenAuthForAppCredentials(appCredentials);

        tokenAuth.internalUsername.should.equal(appCredentials.username);

    });


    it("should be able to provide a VDJ token", function() {

        agaveMocks.vdjTokenFetch(nock);
        agaveMocks.vdjTokenRefresh(nock);

        tokenController.provideVdjToken(function(error, tokenAuth) {

            should.not.exist(error);
            should.exist(tokenAuth);
            tokenAuth.token.should.not.equal("");
        });

    });

});
