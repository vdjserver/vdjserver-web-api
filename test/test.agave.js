
// Processing
var Agave = require('../app/server/agave');

describe("agave functions", function() {

    it("should be able to calculate post length for token request for internal username 'MartyMcfly'", function() {
   
        var data = Agave.internalUserTokenRequestSettings("MartyMcfly");
        data.headers['Content-Length'].should.equal(27);

    });

});
