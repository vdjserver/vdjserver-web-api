
'use strict';

//
// adcController.js
// Handle ADC endpoints
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

var ADCController = {};
module.exports = ADCController;

var config = require('../config/config');

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

ADCController.defaultADCRepositories = async function(request, response) {

    var msg = null;

    // get list from metadata
    var adc = await agaveIO.getSystemADCRepositories()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCController.defaultADCRepositories, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    apiResponseController.sendSuccess(adc['value'], response);
};

ADCController.updateADCRepositories = async function(request, response) {

    var msg = null;

    return apiResponseController.sendError('Not implemented', 500, response);
};
