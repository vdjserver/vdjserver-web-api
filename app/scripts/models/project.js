
var mongoose = require('mongoose');
var Schema   = mongoose.Schema;

var ProjectSchema = new Schema({
    name:       {type: String},
    members:    [{type: Schema.Types.ObjectId, ref: 'InternalUser'}],
    categories: [],
    created:    {type: Date},
    modified:   {type: Date}
});

module.exports = mongoose.model('Project', ProjectSchema); 
