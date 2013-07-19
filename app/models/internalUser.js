
// Required
var crypto = require('crypto');


var InternalUser = {};
module.exports = InternalUser;


InternalUser.schema = function() {
    this.username = "";
    this.password = "";
    this.email    = "";

};

InternalUser.generateSalt = function() {

    var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
    var salt = '';
    for (var i = 0; i < 10; i++) {
        var p  = Math.floor(Math.random() * set.length);
        salt  += set[p];
    }

    return salt;
};


InternalUser.md5 = function(str) {
    return crypto.createHash('md5').update(str).digest('hex');
};


InternalUser.schema.prototype.saltAndHash = function() {

    var salt   = InternalUser.generateSalt();
    var md5Val = InternalUser.md5(this.password + salt);
    var hash   = salt + md5Val;

    this.password = hash;
};

InternalUser.schema.prototype.validatePassword = function(plaintextPassword) {

    // Note: this.password should already be salted/hashed
    var salt      = this.password.substr(0, 10);
    var md5Val    = InternalUser.md5(plaintextPassword + salt);
    var validHash = salt + md5Val;

    if (this.password === validHash) {
        return true;
    }
    else {
        return false;
    }
};
