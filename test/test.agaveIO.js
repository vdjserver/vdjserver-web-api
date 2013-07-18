
// Processing
var agaveIO       = require('../app/vendor/agave/agaveIO');
var agaveSettings = require('../app/config/agave-settings');

// Models
var InternalUserAuth = require('../app/models/internalUserAuth');


describe("agaveIO functions", function() {

    it("should be able to calculate post length for token request for internal username 'testMartyMcFly'", function() {
   
        var data = agaveIO.internalUserTokenRequestSettings(agaveSettings.testInternalUser);
        data.headers['Content-Length'].should.equal(31);

    });

    it("should be able to retrieve a token from Agave for internal username '" + agaveSettings.testInternalUser + "'", function(done) {
       
        agaveIO.getInternalUserToken(agaveSettings.testInternalUser, agaveSettings.testInternalUserPassword, function(error, internalUserAuth) {
            
            internalUserAuth.token.should.not.equal("");
            done();
            
        });

    });

    it("should return an error message when retrieving a token from Agave for bad internal username 'testBiffTannen'", function(done) {
       
        agaveIO.getInternalUserToken("testBiffTannen", "shazam", function(error, internalUserAuth) {
            
            error.should.not.equal(null);
            done();
            
        });

    });

});
