// Initialize account model
var accountModel = require('./../app/models/account');

var mongoose = require('mongoose');

var accountCollection = mongoose.model('accounts');

mongoose.connect("mongodb://localhost:27017/unitTest_db");


describe("accountModel", function() {

    var testAccount = null;

    beforeEach(function(done) {

        testAccount = new accountCollection();

        testAccount.firstname = "Eddie";
        testAccount.lastname  = "Van Halen";
        testAccount.email     = "eddievanhalen@test.com";
        testAccount.username  = "vanhalen";
        testAccount.password  = "test123";
        testAccount.country   = "USA";

        done();
    });

    it("generates a salt sequence ten characters long", function() {
        var salt = accountModel.generateSalt();
        salt.length.should.equal(10);
    });

    it("generates an md5 sequence for 'abracadabra' that matches 'ec5287c45f0e70ec22d52e8bcbeeb640'", function() {
        var md5 = accountModel.md5('abracadabra');
        md5.should.equal('ec5287c45f0e70ec22d52e8bcbeeb640');
    });

    it("should saltAndHash plaintext password 'test123'", function() {
        testAccount.saltAndHash();
        testAccount.password.should.not.equal('test123');
    });

    it("should validate plaintext password against salt/hash version", function() {
        testAccount.saltAndHash();
        var passwordIsValid = testAccount.validatePassword('test123');
        passwordIsValid.should.be.true;
    });

    it("should create a datestamp", function() {
        testAccount.setDatestamp();
        testAccount.date.should.not.equal('');
    });

    it("should be able to save testAccount to MongoDB", function(done) {
        testAccount.save(function(error, data) {
            if (!error) {
                done();
            }
        });
    });

    it("should be able to retrieve testAccount from MongoDB", function(done) {
        accountCollection.findOne({username: testAccount.username}, function(error, account) {
            if (!error && account.email === testAccount.email) {
                done();
            }
        });
    });


});
