
// Model
var InternalUser = require('../app/scripts/models/internalUser');

// Testing
var should = require('should');


describe("internalUser", function() {

    var internalUser = null;

    beforeEach(function(done) {

        internalUser = new InternalUser();

        internalUser.username  = "vanhalen";
        internalUser.password  = "test123";
        internalUser.email     = "eddievanhalen@test.com";

        done();
    });


    it("generates a salt sequence ten characters long", function() {
        var salt = internalUser.generateSalt();
        salt.length.should.equal(10);
    });


    it("generates an md5 sequence for 'abracadabra' that matches 'ec5287c45f0e70ec22d52e8bcbeeb640'", function() {
        var md5 = internalUser.md5('abracadabra');
        md5.should.equal('ec5287c45f0e70ec22d52e8bcbeeb640');
    });


    it("should saltAndHash plaintext password 'test123'", function() {
        internalUser.saltAndHash();
        internalUser.password.should.not.equal('test123');
    });


    it("should validate plaintext password against salt/hash version", function() {
        internalUser.saltAndHash();
        var passwordIsValid = internalUser.validatePassword('test123');
        passwordIsValid.should.be.true;
    });

    it("should remove the password when converted to JSON", function() {
        var json = internalUser.toJSON();
        should.exist(json.username);
        should.not.exist(json.password);
    });

});
