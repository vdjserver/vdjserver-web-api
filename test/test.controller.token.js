
// Models
var AgaveToken = require('../app/scripts/models/agaveToken');

// Controllers
var tokenController = require('../app/scripts/controllers/tokenController');

// Testing
var should = require('should');
var nock   = require('nock');

// Testing Fixtures
var agaveMocks = require('./mocks/agaveMocks');
var agaveRequestFixture = require('./fixtures/agaveRequestFixture');


describe("tokenController functions", function() {

    afterEach(function(done) {
        nock.cleanAll();
        done();
    });

    it("should be able to get a token", function() {

        agaveMocks.getToken(nock);

        console.log('request fixture is: ' + JSON.stringify(agaveRequestFixture.auth));

        tokenController.getToken(agaveRequestFixture, function(response) {
        //});

        //tokenController.getToken(function(error, tokenAuth) {

            var send = function() {
                console.log("calling send");
            }

            console.log("agaveToken is: " + JSON.stringify(agaveToken));

            should.not.exist(error);
            should.exist(agaveToken);
            agaveToken.token.should.not.equal("");
        });

    });

});
