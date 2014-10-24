
'use strict';

var _ = require('underscore');

var MetadataPermissions = function(attributes) {

    if (!attributes) {
        attributes = {};
    }

    this.username = attributes.username || '';
};

MetadataPermissions.prototype.getUsernamesFromMetadataResponse = function(metadata) {

    var usernames = [];

    for (var i = 0; i < metadata.length; i++) {
        usernames.push(metadata[i].username);
    }

    usernames = _.without(usernames, 'vdj');
    return usernames;
};

MetadataPermissions.prototype.getUuidsFromMetadataResponse = function(metadata) {

    var uuids = [];

    for (var i = 0; i < metadata.length; i++) {
        uuids.push(metadata[i].uuid);
    }

    return uuids;
};

MetadataPermissions.prototype.getJobUuidsFromMetadataResponse = function(metadata) {

    var uuids = [];

    for (var i = 0; i < metadata.length; i++) {
        uuids.push(metadata[i].value.jobUuid);
    }

    return uuids;
};

module.exports = MetadataPermissions;
