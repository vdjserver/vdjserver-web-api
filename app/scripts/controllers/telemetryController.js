
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Node Libraries
var Q = require('q');

var webhookIO = require('../vendor/webhookIO');

var TelemetryController = {};
module.exports = TelemetryController;

// Retrieves a new user token from Agave and returns it to the client
TelemetryController.recordErrorTelemetry = function(request, response) {

    console.error('TelemetryController.recordErrorTelemetry - error - ' + JSON.stringify(request.body));
    webhookIO.postToSlack(JSON.stringify(request.body));

    apiResponseController.sendSuccess('', response);
};
