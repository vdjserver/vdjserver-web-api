var mongoose = require('mongoose');
var account  = require('./../app/models/account');

mongoose.connect("mongodb://localhost/unitTest_db");

describe("accountModel", function() {

    var testAccount = null;

    beforeEach(function(done) {

        testAccount = new account();

        testAccount.firstname = "Eddie";
        testAccount.lastname  = "Van Halen";
        testAccount.email     = "eddievanhalen@test.com";
        testAccount.username  = "vanhalen";
        testAccount.password  = "test123";
        testAccount.country   = "USA";

    });

    it('generates a salt sequence ten characters long', function() {
        var salt = account.generateSalt();
        salt.length.should.equal(10);
    });

});
