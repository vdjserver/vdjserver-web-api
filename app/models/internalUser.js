
// Required
var crypto     = require('crypto');
var moment     = require('moment');
var mongoose   = require('mongoose');
var Schema     = mongoose.Schema;


var InternalUserSchema = new Schema({
    username : { type: String, unique: true},
    password : String,
    email    : String
});

InternalUserSchema.methods.generateSalt = function() {

    var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
    var salt = '';
    for (var i = 0; i < 10; i++) {
        var p  = Math.floor(Math.random() * set.length);
        salt  += set[p];
    }

    return salt;
};


InternalUserSchema.methods.md5 = function(str) {
    return crypto.createHash('md5').update(str).digest('hex');
};


InternalUserSchema.methods.saltAndHash = function() {

    var salt   = this.generateSalt();
    var md5Val = this.md5(this.password + salt);
    var hash   = salt + md5Val;

    this.password = hash;
};

InternalUserSchema.methods.validatePassword = function(plaintextPassword) {

    // Note: this.password should already be salted/hashed
    var salt      = this.password.substr(0, 10);
    var md5Val    = this.md5(plaintextPassword + salt);
    var validHash = salt + md5Val;

    if (this.password === validHash) {
        return true;
    }
    else {
        return false;
    }
};

InternalUserSchema.methods.apiOutput = function() {
    
    var blankPassword = "";

    return {
        "email":    this.email,
        "password": "",
        "username": this.username
    };
};

module.exports = mongoose.model('InternalUser', InternalUserSchema); 
