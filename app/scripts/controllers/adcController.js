
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

// Queues
var adcDownloadQueueManager = require('../queues/adcDownloadQueueManager');

// Models
var User = require('../models/user');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

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

    if (adc && adc.length == 1)
        return apiResponseController.sendSuccess(adc[0]['value'], response);
    else {
        msg = 'VDJ-API ERROR: ADCController.defaultADCRepositories, could not retrieve.';
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
};

ADCController.updateADCRepositories = async function(request, response) {

    var msg = null;
    var data = request['body']['adc'];
    var value = { adc: data };

    // get list from metadata
    var adc = await agaveIO.getSystemADCRepositories()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCController.updateADCRepositories, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (adc && adc.length == 1) {
        // update
        await agaveIO.updateMetadata(adc[0]['uuid'], adc[0]['name'], value, null)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCController.updateADCRepositories, error while updating: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        return apiResponseController.sendSuccess('Updated', response);
    } else {
        msg = 'VDJ-API ERROR: ADCController.updateADCRepositories, could not retrieve default set.';
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
};

ADCController.getADCDownloadCacheStatus = async function(request, response) {

    var msg = null;

    // get list from metadata
    var cache = await agaveIO.getADCDownloadCache()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCController.getADCDownloadCacheStatus, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (cache && cache.length == 1) {
        return apiResponseController.sendSuccess(cache[0]['value'], response);
    } else {
        msg = 'VDJ-API ERROR: ADCController.getADCDownloadCacheStatus, could not retrieve.';
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
};

ADCController.updateADCDownloadCacheStatus = async function(request, response) {

    var msg = null;
    var operation = request.body.operation;

    // get singleton metadata entry
    var cache = await agaveIO.getADCDownloadCache()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCController.updateADCDownloadCacheStatus, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    if (cache && cache.length == 1) {
        var value = cache[0]['value'];
        console.log('VDJ-API INFO: ADCController.updateADCDownloadCacheStatus, current enable_cache = ' + value['enable_cache']);

        if (operation == 'enable') value['enable_cache'] = true;
        if (operation == 'disable') value['enable_cache'] = false;
        if (operation == 'trigger') value['enable_cache'] = true;

        // update
        await agaveIO.updateMetadata(cache[0]['uuid'], cache[0]['name'], value, null)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCController.updateADCDownloadCacheStatus, error while updating: ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 500, response);
        }

        if (operation == 'trigger') {
            // trigger the process
            adcDownloadQueueManager.triggerDownloadCache();
        }

        console.log('VDJ-API INFO: ADCController.updateADCDownloadCacheStatus, updated enable_cache = ' + value['enable_cache']);
        return apiResponseController.sendSuccess('Updated', response);
    } else {
        msg = 'VDJ-API ERROR: ADCController.updateADCDownloadCacheStatus, could not retrieve metadata entry.';
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }
};

ADCController.updateADCDownloadCacheForStudy = async function(request, response) {

    var msg = null;

    return apiResponseController.sendError('Not implemented', 500, response);
};

ADCController.deleteADCDownloadCacheForStudy = async function(request, response) {

    var msg = null;

    return apiResponseController.sendError('Not implemented', 500, response);
};

ADCController.updateADCDownloadCacheForRepertoire = async function(request, response) {

    var msg = null;

    return apiResponseController.sendError('Not implemented', 500, response);
};

ADCController.deleteADCDownloadCacheForRepertoire = async function(request, response) {

    var msg = null;

    return apiResponseController.sendError('Not implemented', 500, response);
};
