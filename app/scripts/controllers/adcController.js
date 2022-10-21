
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

// App
var config = require('../config/config');
var app = require('../app');
var mongoSettings = require('../config/mongoSettings');

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
var mongoIO = require('../vendor/mongoIO');

ADCController.statusADCRepository = async function(request, response) {

    var msg = null;

    var status = { query_collection: mongoSettings.queryCollection, load_collection: mongoSettings.loadCollection };

    var result = await mongoIO.testConnection();
    status['db_connection'] = result;

    return apiResponseController.sendSuccess(status, response);
};

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

    // TODO: change this to support the staging and develop entries

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

ADCController.getADCDownloadCacheForStudies = async function(request, response) {
    if (config.debug) console.log('VDJ-API INFO (ADCController.getADCDownloadCacheForStudies)');

    var msg = null;

    // all cached studies for all repositories
    var cached_studies = await agaveIO.getStudyCacheEntries(null, null, true, true)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCController.getADCDownloadCacheForStudies, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    // clean up the output results
    var results = [];
    for (var i in cached_studies) {
        var entry = cached_studies[i]['value'];
        entry['cache_uuid'] = cached_studies[i]['uuid'];
        results.push(entry);
    }

    return apiResponseController.sendSuccess(results, response);
}

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

ADCController.notifyADCDownloadCache = async function(request, response) {
    console.log('VDJ-API INFO: Received ADCDownloadCache notification id:', request.params.notify_id, 'body:', JSON.stringify(request.body));

    var msg = null;
    var notify_id = request.params.notify_id;
    var notify_obj = request.body;

    // return a response
    response.status(200).json({"message":"notification received."});

    if (notify_obj['status'] != 'FINISHED')
        return Promise.resolve();

    // search for metadata item based on notification id
    var metadata = await agaveIO.getMetadata(notify_id)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (ADCController.notifyADCDownloadCache): Could not get metadata for notification id: ' + notify_id + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    // do some error checking
    console.log(metadata);
    if (metadata['name'] == 'adc_cache_repertoire') {
        // notification from ADC ASYNC that our query is done
        if (metadata['value']['async_query_id'] != notify_obj['query_id']) {
            msg = 'VDJ-API ERROR (ADCController.notifyADCDownloadCache): Query id does not match: '
                + metadata['value']['async_query_id']  + ' != ' + notify_obj['query_id'];
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }

        // get study cache metadata
        var cs = await agaveIO.getStudyCacheEntries(metadata['value']['repository_id'], metadata['value']['study_id'])
            .catch(function(error) {
                msg = 'VDJ-API ERROR (ADCController.notifyADCDownloadCache): agaveIO.getCachedStudies error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
        if (cs.length != 1) {
            msg = 'VDJ-API ERROR (ADCController.notifyADCDownloadCache): Expected single metadata entry but got '
                + cs.length + ' for repository: ' + metadata['value']['repository_id'] + ' and study_id: ' + metadata['value']['study_id'];
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        }
        var study_cache = cs[0];

        // The finish queue will guard against duplicate notifications

        // submit the job to finish the download
        adcDownloadQueueManager.finishDownload({study_cache: study_cache, repertoire_cache: metadata, query_status: notify_obj});
    } else {
        msg = 'VDJ-API ERROR (ADCController.notifyADCDownloadCache): Unknown notification: '
            + notify_id + 'body:' + JSON.stringify(notify_obj);
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.reject(new Error(msg));
    }

    return Promise.resolve();
};
