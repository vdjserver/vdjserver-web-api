
'use strict';

// Node Libraries
var _ = require('underscore');
var Q = require('q');

// Settings
var agaveSettings = require('./../config/agaveSettings');

var CommunityData = function() {};

// Update community data filenames to be links
CommunityData.prototype.processLinksForCommunityDataMetadata = function(communityDataMetadata) {
    for (var i = 0; i < communityDataMetadata.length; i++) {
        var metadata = communityDataMetadata[i];

        if (metadata.hasOwnProperty('value')) {
            if (metadata.value.hasOwnProperty('experimentProjects')) {

                for (var j = 0; j < metadata.value.experimentProjects.length; j++) {
                    var experimentProjects = metadata.value.experimentProjects[j];

                    if (experimentProjects.hasOwnProperty('igBlastOutput')) {
                        var igBlastOutput = communityDataMetadata[i].value.experimentProjects[j].igBlastOutput;

                        for (var k = 0; k < igBlastOutput.length; k++) {
                            var filename = igBlastOutput[k];

                            var downloadPath = 'https://' + agaveSettings.hostname
                                             + '/files/v2/media/system'
                                             + '/' + agaveSettings.storageSystem
                                             + '//community'
                                             + '/' + metadata.uuid
                                             + '/files'
                                             + '/' + filename
                                             ;

                            communityDataMetadata[i].value.experimentProjects[j].igBlastOutput[k] = downloadPath;
                        }
                    }
                }
            }
        }
    }

    return communityDataMetadata;
};

module.exports = CommunityData;
