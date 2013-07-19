
var request       = require('request');
var agaveSettings = require('../app/config/agave-settings');

describe("VDJAuth Integration Tests", function() {

    it("should post to /token and receive an Agave token for internal user '" + agaveSettings.testInternalUser + "'", function(done) {

        var url = 'http://localhost:8443/token';

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
            body.result.internalUsername.should.equal(agaveSettings.testInternalUser);

            done();

        });

    });

    it("should post to /user and create an internal user account for internal user '" + agaveSettings.testInternalUser + "'", function(done) {

        var url = 'http://localhost:8443/user';

        var postData = {"username":agaveSettings.testInternalUser, "password":agaveSettings.testInternalUserPassword, "email":agaveSettings.testInternalUserEmail};

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

            body.status.should.equal("success");
            body.result.username.should.equal(agaveSettings.testInternalUser);
            body.result.password.should.equal("");

            done();

        });

        requestObj.write(JSON.stringify(postData));

        requestObj.end();

    });
});
