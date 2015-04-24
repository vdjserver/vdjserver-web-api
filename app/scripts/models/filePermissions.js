
'use strict';

var _ = require('underscore');
var MetadataUtilities = require('./mixins/metadata-utilities');

var FilePermissions = function(attributes) {

    if (!attributes) {
        attributes = {};
    }

    this.username = attributes.username || '';
};

_.extend(FilePermissions.prototype, MetadataUtilities);

module.exports = FilePermissions;
