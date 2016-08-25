
'use strict';

var _ = require('underscore');

// Models
var ServiceAccount = require('./serviceAccount');
var FilePermissions = require('./filePermissions');

// Node Libraries
var Q = require('q');
let moment = require('moment');

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
        this.vdjFileType = kueAttributes.vdjFileType || '';
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

        // urlencode filename, otherwise nonalphanumeric characters can cause Agave errors
        // Be careful not to encode the entire file path though, because that can also cause errors
        split[split.length - 1] = encodeURIComponent(split[split.length - 1]);

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

    return ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), that.projectUuid);
	})
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
                                ServiceAccount.accessToken(),
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

            const defaultVdjFileType = 4;

            // VDJ File Type
            if (_.isEmpty(that.vdjFileType) === false) {

                try {
                    that.vdjFileType = parseInt(that.vdjFileType);
                }
                catch (e) {
                    that.vdjFileType = defaultVdjFileType;
                }
            }
            else {
                that.vdjFileType = defaultVdjFileType;
            }

            // Read Direction
            if (_.isEmpty(that.readDirection) === true) {
                that.readDirection = '';
            }

            // Tags
            if (_.isEmpty(that.tags) === true) {
                that.tags = [];
            }
            else {

                var splitTags = that.tags.split(',');

                var tags = splitTags.map(function(tag) {

                    return tag.trim();
                });

                that.tags = tags;
            }

            return agaveIO.createFileMetadata(that.fileUuid, that.projectUuid, that.vdjFileType, name, length, that.readDirection, that.tags);
        })
        ;
};

FileUploadJob.prototype.setAgaveFilePermissions = function() {

    var that = this;

    // Create file metadata
    // Set metadata pems

    //console.log("relativeFilePath is: " + this.getRelativeFilePath());

    if (this.projectUuid === '') {
        var deferred = Q.defer();

        var error = new Error('Unable to parse project id for file: ' + this.fileUuid);
        deferred.reject(error);

        return deferred.promise;
    }

    return ServiceAccount.getToken()
	.then(function(token) {
	    return agaveIO.getMetadataPermissions(ServiceAccount.accessToken(), that.projectUuid)
	})
        .then(function(projectPermissions) {

            var filePermissions = new FilePermissions();

            var projectUsernames = filePermissions.getUsernamesFromMetadataResponse(projectPermissions);

            var relativeFilePath = that.getRelativeFilePath();

            var promises = [];

            function createAgaveCall(username) {

                return function() {

                    return agaveIO.addUsernameToFullFilePermissions(
                        username,
                        ServiceAccount.accessToken(),
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

FileUploadJob.prototype.checkFileAvailability = function() {

    return agaveIO.getFileHistory(this.getRelativeFilePath())
        .then(function(fileHistory) {

            let isAvailable = false;

            let availabilityTime = moment().subtract('2', 'minutes');

            for (let i = 0; i < fileHistory.length; i++) {
                let history = fileHistory[i];

                let historyDatetime = moment(history.created);

                if (history.hasOwnProperty('status') && history.status === 'TRANSFORMING_COMPLETED' && historyDatetime.isAfter(availabilityTime)) {
                    isAvailable = true;
                    break;
                }
            };

            return isAvailable;
        })
        ;
};

module.exports = FileUploadJob;
