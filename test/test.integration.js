
var request       = require('request');
var agaveSettings = require('../app/config/agave-settings');

var baseUrl = 'http://localhost:8443';

describe("VDJAuth Integration Tests", function() {

    var token;

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

            var body = JSON.parse(body);

            body.status.should.equal("success");
            
            body.result.token.should.not.equal("");
            body.result.username.should.not.equal("");
            body.result.created.should.not.equal("");
            body.result.expires.should.not.equal("");
            body.result.renewed.should.not.equal("");
            body.result.internalUsername.should.equal(agaveSettings.testInternalUser);
            body.result.password.should.equal("");
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
            body.result.password.should.equal("");
            body.result.remainingUses.should.not.equal("");

            // Save the token for the refresh test
            token = body.result.token;

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
            console.log("body output is: " + JSON.stringify(body));

            body.status.should.equal("success");
            body.result.username.should.equal(agaveSettings.testInternalUser);
            body.result.password.should.equal("");

            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });
});
