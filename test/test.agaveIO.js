
'use strict';

// Processing
var agaveIO = require('../app/scripts/vendor/agave/agaveIO');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks           = require('./mocks/agaveMocks');
var agaveRequestFixture  = require('./fixtures/agaveRequestFixture');
var agaveResponseFixture = require('./fixtures/agaveResponseFixture');


describe('agaveIO token functions', function() {

    before(function(done) {
        done();
    });

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });

    it('should get a new Agave Token', function(done) {

        agaveMocks.getToken(nock);

        agaveIO.getToken(agaveRequestFixture.auth)
            .then(function(data) {
                //console.log('data is: ' + JSON.stringify(data));

                data.token_type.should.equal(agaveResponseFixture.tokenType);
                data.expires_in.should.equal(agaveResponseFixture.expiresIn);
                data.refresh_token.should.equal(agaveResponseFixture.refreshToken);
                data.access_token.should.equal(agaveResponseFixture.accessToken);

                done();
            });

    });

    it('should fail a promise when unable to get a new Agave Token', function(done) {

        agaveMocks.getTokenError(nock);

        agaveIO.getToken(agaveRequestFixture.auth)
            .fail(function() {
                done();
            });
    });

});
