
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Node Libraries
var Q = require('q');

var TelemetryController = {};
module.exports = TelemetryController;

// Retrieves a new user token from Agave and returns it to the client
TelemetryController.recordErrorTelemetry = function(request, response) {

    console.error('Telemetry Error is: ' + JSON.stringify(request.body));

    apiResponseController.sendSuccess('', response);
};
