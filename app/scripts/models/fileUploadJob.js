
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

    if (typeof kueAttributes.data === 'object') {
        this.fileUuid = kueAttributes.data.fileUuid || '';
        this.fileEvent = kueAttributes.data.fileEvent || '';
        this.fileType = kueAttributes.data.fileType || '';
        this.filePath = kueAttributes.data.filePath || '';
        this.fileSystem = kueAttributes.data.fileSystem || '';
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

FileUploadJob.prototype.getProjectId = function() {
    var response = '';

    if (this.filePath !== '') {

        var tmpFilePath = this.filePath;

        var split = tmpFilePath.split('/');

        response = split[3];
    }

    return response;
};

FileUploadJob.prototype.setMetadataPermissions = function() {

    var that = this;

    var serviceAccount = new ServiceAccount();

    return agaveIO.getMetadataPermissions(serviceAccount.accessToken, this.getProjectId())
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            return agaveIO.getProjectFileMetadataByFilename(that.getProjectId(), that.fileUuid)
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

            return agaveIO.createFileMetadata(that.fileUuid, that.getProjectId(), 4, name, length);
        })
        ;
};

FileUploadJob.prototype.setAgaveFilePermissions = function() {

    var that = this;

    // Create file metadata
    // Set metadata pems
    var serviceAccount = new ServiceAccount();

    //console.log("proj id is: " + this.getProjectId());
    //console.log("relativeFilePath is: " + this.getRelativeFilePath());

    var projectId = this.getProjectId();

    if (projectId === '') {
        var deferred = Q.defer();

        var error = new Error('Unable to parse project id for file: ' + this.fileUuid);
        deferred.reject(error);

        return deferred.promise;
    }

    return agaveIO.getMetadataPermissions(serviceAccount.accessToken, this.getProjectId())
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

            /*
            var deferred = Q.defer();
            deferred.resolve();

            return deferred.promise;
            */
        })
        ;

};

module.exports = FileUploadJob;
