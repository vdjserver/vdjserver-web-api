
// Processing
var agaveIO       = require('../app/vendor/agave/agaveIO');
var agaveSettings = require('../app/config/agave-settings');

// Models
var InternalUserAuth = require('../app/models/internalUserAuth');
var InternalUser     = require('../app/models/internalUser');

// Testing
var should = require('should');


describe("agaveIO token functions", function() {

    it("should be able to calculate post length for token request for internal username 'testMartyMcFly'", function() {
   
        var data = agaveIO.internalUserTokenRequestSettings(agaveSettings.testInternalUser);
        data.headers['Content-Length'].should.equal(14);

    });

    it("should be able to retrieve a token from Agave for internal username '" + agaveSettings.testInternalUser + "'", function(done) {
       
        var internalUserAuth = new InternalUserAuth.schema();
        internalUserAuth.internalUsername = agaveSettings.testInternalUser;

        agaveIO.getInternalUserToken(internalUserAuth, function(error, internalUserAuth) {
            should.not.exist(error);
            internalUserAuth.token.should.not.equal("");
            done();
        });

    });

    it("should return an error message when retrieving a token from Agave for bad internal username 'testBiffTannen'", function(done) {
       
        var internalUserAuth = new InternalUserAuth.schema();
        internalUserAuth.internalUsername = "testBiffTannen";

        agaveIO.getInternalUserToken(internalUserAuth, function(error, internalUserAuth) {
            should.exist(error);
            done();
        });

    });

});

describe("agaveIO create internal user functions", function() {
    
    it("should be able to calculate post length for account creation for 'testMartyMcfly'", function() {
        
        var postData = {"username":"testMartyMcfly", "password":"1985", "email":"testMartyMcfly@delorean.com"};

        var returnData = agaveIO.createInternalUserRequestSettings(JSON.stringify(postData));

        returnData.headers['Content-Length'].should.equal(99);

    });

    it("should be able to create an Agave account for internal user '" + agaveSettings.testInternalUser + "'", function(done) {
        
        var internalUser = new InternalUser.schema();
        internalUser.username = agaveSettings.testInternalUser;
        internalUser.password = agaveSettings.testInternalUserPassword;
        internalUser.email    = agaveSettings.testInternalUserEmail;

        agaveIO.createInternalUser(internalUser, function(error, internalUser) {

            should.not.exist(error);
            internalUser.username.should.equal(agaveSettings.testInternalUser);
            done();

        });
    });

    it("should return an error message when creating an account that's missing the email attribute for bad internal username 'testBiffTannen'", function(done) {
        
        var internalUser = new InternalUser.schema();
        internalUser.username = "testBiffTannen";
        internalUser.password = "shazam";

        agaveIO.createInternalUser(internalUser, function(error, internalUser) {

            should.exist(error);
            should.not.exist(internalUser);
            done();

        });
    });
});
