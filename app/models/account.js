
var crypto   = require('crypto');
var moment   = require('moment');

var mongoose   = require('mongoose');
var collection = 'accounts';
var Schema     = mongoose.Schema;
var ObjectId   = Schema.ObjectId;


var AccountSchema = new Schema({
    firstname   : String,
    lastname    : String,
    email       : String,
    username    : String,
    password    : String,
    country     : String,
    date        : String
});


// Password Saving Methods and Utilities
var generateSalt = function() {

    var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
    var salt = '';
    for (var i = 0; i < 10; i++) {
        var p  = Math.floor(Math.random() * set.length);
        salt  += set[p];
    }

    return salt;
};


var md5 = function(str) {
    return crypto.createHash('md5').update(str).digest('hex');
};


AccountSchema.methods.saltAndHash = function() {

    // Note: this.password should be plaintext at this point

    var salt    = generateSalt();
    var md5val  = md5(this.password + salt);
    var hash    = salt + md5val;

    this.password = hash;
};


AccountSchema.methods.validatePassword = function(plaintextPassword) {

    // Note: this.password should already be salted/hashed

    var salt      = this.password.substr(0, 10);
    var md5val    = md5(plaintextPassword + salt);
    var validHash = salt + md5val;


    if (this.password === validHash) {
        return true;
    }
    else {
        return false;
    }
};


// Date Methods
AccountSchema.methods.setDatestamp = function() {
    this.date = moment().format('MMMM Do YYYY, h:mm:ss a');
};


// Register with Mongoose
mongoose.model(collection, AccountSchema);
