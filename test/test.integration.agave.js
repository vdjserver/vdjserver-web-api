
var agaveSettings = require('../app/scripts/config/agave-settings');

// Dependencies
var request  = require('request');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks           = require('./mocks/agaveMocks');
var agaveRequestFixture  = require('./fixtures/agaveRequestFixture');
var agaveResponseFixture = require('./fixtures/agaveResponseFixture');

var baseUrl = 'http://localhost:8443';


describe("VDJ/Agave Integration Tests", function() {

    it("should get a new Agave token", function(done) {

        nock('https://' + agaveSettings.hostname)
            .post(agaveSettings.authEndpoint, 'grant_type=password&scope=PRODUCTION&username=' + agaveRequestFixture.username + '&password=' + agaveRequestFixture.password)
            .reply(200, agaveResponseFixture.success)
        ;

        var url = baseUrl + '/token';

        var options = {
            url:    url,
            method: 'post',
            auth:   agaveRequestFixture.username + ':' + agaveRequestFixture.password
        };


        var requestObj = request(options, function(error, response, body) {

            console.log("end requestObj");

            var body = JSON.parse(body);

            body.status.should.equal("success");
            body.result.username.should.equal(agaveRequestFixture.auth.username);

            done();

        });

        requestObj.write(JSON.stringify(agaveRequestFixture.auth));

        requestObj.end();

    });

    /*
    it("should return an error message when unable to get a new Agave Token", function(done) {

        var url = baseUrl + '/token';

        var auth = "Basic " + new Buffer(testData.internalUser + ":" + testData.internalUserPassword).toString("base64");

        var options = {
            url: url,
            method: 'post',
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
            body.result.internalUsername.should.equal(testData.internalUser);
            body.result.remainingUses.should.not.equal("");

            // Save the token for the refresh test
            token = body.result.token;

            done();

        });

    });
*/

    // TODO:

    // test refresh
    // test for errors
});
