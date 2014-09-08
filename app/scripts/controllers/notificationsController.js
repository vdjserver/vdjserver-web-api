
'use strict';

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Node Libraries
var Q = require('q');

var NotificationsController = {};
module.exports = NotificationsController;

NotificationsController.processJobNotifications = function(request, response) {

    var jobId   = request.params.jobId;
    var jobUuid = request.query.uuid;
    var jobEvent  = request.query.event;
    var jobStatus = request.query.status;
    var jobMessage  = request.query.error;

    console.log("request body is: " + JSON.stringify(request.body));
    console.log("request param is: " + JSON.stringify(request.params));
    console.log("request query is: " + JSON.stringify(request.query));

    console.log("jobId: " + jobId);
    console.log("jobUuid: " + jobUuid);
    console.log("jobEvent: " + jobEvent);
    console.log("jobStatus " + jobStatus);
    console.log("jobMessage " + jobMessage);

    app.emit(
        'jobNotification',
        {
            jobId: jobId,
            jobEvent: jobEvent,
            jobStatus: jobStatus,
            jobMessage: jobMessage,
        }
    );

    apiResponseController.sendSuccess('ok', response);
};
