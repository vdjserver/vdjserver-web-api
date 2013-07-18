
// Processing
var Agave         = require('../app/server/agave');
var AgaveSettings = require('../app/server/agave-settings');


// Models
var InternalUserAuth = require('../app/models/internalUserAuth');


describe("agave functions", function() {

    it("should be able to calculate post length for token request for internal username 'MartyMcfly'", function() {
   
        var data = Agave.internalUserTokenRequestSettings("MartyMcfly");
        data.headers['Content-Length'].should.equal(27);

    });

    it("should be able to retrieve a token from Agave for internal username 'testMartyMcFly'", function(done) {
       
        Agave.getInternalUserToken("test6", "shazam", function(error, internalUserAuth) {
            
            internalUserAuth.token.should.not.equal("");
            done();
            
        });

    });

    it("should return an error message when retrieving a token from Agave for bad internal username 'testBiffTannen'", function(done) {
       
        Agave.getInternalUserToken("testBiffTannen", "shazam", function(error, internalUserAuth) {
            
            error.should.not.equal(null);
            done();
            
        });

    });

});
