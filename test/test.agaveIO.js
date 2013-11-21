
// Processing
var agaveIO       = require('../app/scripts/vendor/agave/agaveIO');
var agaveSettings = require('../app/scripts/config/agave-settings');

// Controllers
var tokenController = require('../app/scripts/controllers/tokenController');

// Models
var AgaveToken    = require('../app/scripts/models/agaveToken');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks           = require('./mocks/agaveMocks');
var agaveRequestFixture  = require('./fixtures/agaveRequestFixture');
var agaveResponseFixture = require('./fixtures/agaveResponseFixture');


describe("agaveIO token functions", function() {

    before(function(done) {

        done();
    });

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });


    it("should be able to calculate post length for getToken", function() {

        var data = agaveIO.getTokenSettings(agaveRequestFixture.username);
        data.headers['Content-Length'].should.equal(14);

    });

    it("should get a new Agave Token", function(done) {

        agaveMocks.getToken(nock);

        agaveIO.getToken(agaveRequestFixture.auth, function(error, agaveToken) {

            should.not.exist(error);

            agaveToken.token_type.should.equal(agaveResponseFixture.tokenType);
            agaveToken.expires_in.should.equal(agaveResponseFixture.expiresIn);
            agaveToken.refresh_token.should.equal(agaveResponseFixture.refreshToken);
            agaveToken.access_token.should.equal(agaveResponseFixture.accessToken);

            done();
        });

    });

    it("should return an error message when unable to get a new Agave Token", function(done) {

        agaveMocks.getTokenError(nock);

        agaveIO.getToken(agaveRequestFixture.auth, function(error, agaveToken) {
            should.exist(error);
            done();
        });

    });

/*
    it("should be able to refresh a VDJ Auth token from Agave", function(done) {

        agaveMocks.vdjTokenFetch(nock);
        agaveMocks.vdjTokenRefresh(nock);

        agaveIO.createVdjToken(function(error, newAgaveToken) {

            agaveIO.refreshToken(newAgaveToken.token, function(error, refreshedAgaveToken) {
                should.not.exist(error);
                refreshedAgaveToken.token.should.not.equal("");
                refreshedAgaveToken.token.should.equal(newAgaveToken.token);
                done();
            });

        });

    });
*/

});
