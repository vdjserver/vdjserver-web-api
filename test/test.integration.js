
// Models
var InternalUser = require('../app/models/internalUser');

// Dependencies
var request  = require('request');
var mongoose = require('mongoose');

// Settings
var config = require('../app/config/config');
var agaveSettings = require('../app/config/agave-settings');

// Testing
var nock = require('nock');

// Testing Fixtures
var agaveTokenFixture = require('./fixtures/agaveTokenFixture');

var baseUrl = 'http://localhost:8443';

/*
        // Token Get / Refresh
        nock('https://' + agaveSettings.host)
            .post(agaveSettings.authEndpoint)
            .reply(200, agaveTokenFixture.vdjResponse)
        ;
*/

/*
        nock('https://' + agaveSettings.host)
            .put(agaveSettings.authEndpoint + '/tokens' + '/' + agaveTokenFixture.vdjToken)
            .reply(200, agaveTokenFixture.vdjResponse)
        ;
*/
    /*
        // Create user request
        nock('https://' + agaveSettings.host)
            .post(agaveSettings.createInternalUserEndpoint, {"username": agaveSettings.testInternalUser, "email": agaveSettings.testInternalUserEmail})
            .reply(200, agaveTokenFixture.internalUserResponse)
        ;
*/

describe("VDJAuth Integration Tests", function() {

    var token;

    before(function(done) {

        mongoose.connect(config.mongooseDevDbString);

        // Clean up the db before we begin
        InternalUser.remove({username:agaveSettings.testInternalUser}, function(error) {

            done();
        });

    });

    it("should post to /user and create an internal user account for internal user '" + agaveSettings.testInternalUser + "'", function(done) {

        var url = baseUrl + '/user';

        var postData = {
                            "internalUsername":agaveSettings.testInternalUser,
                            "password":        agaveSettings.testInternalUserPassword,
                            "email":           agaveSettings.testInternalUserEmail
                       };

        var options = {
            url: url,
            method: 'post',
            headers: {
                "Content-Type":"application/json",
                "Content-Length":JSON.stringify(postData).length
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);
            console.log("body check is: " + JSON.stringify(body));

            body.status.should.equal("success");
            body.result.username.should.equal(agaveSettings.testInternalUser);
            body.result.password.should.equal("");

            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });


    it("should post to /token and receive an Agave token for internal user '" + agaveSettings.testInternalUser + "'", function(done) {

        var url = baseUrl + '/token';

        var auth = "Basic " + new Buffer(agaveSettings.testInternalUser + ":" + agaveSettings.testInternalUserPassword).toString("base64");

        var options = {
            url: url,
            method: 'post',
            headers: {
                "Authorization": auth
            }
        };

        var requestObj = request(options, function(error, response, body) {

            console.log("body is: " + JSON.stringify(body));

            var body = JSON.parse(body);

            body.status.should.equal("success");

            body.result.token.should.not.equal("");
            body.result.username.should.not.equal("");
            body.result.created.should.not.equal("");
            body.result.expires.should.not.equal("");
            body.result.renewed.should.not.equal("");
            body.result.internalUsername.should.equal(agaveSettings.testInternalUser);
            body.result.remainingUses.should.not.equal("");

            // Save the token for the refresh test
            token = body.result.token;

            done();

        });

    });


    it("should put to /token and receive a refreshed Agave token for internal user '" + agaveSettings.testInternalUser + "'", function(done) {

        var url = baseUrl + '/token'
                          + '/' + token;

        var auth = "Basic " + new Buffer(agaveSettings.testInternalUser + ":" + agaveSettings.testInternalUserPassword).toString("base64");

        var options = {
            url: url,
            method: 'put',
            headers: {
                "Authorization": auth
            }
        };

        var requestObj = request(options, function(error, response, body) {

            var body = JSON.parse(body);

            body.status.should.equal("success");

            body.result.token.should.not.equal("");
            body.result.username.should.not.equal("");
            body.result.created.should.not.equal("");
            body.result.expires.should.not.equal("");
            body.result.renewed.should.not.equal("");
            body.result.internalUsername.should.equal(agaveSettings.testInternalUser);
            body.result.remainingUses.should.not.equal("");

            // Save the token for the refresh test
            token = body.result.token;

            done();

        });

    });



    // TODO:

    // test for errors
});
