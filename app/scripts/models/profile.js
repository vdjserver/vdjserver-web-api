
// Required
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;


var ProfileSchema = new Schema({
    firstName : 'String',
    lastName  : String,
    city      : String,
    state     : String,
    email     : String
});

module.exports = ProfileSchema; //mongoose.model('Profile', ProfileSchema);
