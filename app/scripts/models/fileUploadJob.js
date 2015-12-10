
'use strict';

var _ = require('underscore');

// Models
var ServiceAccount = require('./serviceAccount');
var FilePermissions = require('./filePermissions');

// Node Libraries
var Q = require('q');

// Processing
var agaveIO = require('../vendor/agaveIO');

var FileUploadJob = function(kueAttributes) {

    if (typeof kueAttributes === 'object') {
        this.fileUuid  = kueAttributes.fileUuid  || '';
        this.fileEvent = kueAttributes.fileEvent || '';
        this.fileType  = kueAttributes.fileType  || '';
        this.filePath  = kueAttributes.filePath  || '';
        this.fileSystem = kueAttributes.fileSystem || '';
        this.projectUuid = kueAttributes.projectUuid || '';
        this.readDirection = kueAttributes.readDirection || '';
        this.tags = kueAttributes.tags || '';
    }

    if (_.isEmpty(this.tags) === false) {
        this.tags = decodeURIComponent(this.tags);
    }
};

FileUploadJob.prototype.getRelativeFilePath = function() {
    var response = '';

    if (this.filePath !== '') {

        var tmpFilePath = this.filePath;

        var split = tmpFilePath.split('/');
        split = split.slice(3);

        response = split.join('/');
    }

    return response;
};

/*
FileUploadJob.prototype.getProjectId = function() {
    var response = '';

    if (this.filePath !== '') {

        var tmpFilePath = this.filePath;

        var split = tmpFilePath.split('/');

        response = split[3];
    }

    return response;
};
*/

FileUploadJob.prototype.setMetadataPermissions = function() {

    var that = this;

    var serviceAccount = new ServiceAccount();

    return agaveIO.getMetadataPermissions(serviceAccount.accessToken, this.projectUuid)
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            return agaveIO.getProjectFileMetadataByFilename(that.projectUuid, that.fileUuid)
                .then(function(fileMetadata) {

                    var metadataUuid = fileMetadata[0].uuid;

                    var promises = [];

                    function createAgaveCall(username) {

                        return function() {

                            return agaveIO.addUsernameToMetadataPermissions(
                                username,
                                serviceAccount.accessToken,
                                metadataUuid
                            );
                        };
                    }

                    for (var i = 0; i < projectUsernames.length; i++) {

                        var username = projectUsernames[i];

                        promises[i] = createAgaveCall(username);
                    }

                    return promises.reduce(Q.when, new Q());
                })
                ;
        })
        ;
};

FileUploadJob.prototype.createAgaveFileMetadata = function() {
    var that = this;

    return agaveIO.getFileDetail(this.getRelativeFilePath())
        .then(function(fileDetail) {
            var length = fileDetail[0].length;
            var name = fileDetail[0].name;

            var tmpTags = null;
            if (_.isEmpty(that.tags) !== false) {
                tmpTags = that.tags.split(',');
            }

            return agaveIO.createFileMetadata(that.fileUuid, that.projectUuid, 4, name, length, that.readDirection, tmpTags);
        })
        ;
};

FileUploadJob.prototype.setAgaveFilePermissions = function() {

    var that = this;

    // Create file metadata
    // Set metadata pems
    var serviceAccount = new ServiceAccount();

    //console.log("relativeFilePath is: " + this.getRelativeFilePath());

    if (this.projectUuid === '') {
        var deferred = Q.defer();

        var error = new Error('Unable to parse project id for file: ' + this.fileUuid);
        deferred.reject(error);

        return deferred.promise;
    }

    return agaveIO.getMetadataPermissions(serviceAccount.accessToken, this.projectUuid)
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var relativeFilePath = that.getRelativeFilePath();

            var promises = [];

            function createAgaveCall(username) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        serviceAccount.accessToken,
                        that.getRelativeFilePath()
                    );
                };
            }

            for (var i = 0; i < projectUsernames.length; i++) {

                var username = projectUsernames[i];

                promises[i] = createAgaveCall(username);
            }

            return promises.reduce(Q.when, new Q());
        })
        ;

};

module.exports = FileUploadJob;
