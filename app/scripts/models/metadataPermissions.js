
'use strict';

var _ = require('underscore');
var MetadataUtilities = require('./mixins/metadata-utilities');

var MetadataPermissions = function(attributes) {

    if (!attributes) {
        attributes = {};
    }

    this.username = attributes.username || '';
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

_.extend(MetadataPermissions.prototype, MetadataUtilities);

module.exports = MetadataPermissions;
