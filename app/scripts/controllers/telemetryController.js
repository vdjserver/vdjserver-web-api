
'use strict';

//
// telemetryController.js
// Handle telemetry end point
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var TelemetryController = {};
module.exports = TelemetryController;

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var webhookIO = require('vdj-tapis-js/webhookIO');

// Controllers
var apiResponseController = require('./apiResponseController');

// Retrieves a new user token from Agave and returns it to the client
TelemetryController.recordErrorTelemetry = function(request, response) {

    // the user profile is set from the authorization check
    var telemetry = request.body.telemetry;
    telemetry['username'] = request.user.username;
    telemetry['email'] = request.user.email;

    console.error('TelemetryController.recordErrorTelemetry - error - ' + JSON.stringify(telemetry));
    webhookIO.postToSlack(JSON.stringify(telemetry, null, 2));

    apiResponseController.sendSuccess('', response);
};
