
'use strict';

//
// adcDownloadQueueManager.js
// Manage ADC download cache tasks
//
// VDJServer Analysis Portal
// VDJ Web API service
// https://vdjserver.org
//
// Copyright (C) 2021 The University of Texas Southwestern Medical Center
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

var ADCDownloadQueueManager = {};
module.exports = ADCDownloadQueueManager;

// App
var app = require('../app');
var config = require('../config/config');
var agaveSettings = require('../config/agaveSettings');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var webhookIO = require('../vendor/webhookIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Queue = require('bull');

//
// Trigger the download cache process
//
// Because populating the download cache is resource intensive, we
// only want one task occurring at a time. Here we check the task
// queues to see if any are running.
//
ADCDownloadQueueManager.triggerDownloadCache = function() {
    if (config.debug) console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache');
}

    // Create cache entries

    // get set of ADC repositories
    
    // for each repository to be cached
    
        // get repertoires from the repository
        // get unique studies from the repertoires
        
        // for each study
        // if cache entry does not exist, create entry
        
        // for each repertoire in study
        // if cache entry does not exist, create entry

