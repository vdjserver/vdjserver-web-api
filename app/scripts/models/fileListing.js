
'use strict';

var FileListing = function(attributes) {

    if (!attributes) {
        attributes = {};
    }

    this.username = attributes.username || '';
};

FileListing.prototype.getFilePaths = function(fileListings) {

    var paths = [];

    for (var i = 0; i < fileListings.length; i++) {
        if (fileListings[i].format !== 'folder') {
            paths.push(fileListings[i].path);
        }
    }

    return paths;
};

module.exports = FileListing;
