
// Models
var InternalUser = require('../app/scripts/models/internalUser');

// Dependencies
var request  = require('request');
var mongoose = require('mongoose');

// Settings
var config = require('../app/scripts/config/config');
var agaveSettings = require('../app/scripts/config/agave-settings');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var testData = require('./datasource/testData');

//var agaveMocks = require('./mocks/agaveMocks');
//var agaveTokenFixture = require('./fixtures/agaveTokenFixture');

var baseUrl = 'http://localhost:8443';


describe("VDJServer Integration Tests", function() {

    var newProfileFirstName = 'Ned';
    var newProfileLastName   = 'Flanders';
    var newProfileCity      = 'Springfield';
    var newProfileState     = 'IL';
    var newProfileEmail     = 'ned@flanders.com';
    var token;

    before(function(done) {

        mongoose.connect(config.mongooseDevDbString);

        // Clean up the db before we begin
        InternalUser.remove({username:testData.internalUser}, function(error) {

            var testUser = new InternalUser();

            testUser.username = testData.internalUser;
            testUser.password = testData.internalUserPassword;

            profile = testUser.profile.create();
            profile.firstName = newProfileFirstName;
            profile.lastName  = newProfileLastName;
            profile.city      = newProfileCity;
            profile.state     = newProfileState;
            profile.email     = newProfileEmail;
            testUser.profile.push(profile);

            testUser.saltAndHash();

            testUser.save(function(error, savedTestUser) {

                // Token Fetch
                var tokenUrl = baseUrl + '/token';
                var tokenOptions = {
                    url: tokenUrl,
                    method: 'post',
                    headers: {
                        "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + testData.internalUserPassword).toString('base64')
                    }
                };

                var tokenRequestObj = request(tokenOptions, function(error, response, body) {

                    var body = JSON.parse(body);
                    token = body.result.token;

                    done();

                });

                tokenRequestObj.end();

            });

        });

    });


    after(function(done) {

        mongoose.connection.close();
        done();

    });

    /*
    beforeEach(function(done) {
        // Token Get / Refresh
        done();
    });

    afterEach(function(done) {
        //nock.cleanAll();
        done();
    });
    */

    it("should get a user profile from /user/profile for '" + testData.internalUser + "'", function(done) {

        var url = baseUrl + '/user/profile';

        var options = {
            url:    url,
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + token).toString('base64')
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.firstName.should.equal(newProfileFirstName);
            body.result.lastName.should.equal(newProfileLastName);
            body.result.city.should.equal(newProfileCity);
            body.result.state.should.equal(newProfileState);
            body.result.email.should.equal(newProfileEmail);

            done();

        });

        requestObj.end();

    });

    it("should post to /user/profile and update an internal user profile for '" + testData.internalUser + "'", function(done) {

        var url = baseUrl + '/user/profile';

        var postData = {
            "firstName": testData.internalUserFirstName,
            "lastName":  testData.internalUserLastName,
            "city":      testData.internalUserCity,
            "state":     testData.internalUserState,
            "email":     testData.internalUserEmail
        };

        var options = {
            url:    url,
            method: 'post',
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + token).toString('base64'),
                "Content-Type":"application/json",
                "Content-Length":JSON.stringify(postData).length
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.firstName.should.equal(testData.internalUserFirstName);
            body.result.lastName.should.equal(testData.internalUserLastName);
            body.result.city.should.equal(testData.internalUserCity);
            body.result.state.should.equal(testData.internalUserState);
            body.result.email.should.equal(testData.internalUserEmail);

            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });

    it("should post to /project and create a new project", function(done) {

        var url = baseUrl + '/project';

        var postData = {
            "name":    'Amazing Project',
            "members": [testData.internalUser]
        };

        var options = {
            url:    url,
            method: 'post',
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + token).toString('base64'),
                "Content-Type":"application/json",
                "Content-Length":JSON.stringify(postData).length
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.name.should.equal('Amazing Project');
            body.result.members[0]['username'].should.equal(testData.internalUser);
            //body.result.created.sho;
            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });

    it("should get a user project list from /user/projects", function(done) {

        var url = baseUrl + '/user/projects';

        var options = {
            url:    url,
            method: 'get',
            headers: {
                "Authorization":"Basic " + new Buffer(testData.internalUser + ':' + token).toString('base64')
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result[0].name.should.equal('Amazing Project');
            done();

        });

        requestObj.end();

    });

    it("should get a schemata uuid list from /uuid/schemata", function(done) {

        var url = baseUrl + '/uuid/schemata';

        var options = {
            url:    url,
            method: 'get'
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.should.ownProperty('profile');
            done();

        });

        requestObj.end();

    });
});
