
// Processing
var agaveSettings = require('../app/config/agave-settings');

// Models
var TokenAuth        = require('../app/models/tokenAuth');
var InternalUser     = require('../app/models/internalUser');

// Controllers
var tokenController = require('../app/controllers/tokenController');

// Testing
var should = require('should');


describe("tokenController functions", function() {

    it("should be able to provide a VDJ token", function() {

        tokenController.provideVdjToken(function(error, tokenAuth) {

            should.not.exist(error);
            should.exist(tokenAuth);
            tokenAuth.token.should.not.equal("");
        });

    });

});
