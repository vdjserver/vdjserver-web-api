
'use strict';

var _ = require('underscore');

// Models
var ServiceAccount = require('./serviceAccount');

// Node Libraries
var moment = require('moment');
var Q = require('q');

// Processing
var agaveIO = require('../vendor/agaveIO');

var Job = function(kueAttributes) {

    /*
    if (typeof kueAttributes === 'object') {
        this.fileUuid  = kueAttributes.fileUuid  || '';
        this.fileEvent = kueAttributes.fileEvent || '';
        this.fileType  = kueAttributes.fileType  || '';
        this.filePath  = kueAttributes.filePath  || '';
        this.fileSystem = kueAttributes.fileSystem || '';
    }
    */
};

Job.prototype.createArchivePath = function(projectUuid, name) {
    var archivePath = '/projects'
                    + '/' + projectUuid
                    + '/analyses'
                    + '/' + moment().format('YYYY-MM-DD-HH-mm-ss-SS') + '-' + this._getDirectorySafeName(name)
                    ;

    return archivePath;
};

Job.prototype._getDirectorySafeName = function(name) {
    return name.replace(/\s/g, '-').toLowerCase();
};

Job.prototype.convertToRelativeArchivePath = function(absoluteArchivePath) {
    var archivePathSplit = absoluteArchivePath.split('/');
    var relativeArchivePath = archivePathSplit.pop();

    return relativeArchivePath;
};

Job.prototype.getJobNotification = function(projectUuid, jobName) {
    return {
        'url': process.env.VDJ_API_URL
               + '/notifications/jobs/${JOB_ID}'
               + '?status=${JOB_STATUS}'
               + '&event=${EVENT}'
               + '&error=${JOB_ERROR}'
               + '&projectUuid=' + projectUuid
               + '&jobName=' + encodeURIComponent(jobName)
               ,
        'event': '*',
        'persistent': true,
	'policy': {
	    'saveOnFailure': true
	}
    };
};

Job.prototype.deconstructJobListingUrl = function(jobOutput) {
    //var archivePath = jobOutput._links.archiveData.href;
    var archivePath = jobOutput.archivePath;

    var splitArchivePath = archivePath.split('/');

    var relativeArchivePath = splitArchivePath[splitArchivePath.length - 1];
    var projectUuid = splitArchivePath[splitArchivePath.length - 3];

    return {
        relativeArchivePath: relativeArchivePath,
        projectUuid: projectUuid,
    };
};

// files we can ignore
Job.prototype.isWhitelistedFiletype = function(filename) {
    var filenameSplit = filename.split('.');
    var fileExtension = filenameSplit[filenameSplit.length - 1];
    var doubleFileExtension = filenameSplit[filenameSplit.length - 2] + '.' + filenameSplit[filenameSplit.length - 1];

    // Whitelisted files
    if (filename === '.') return true;
    if (filename === '..') return true;
    if (fileExtension === 'pid') return true;
    if (filename === '.agave.archive') return true;
    // if (doubleFileExtension === 'rc_out.tsv') return true;

    return false;
};

module.exports = Job;
