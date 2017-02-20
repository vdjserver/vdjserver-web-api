
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

    return agaveIO.getProjectFileMetadataByFilename(this.projectUuid, this.fileUuid)
        .then(function(fileMetadata) {
	    if (fileMetadata.length != 0) {
		console.log('VDJ-API INFO: FileUploadJob.createAgaveFileMetadata - metadata already exists, skipping creation.');
		return;
	    } else {
		return agaveIO.getFileDetail(that.getRelativeFilePath())
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
		    });
	    }
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

    var path = this.getRelativeFilePath();

    var isAvailable = false;

    var that = this;
    return agaveIO.getFileHistory(path)
        .then(function(fileHistory) {

            let availabilityTime = moment().subtract('2', 'minutes');

            for (let i = 0; i < fileHistory.length; i++) {
                let history = fileHistory[i];

                let historyDatetime = moment(history.created);
		//console.log(availabilityTime);
		//console.log(historyDatetime.isAfter(availabilityTime));
		//console.log(history.status);

                //if (history.hasOwnProperty('status') && history.status === 'TRANSFORMING_COMPLETED' && historyDatetime.isAfter(availabilityTime)) {
                if (history.hasOwnProperty('status') && history.status === 'TRANSFORMING_COMPLETED') {
                    isAvailable = true;
		    return agaveIO.getFileDetail(path);
                }

		// this is a drop through for directories
                if (history.hasOwnProperty('status') && history.status === 'CREATED') {
		    return agaveIO.getFileDetail(path);
                }

            };
	    
	    return null;
        })
        .then(function(fileHistory) {
	    if (!fileHistory) return isAvailable;

	    if (fileHistory.length > 1) {
		return Q.reject(new Error('file path: ' + path + ' returned more than one detail records, maybe a directory?'))
	    } else {
		if (fileHistory[0].format == 'folder') {
		    return Q.reject(new Error('file path: ' + path + ' is a directory.'))
		} else {
		    var metadataString = fileHistory[0]._links.metadata.href;
		    var split = metadataString.split('%22');
		    //console.log(split);
		    if (split[3] != that.fileUuid) return Q.reject(new Error('fileUuid: ' + that.fileUuid + ' does not match uuid ' + split[3] + ' for filePath: ' + path));

		    return isAvailable;
		}
	    }
	})
        ;
};

FileUploadJob.prototype.verifyFileNotification = function() {

    if (this.fileUuid.length == 0) return Q.reject(new Error('Missing fileUuid'));
    if (this.filePath.length == 0) return Q.reject(new Error('Missing filePath'));
    if (this.projectUuid.length == 0) return Q.reject(new Error('Missing projectUuid'));

    var path = this.getRelativeFilePath();

    var uuid = this.getProjectId();
    if (uuid != this.projectUuid) return Q.reject(new Error('file path: ' + path + ' does not match project id: ' + this.projectUuid));

    return Q.resolve();
};

module.exports = FileUploadJob;
