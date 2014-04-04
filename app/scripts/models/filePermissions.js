
'use strict';

var _ = require('underscore');

var FilePermissions = function(attributes) {

    if (!attributes) {
        attributes = {};
    }

    this.username = attributes.username || '';
};

FilePermissions.prototype.getUsernamesFromMetadataResponse = function(metadata) {

    var usernames = [];

    for (var i = 0; i < metadata.length; i++) {
        usernames.push(metadata[i].username);
    };

    usernames = _.without(usernames, 'vdj');
    return usernames;
}

module.exports = FilePermissions;
