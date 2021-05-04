
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
var adcIO = require('../vendor/adcIO');

// Node Libraries
var Queue = require('bull');

var triggerQueue = new Queue('ADC download cache trigger');
var cacheQueue = new Queue('ADC download cache entry');
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
// queues to see if any are running. If not, we start a cache entry
// job
//

triggerQueue.process(async (job) => {
    var msg = null;

    console.log('VDJ-API INFO: Triggering ADC download cache queue');
    //console.log(job['data']);

    if (config.debug) {
        var triggers = await triggerQueue.getJobs(['active']);
        console.log('VDJ-API INFO: active trigger jobs (' + triggers.length + ')');
        var triggers = await triggerQueue.getJobs(['wait']);
        console.log('VDJ-API INFO: wait trigger jobs (' + triggers.length + ')');
        var triggers = await triggerQueue.getJobs(['delayed']);
        console.log('VDJ-API INFO: delayed trigger jobs (' + triggers.length + ')');
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

    // check if active jobs in queues
    var jobs = await cacheQueue.getJobs(['active']);
    //console.log(jobs);
    //console.log(jobs.length);
    if (jobs.length > 0) {
        console.log('VDJ-API INFO: active jobs (' + jobs.length + ') in ADC download cache entry queue, skip trigger');
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
//
// top level job which gathers what is to be cached,
// creates/updates metadata entries for each cached item,
// then submits smaller individual jobs to generate cache contents
//
// 1. Create/update cache entries
// 2. Get next study/repertoire to be cached
// 3. do the caching
//
submitQueue.process(async (job) => {
    var msg = null;

    console.log('VDJ-API INFO: starting ADC download cache submit job');
    //console.log(job['data']);

    // get set of ADC repositories
    var repos = await agaveIO.getSystemADCRepositories()
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getSystemADCRepositories error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    if (!repos || repos.length != 1) {
        msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getSystemADCRepositories invalid metadata: ' + repos;
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    // create/update cache entries
    repos = repos[0]['value']['adc'];
    console.log(repos);
    for (var repository_id in repos) {
        // only if cache is enabled on repository
        if (! repos[repository_id]['cache_enable']) continue;

        console.log('VDJ-API INFO: ADC download cache submit job for repository:', repository_id);

        // query studies from the ADC repository
        var studies = await adcIO.getStudies(repos[repository_id])
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, adcIO.getStudies error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
        console.log('VDJ-API INFO:', studies.length, 'studies for repository:', repository_id);
        //console.log(studies);

        // get any cached study entries for the repository
        var cached_studies = await agaveIO.getStudyCacheEntries(repository_id)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getCachedStudies error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
        console.log(cached_studies);
        // turn into dictionary keyed by study_id
        var cached_studies_dict = {};
        for (var i in cached_studies) {
            var study_id = cached_studies[i]['value']['study_id'];
            if (cached_studies_dict[study_id]) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, duplicate study_id: ' + study_id;
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            } else cached_studies_dict[study_id] = cached_studies[i];
        }
        console.log('VDJ-API INFO:', cached_studies.length, 'cache study entries for repository:', repository_id);

        // create study cache entries if necessary
        for (var s in studies) {
            var study_id = studies[s]['study.study_id'];
            console.log(study_id);
            // TODO: we should check if an existing study has been updated
            if (cached_studies_dict[study_id]) continue;
            
            // insert cache entry
            console.log('VDJ-API INFO: ADC study to be cached:', study_id);
            var cache_entry = await agaveIO.createCachedStudyMetadata(repository_id, study_id, true)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.createCachedStudyMetadata error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }
            console.log('VDJ-API INFO: caching enabled for ADC study:', study_id);
            //console.log(cache_entry);
        }

        // reload with any new entries
        cached_studies = await agaveIO.getStudyCacheEntries(repository_id)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getCachedStudies error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
        // turn into dictionary keyed by study_id
        cached_studies_dict = {};
        for (var i in cached_studies) {
            var study_id = cached_studies[i]['value']['study_id'];
            if (cached_studies_dict[study_id]) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, duplicate study_id: ' + study_id;
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            } else cached_studies_dict[study_id] = cached_studies[i];
        }
        console.log('VDJ-API INFO:', cached_studies.length, 'cache study entries for repository:', repository_id);
        //console.log(cached_studies);

        // create repertoire cache entries if necessary
        for (var s in cached_studies) {
            if (! cached_studies[s]['value']['should_cache']) continue;
            if (cached_studies[s]['value']['is_cached']) continue;
            var study_id = cached_studies[s]['value']['study_id'];

            // query repertoires from the ADC repository for the study
            var reps = await adcIO.getRepertoires(repos[repository_id], study_id)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, adcIO.getRepertoires error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }
            console.log('VDJ-API INFO:', reps.length, 'repertoires for study:', study_id);
            //console.log(reps);

            // get any cached repertoire entries for the study
            var cached_reps = await agaveIO.getRepertoireCacheEntries(repository_id, study_id, null, null, null)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getRepertoireCacheEntries error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }
            // turn into dictionary keyed by repertoire_id
            var cached_reps_dict = {};
            for (var i in cached_reps) {
                var repertoire_id = cached_reps[i]['value']['repertoire_id'];
                if (cached_reps_dict[repertoire_id]) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, duplicate repertoire_id: ' + repertoire_id;
                    console.error(msg);
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                } else cached_reps_dict[repertoire_id] = cached_reps[i];
            }
            console.log('VDJ-API INFO:', cached_reps.length, 'cache repertoire entries for study:', study_id);

            for (var r in reps) {
                var repertoire_id = reps[r]['repertoire_id'];
                console.log(repertoire_id);
                // TODO: we might want to update the existing entry
                if (cached_reps_dict[repertoire_id]) continue;

                // create cache entry
                var cache_entry = await agaveIO.createCachedRepertoireMetadata(repository_id, study_id, repertoire_id, true)
                    .catch(function(error) {
                        msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.createCachedRepertoireMetadata error ' + error;
                    });
                if (msg) {
                    console.error(msg);
                    webhookIO.postToSlack(msg);
                    return Promise.resolve();
                }
                console.log('VDJ-API INFO: caching enabled for ADC repertoire:', repertoire_id, 'for study:', study_id);
            }
        }
    }

    // All cache entries should be created/updated
    // Now do the caching

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

