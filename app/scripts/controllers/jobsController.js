
'use strict';

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var MetadataPermissions = require('../models/metadataPermissions');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var JobsController = {};
module.exports = JobsController;

JobsController.queueJob = function(request, response) {

    var jobData = request.body;

    taskQueue
        .create('createArchivePathDirectoryTask', jobData)
        .removeOnComplete(true)
        .attempts(5)
        //.backoff({delay: 60 * 1000, type: 'fixed'})
        .save()
        ;

    apiResponseController.sendSuccess('', response);
};
