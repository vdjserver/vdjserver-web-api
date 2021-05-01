
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

var triggerQueue = new Queue('ADC download cache trigger');
var submitQueue = new Queue('ADC download cache submit');
var finishQueue = new Queue('ADC download cache finish');

//
// Trigger the download cache process
// check and create, if necessary, the adc_cache metadata singleton.
// This is called by app initialization
//
ADCDownloadQueueManager.triggerDownloadCache = async function() {
    var msg = null;

    if (config.debug) console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache');
    
    var adc_cache = await agaveIO.getADCDownloadCache()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCDownloadQueueManager.triggerDownloadCache, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return;
    }

    //console.log(adc_cache);
    if (adc_cache.length == 0) {
        console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache, creating adc_cache metadata singleton');

        // create the adc_cache metadata singleton
        adc_cache = await agaveIO.createADCDownloadCache()
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager.triggerDownloadCache, error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return;
        }
    } else {
        adc_cache = adc_cache[0];
    }
    console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache, current enable_cache = ' + adc_cache['value']['enable_cache']);
    //console.log(adc_cache);

    // enable the cache
    console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache, enabling cache');
    adc_cache['value']['enable_cache'] = true;
    await agaveIO.updateMetadata(adc_cache['uuid'], adc_cache['name'], adc_cache['value'], null)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCDownloadQueueManager.triggerDownloadCache, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return;
    }

    // trigger the queue
    console.log('VDJ-API INFO: ADCDownloadQueueManager.triggerDownloadCache, cache enabled, creating queues');
    // submit one job to run immediately and another once per hour
    triggerQueue.add({adc_cache: adc_cache});
    triggerQueue.add({adc_cache: adc_cache}, { repeat: { cron: '0 * * * *' } });
}


//
// Because populating the download cache is resource intensive, we
// only want one task occurring at a time. Here we check the task
// queues to see if any are running. If not, we start a 
//

triggerQueue.process(async (job) => {
    var msg = null;

    console.log('VDJ-API INFO: Triggering ADC download cache queue');
    //console.log(job['data']);

    if (config.debug) {
        var triggers = await triggerQueue.getJobs(['active']);
        console.log('VDJ-API INFO: trigger jobs (' + triggers.length + ')');
        //console.log(triggers);
    }

    // check if active jobs in queues
    var jobs = await submitQueue.getJobs(['active']);
    //console.log(jobs);
    //console.log(jobs.length);
    if (jobs.length > 0) {
        console.log('VDJ-API INFO: active jobs (' + jobs.length + ') in ADC download cache submit queue, skip trigger');
        return Promise.resolve();
    }

    jobs = await finishQueue.getJobs(['active']);
    //console.log(jobs);
    //console.log(jobs.length);
    if (jobs.length > 0) {
        console.log('VDJ-API INFO: active jobs (' + jobs.length + ') in ADC download cache finish queue, skip trigger');
        return Promise.resolve();
    }

    // nothing running so submit
    var adc_cache = await agaveIO.getADCDownloadCache()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: triggerQueue, error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }
    // verify cache is enabled
    if (adc_cache[0]['value']['enable_cache']) {
        console.log('VDJ-API INFO: submitting ADC download cache job');
        submitQueue.add({adc_cache: adc_cache});
    } else {
        console.log('VDJ-API INFO: ADC download cache is not enabled');
    }

    return Promise.resolve();
});

// ADC download cache process
submitQueue.process(async (job) => {
    // submit query LRQ API
    console.log('VDJ-API INFO: starting ADC download cache job');
    //console.log(job['data']);

    // check/create cache entries

    // get set of ADC repositories
    
    // for each repository to be cached
    
        // get repertoires from the repository
        // get unique studies from the repertoires
        
        // for each study
        // if cache entry does not exist, create entry
        
        // for each repertoire in study
        // if cache entry does not exist, create entry

    return Promise.resolve();
});

finishQueue.process(async (job) => {
    // process data
    console.log('process data');
    console.log(job['data']);
    
    // update metadata record
    console.log('update metadata');
    
    return Promise.resolve();
});

