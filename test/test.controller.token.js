
// Processing
var agaveSettings = require('../app/config/agave-settings');

// Models
var TokenAuth      = require('../app/models/tokenAuth');
var InternalUser   = require('../app/models/internalUser');
var AppCredentials = require('../app/models/appCredentials');

// Controllers
var tokenController = require('../app/controllers/tokenController');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks = require('./mocks/agaveMocks');


describe("tokenController functions", function() {

    afterEach(function(done) {
        console.log("calling afterEach");
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

        tokenController.provideVdjToken(function(error, tokenAuth) {

            console.log("tokenAuth is: " + JSON.stringify(tokenAuth));
            should.not.exist(error);
            should.exist(tokenAuth);
            tokenAuth.token.should.not.equal("");
        });

    });

});
