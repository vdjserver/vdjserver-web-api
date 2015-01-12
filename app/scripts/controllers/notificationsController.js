
'use strict';

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');
var jobController = require('./jobsController');

// Node Libraries
//var Q = require('q');

var NotificationsController = {};
module.exports = NotificationsController;

NotificationsController.processJobNotifications = function(request, response) {

    var jobId   = request.params.jobId;
    var jobEvent  = request.query.event;
    var jobStatus = request.query.status;
    var jobMessage  = request.query.error;

    console.log('Job Id \'' + jobId + '\' received a notification. New status is: ' + jobStatus);

    app.emit(
        'jobNotification',
        {
            jobId: jobId,
            jobEvent: jobEvent,
            jobStatus: jobStatus,
            jobMessage: jobMessage,
        }
    );

    if (jobStatus === 'FINISHED') {
        jobController.createJobFileMetadata(jobId);
    }

    apiResponseController.sendSuccess('ok', response);
};
