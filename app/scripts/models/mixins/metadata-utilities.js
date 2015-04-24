'use strict';

var _ = require('underscore');

var MetadataUtilities = {}; //function() {};

MetadataUtilities.getUsernamesFromMetadataResponse = function(metadata) {

    var usernames = [];

    for (var i = 0; i < metadata.length; i++) {
        usernames.push(metadata[i].username);
    }

    usernames = _.without(usernames, 'vdj');
    return usernames;
};

module.exports = MetadataUtilities;
