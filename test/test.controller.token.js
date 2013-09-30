
// Models
var TokenAuth      = require('../app/scripts/models/tokenAuth');
var InternalUser   = require('../app/scripts/models/internalUser');

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
