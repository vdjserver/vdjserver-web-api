
'use strict';

// Models
var FilePermissions = require('../app/scripts/models/filePermissions');

var MetadataPermissions = require('../app/scripts/models/metadataPermissions');

// Testing
var chai = require('chai').should();

describe('MetadataUtilities mixin functions', function() {

    it('should attach to the FilePermissions prototype', function() {

        var filePermissions = new FilePermissions();

        filePermissions.should.respondTo('getUsernamesFromMetadataResponse');
    });

    it('should attach to the MetadataPermissions prototype', function() {

        var metadataPermissions = new MetadataPermissions();

        metadataPermissions.should.respondTo('getUsernamesFromMetadataResponse');
    });

    it('should retrieve usernames from a metadata response', function() {

        var mockMetadata = [
            {
                username: 'test1',
            },
            {
                username: 'test2',
            },
        ];

        var expectedResults = ['test1', 'test2'];

        var filePermissions = new FilePermissions();

        var usernames = filePermissions.getUsernamesFromMetadataResponse(mockMetadata);

        usernames.should.deep.equal(expectedResults);
    });

    it('should retrieve usernames from a metadata response and filter out the vdj username', function() {

        var mockMetadata = [
            {
                username: 'test1',
            },
            {
                username: 'test2',
            },
            {
                username: 'vdj',
            },
        ];

        var expectedResults = ['test1', 'test2'];

        var filePermissions = new FilePermissions();

        var usernames = filePermissions.getUsernamesFromMetadataResponse(mockMetadata);

        usernames.should.deep.equal(expectedResults);
    });

});
