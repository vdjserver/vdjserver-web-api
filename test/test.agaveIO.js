
'use strict';

// Processing
var agaveIO = require('../app/scripts/vendor/agave/agaveIO');

// Testing
var should = require('chai').should();
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

    it('should fulfill a promiset to get a new Agave Token', function(done) {

        agaveMocks.getToken(nock);

        agaveIO.getToken(agaveRequestFixture.passwordAuth)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.tokenSuccess);
                done();
            });
    });

    it('should fail a promise when unable to get a new Agave Token', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.getToken(agaveRequestFixture.passwordAuth)
            .fail(function(data) {
                done();
            });
    });

    it('should fulfill a promise to refresh an Agave Token', function(done) {

        agaveMocks.refreshToken(nock);

        agaveIO.refreshToken(agaveRequestFixture.refreshTokenAuth)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.tokenSuccess);
                done();
            });
    });

    it('should fail a promise when unable to refresh an Agave Token', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.refreshToken(agaveRequestFixture.refreshTokenAuth)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to create a new Agave user', function(done) {

        agaveMocks.createUser(nock);

        agaveIO.createUser(agaveRequestFixture.createUser)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.createUserSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to create a new Agave user', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.createUser(agaveRequestFixture.createUser)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to create a new VDJ user profile', function(done) {

        agaveMocks.createUserProfile(nock);

        agaveIO.createUserProfile(agaveRequestFixture.createUserProfile, agaveRequestFixture.accessToken)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.createUserProfileSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to create a new VDJ user profile', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.createUserProfile({}, agaveRequestFixture.accessToken)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to get a user profile', function(done) {

        agaveMocks.getUserProfile(nock);

        agaveIO.getUserProfile(agaveRequestFixture.username)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.getUserProfileSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to get a user profile', function(done) {

        agaveMocks.genericGetError(nock);

        agaveIO.getUserProfile(agaveRequestFixture.username)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to create a new VDJ project', function(done) {

        agaveMocks.createProject(nock);

        agaveIO.createProject(agaveRequestFixture.projectName)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.createProjectSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to create a new Agave project', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.createProject(agaveRequestFixture.projectName)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to create a VDJ project directory', function(done) {

        agaveMocks.createProjectDirectory(nock);

        agaveIO.createProjectDirectory(agaveRequestFixture.projectUuid)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.createProjectDirectorySuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to create a VDJ project directory', function(done) {

        agaveMocks.genericPutError(nock);

        agaveIO.createProjectDirectory(agaveRequestFixture.projectUuid)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to add a username to metadata permissions', function(done) {

        agaveMocks.addUsernameToMetadataPermissions(nock);

        agaveIO.addUsernameToMetadataPermissions(agaveRequestFixture.username, agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.addUsernameToMetadataPermissionsSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to add a username to metadata permissions', function(done) {

        agaveMocks.genericPostError(nock);

        agaveIO.addUsernameToMetadataPermissions(agaveRequestFixture.username, agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to remove a username from metadata permissions', function(done) {

        agaveMocks.removeUsernameFromMetadataPermissions(nock);

        agaveIO.removeUsernameFromMetadataPermissions(agaveRequestFixture.username, agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.removeUsernameFromMetadataPermissionsSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to remove a username from metadata permissions', function(done) {

        agaveMocks.genericDeleteError(nock);

        agaveIO.removeUsernameFromMetadataPermissions(agaveRequestFixture.username, agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to get metadata permissions', function(done) {

        agaveMocks.getMetadataPermissions(nock);

        agaveIO.getMetadataPermissions(agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.getMetadataPermissionsSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to get metadata permissions', function(done) {

        agaveMocks.genericGetError(nock);

        agaveIO.getMetadataPermissions(agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .fail(function() {
                done();
            });
    });

    it('should fulfill a promise to get project file metadata permissions', function(done) {

        agaveMocks.getProjectFileMetadataPermissions(nock);

        agaveIO.getProjectFileMetadataPermissions(agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .then(function(data) {
                data.should.eql(agaveResponseFixture.getProjectFileMetadataPermissionsSuccess.result);
                done();
            });
    });

    it('should fail a promise when unable to get project file metadata permissions', function(done) {

        agaveMocks.genericGetError(nock);

        agaveIO.getProjectFileMetadataPermissions(agaveRequestFixture.accessToken, agaveRequestFixture.projectUuid)
            .fail(function() {
                done();
            });
    });


});
