
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
            var string = fileListings[i].path;
            var split = string.split('/projects/');
            paths.push(split[1]);
        }
    }

    return paths;
};

module.exports = FileListing;
