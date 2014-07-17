'use strict';

var baseUrl = 'http://localhost:8442';

var server = require('../app/scripts/app');

// Testing
var should = require('chai').should();
var nock   = require('nock');
var supertest = require('supertest');
var api = supertest(baseUrl);

// Testing Fixtures
var agaveMocks           = require('./mocks/agaveMocks');
var agaveRequestFixture  = require('./fixtures/agaveRequestFixture');
var agaveResponseFixture = require('./fixtures/agaveResponseFixture');

describe('VDJ/Agave Project Integration Tests', function() {

    before(function(done) {
        server;
        done();
    });

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });

    it('should create a new Agave project', function(done) {

        agaveMocks.createProjectMetadata(nock);
        agaveMocks.addUsernameToMetadataPermissions(nock);
        agaveMocks.createProjectDirectory(nock);
        agaveMocks.addUsernameToFullFilePermissions(nock);
        agaveMocks.createProjectDirectory(nock);
        agaveMocks.addUsernameToFullFilePermissions(nock);
        agaveMocks.createProjectDirectory(nock);
        agaveMocks.addUsernameToFullFilePermissions(nock);

        api.post('/projects')
            .auth(agaveRequestFixture.username, agaveRequestFixture.password)
            .send({projectName: 'fancy project', username: agaveRequestFixture.username})
            .end(function(error, response) {

                var data = response.body.result;
                console.log("data is: " + JSON.stringify(data));
                data.should.not.equal(undefined);
                /*
                data.token_type.should.equal(agaveResponseFixture.tokenType);
                data.expires_in.should.equal(agaveResponseFixture.expiresIn);
                data.refresh_token.should.equal(agaveResponseFixture.refreshToken);
                data.access_token.should.equal(agaveResponseFixture.accessToken);
                */
                done();
            });
    });

/*
    it('should return an error message when unable to get a new Agave Token', function(done) {

        agaveMocks.genericPostError(nock);

        api.post('/token')
            .auth('test', 'test')
            .end(function(error, response) {

                response.body.status.should.equal('error');
                response.body.result.should.equal('');

                done();
            });
    });
*/

});
