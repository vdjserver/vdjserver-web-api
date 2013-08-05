
// Required
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;


var ProfileSchema = new Schema({
    firstName : String,
    lastName  : String,
    city      : String,
    state     : String
});

module.exports = mongoose.model('Profile', ProfileSchema);
