
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

    if (!jobId) {
        console.error('Error NotificationsController.processJobNotifications: missing jobId parameter');
        apiResponseController.sendError('Job id required.', 400, response);
        return;
    }

    if (!jobEvent) {
        console.error('Error NotificationsController.processJobNotifications: missing jobEvent parameter');
        apiResponseController.sendError('Job event required.', 400, response);
        return;
    }

    if (!jobStatus) {
        console.error('Error NotificationsController.processJobNotifications: missing jobStatus parameter');
        apiResponseController.sendError('Job status required.', 400, response);
        return;
    }

    if (!jobMessage) {
        console.error('Error NotificationsController.processJobNotifications: missing jobMessage parameter');
        apiResponseController.sendError('Job message required.', 400, response);
        return;
    }

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
