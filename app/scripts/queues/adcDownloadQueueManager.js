
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
var fs = require('fs');
const zlib = require('zlib');
var stream = require('stream');
var tar = require('tar');

var triggerQueue = new Queue('ADC download cache trigger');
var cacheQueue = new Queue('ADC download cache entry');
var submitQueue = new Queue('ADC download cache submit');
var finishQueue = new Queue('ADC download cache finish');
var finishStudyQueue = new Queue('ADC download cache study finish');

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
// we attempt to write in a re-entrant fashion
//
submitQueue.process(async (job) => {
    var msg = null;

    console.log('VDJ-API INFO: starting ADC download cache job');
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

    // create/update cache entries for each repository
    repos = repos[0]['value'][config.adcRepositoryEntry];
    //console.log(repos);

    /*
    for (var repository_id in repos) {
        // only if cache is enabled on repository
        if (! repos[repository_id]['enable_cache']) continue;

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
        //console.log(cached_studies);
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
            //console.log(study_id);
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
            var repertoire_metadata = await adcIO.getRepertoires(repos[repository_id], study_id)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, adcIO.getRepertoires error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }
            var reps = repertoire_metadata['Repertoire'];
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
    } */
    console.log('VDJ-API INFO: all cache entries updated.');

    // All cache entries should be created/updated
    // Now do the caching
    // we submit only one job for now, with trigger
    for (var repository_id in repos) {
        // only if cache is enabled on repository
        if (! repos[repository_id]['enable_cache']) continue;

        console.log('VDJ-API INFO: ADC query and download job for repository:', repository_id);

        // get the cached study entries for the repository
        var cached_studies = await agaveIO.getStudyCacheEntries(repository_id)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getCachedStudies error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
        console.log('VDJ-API INFO:', cached_studies.length, 'cache study entries for repository:', repository_id);
        //console.log(cached_studies);

        // check if all of the repertoires have been cached for a study
        for (var s in cached_studies) {
            if (! cached_studies[s]['value']['should_cache']) continue;
            if (cached_studies[s]['value']['is_cached']) continue;
            var study_id = cached_studies[s]['value']['study_id'];

            // get the cached repertoire entries for the study
            var cached_reps = await agaveIO.getRepertoireCacheEntries(repository_id, study_id, null, null, null)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getRepertoireCacheEntries error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }

            // have they all been cached?
            var doneCaching = true;
            var repcnt = 0;
            for (var i in cached_reps) {
                doneCaching &= cached_reps[i]['value']['is_cached'];
                if (cached_reps[i]['value']['is_cached']) repcnt += 1;
            }
            if (doneCaching) {
                console.log('VDJ-API INFO: (submitQueue): all', cached_reps.length, 'repertoires have been cached for study:', study_id);
                finishStudyQueue.add({repository:repos[repository_id], study_cache:cached_studies[s]});
                return Promise.resolve();
            } else {
                console.log('VDJ-API INFO: (submitQueue):', repcnt, 'of', cached_reps.length, 'repertoires have been cached for study:', study_id);
            }
        }

        // should be and not yet cached
        var next_reps = await agaveIO.getRepertoireCacheEntries(repository_id, null, null, true, true, 1)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getRepertoireCacheEntries error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
        console.log(next_reps.length);
        console.log(next_reps);

        if (next_reps.length == 0) {
            console.log('VDJ-API INFO: no more entries need to be cached for repository: ', repository_id);
        } else {
            console.log('VDJ-API INFO:', next_reps.length, 'entries to be cached for repository: ', repository_id);
            var entry = next_reps[0];
            var repv = entry['value'];

            // reload with any new entries
            var cs = await agaveIO.getStudyCacheEntries(repository_id, repv['study_id'], true, true)
                .catch(function(error) {
                    msg = 'VDJ-API ERROR: ADCDownloadQueueManager submitQueue, agaveIO.getCachedStudies error ' + error;
                });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }

            cacheQueue.add({repository:repos[repository_id], study_cache:cs[0], repertoire_cache:entry});
        }
    }

    return Promise.resolve();
});

cacheQueue.process(async (job) => {
    var msg = null;

    console.log('VDJ-API INFO: start ADC query and download job');

    // process data
    console.log(job['data']);
    var repository = job['data']['repository'];
    var repertoire_cache = job['data']['repertoire_cache'];
    var repertoire_id = repertoire_cache['value']['repertoire_id'];
    var study_cache_uuid = job['data']['study_cache']['uuid'];
    var tapis_path = 'agave://data.vdjserver.org//community/cache';

    //console.log(study_cache_uuid);
    console.log('VDJ-API INFO: creating cache directory:', study_cache_uuid);

    await agaveIO.createCommunityCacheDirectory(study_cache_uuid)
        .catch(function(error) {
            msg = 'VDJ-API ERROR: ADCDownloadQueueManager cacheQueue, agaveIO.createCommunityCacheDirectory error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.resolve();
    }

    // does the repertoire_cache already have an async query id
    if (repertoire_cache['value']['async_query_id']) {
        console.log('VDJ-API INFO: repertoire has existing async query:', repertoire_cache['value']['async_query_id']);

        // get status of that query
        var query_status = await adcIO.asyncQueryStatus(repository, repertoire_cache['value']['async_query_id'])
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager cacheQueue, could not get status for ADC ASYNC query '
                    + repertoire_cache['value']['async_query_id'] + ' for repository ' + repository + '\n' + error;
            });
            if (msg) {
                console.error(msg);
                webhookIO.postToSlack(msg);
                return Promise.resolve();
            }

        // if ERROR, then we want to retry the async query
        if (query_status['status'] == 'ERROR') {
            // remove old query id or just let the process below overwrite it?
            console.log('VDJ-API INFO: async query had an error, retrying. Query status:', query_status);
        } else {
            // other statuses probably means it is still running, so just return
            console.log('VDJ-API INFO: async query still processing.');

            // query status is finished then presumably the finishQueue has been notified
            // TODO: may need to handle case when we did not get notification
            if (query_status['status'] == 'FINISHED') {
                console.log('VDJ-API INFO: async query is FINISHED, manually sending notification.');
                // manually send notification
                var notification = { url: agaveSettings.notifyHost + '/api/v2/adc/cache/notify/' + repertoire_cache['uuid'], method: 'POST' };
                await adcIO.sendNotification(notification, query_status)
                    .catch(function(error) {
                        msg = 'VDJ-API ERROR: ADCDownloadQueueManager cacheQueue, could not manually send notification '
                            + repertoire_cache['uuid'] + '\n' + error;
                        console.error(msg);
                        webhookIO.postToSlack(msg);
                    });
            }
            return Promise.resolve();
        }
    }

    // use ADC ASYNC API if supported
    // TODO: we should get this from the repository info
    if (repository['supports_async']) {
        var notification = { url: agaveSettings.notifyHost + '/api/v2/adc/cache/notify/' + repertoire_cache['uuid'], method: 'POST' };
        var query_id = await adcIO.asyncGetRearrangements(repository, repertoire_id, notification)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager cacheQueue, could not submit ADC ASYNC query for repertoire_id '
                    + repertoire_id + ' for repository ' + repository + '\n' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }

        console.log(query_id);

        // save query_id in repertoire cache metadata
        repertoire_cache['value']['async_query_id'] = query_id['query_id'];
        await agaveIO.updateMetadata(repertoire_cache['uuid'], repertoire_cache['name'], repertoire_cache['value'], null)
            .catch(function(error) {
                msg = 'VDJ-API ERROR: ADCDownloadQueueManager cacheQueue, error ' + error;
            });
        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.resolve();
        }
    } else {
        // otherwise we do our own download
    }

    // update cache metadata entry
    //console.log('update metadata');

    // okay we got to the end
    return Promise.resolve();
});

ADCDownloadQueueManager.finishDownload = function(data) {
    finishQueue.add(data);
}

// Create the cached rearrangement file in its final spot
// We directly access the Corral file system
ADCDownloadQueueManager.processRearrangementFile = async function(repertoire_id, filename, cache_dir) {
    var infile = config.lrqdata_path + filename;
    var cache_path = config.vdjserver_data_path + 'community/cache/' + cache_dir + '/';
    var outname = repertoire_id + '.airr.tsv.gz';
    var outfile = cache_path + outname;

    console.log('VDJ-API INFO (ADCDownloadQueueManager.processRearrangementFile): input file:', infile);
    console.log('VDJ-API INFO (ADCDownloadQueueManager.processRearrangementFile): output file:', outfile);

    return new Promise(function(resolve, reject) {
        // Open read/write streams
        var readable = fs.createReadStream(infile)
            .on('error', function(e) { return reject(e); });
        var writable = fs.createWriteStream(outfile)
            .on('error', function(e) { return reject(e); });

        // process the stream
        readable.pipe(zlib.createGzip())
            .on('error', function(e) { return reject(e); })
            .pipe(writable)
            .on('finish', function() {
                console.log('end of stream');
                writable.end();
            });

        writable.on('finish', function() {
            console.log('finish of write stream');
            return resolve(outname);
        });
    });
}

finishQueue.process(async (job) => {
    var msg = null;

    var study_cache = job['data']['study_cache'];
    var repertoire_cache = job['data']['repertoire_cache'];
    var query_status = job['data']['query_status'];
    console.log(study_cache);
    console.log(repertoire_cache);
    console.log(query_status);

    // reload cache metadata, to check if already finished
    var metadata = await agaveIO.getMetadata(repertoire_cache['uuid'])
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishQueuee): Could not get metadata id: ' + repertoire_cache['uuid'] + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });
    if ((! metadata['value']['should_cache']) || (metadata['value']['is_cached'])) {
        console.log('VDJ-API INFO (finishQueue): already cached:',repertoire_cache['uuid'],', skipping finish process');
        return Promise.resolve();
    }

    // locate the file, copy it to the cache directory and gzip
    var outname = await ADCDownloadQueueManager.processRearrangementFile(repertoire_cache['value']['repertoire_id'], query_status['final_file'], study_cache['uuid'])
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishQueue): Could not finish processing rearrangement file for repertoire cache: ' + repertoire_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    // create permanent postit
    var url = 'https://' + agaveSettings.hostname
        + '/files/v2/media/system/'
        + agaveSettings.storageSystem
        + '//community/cache/' + study_cache['uuid'] + '/' + outname
        + '?force=true';

    var postit = await agaveIO.createPublicFilePostit(url, true)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishQueue): Could not create postit for rearrangement file for repertoire cache: ' + repertoire_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    // update the metadata
    if (config.debug) console.log('VDJ-API INFO (finishQueue): Created postit: ' + postit["postit"]);
    repertoire_cache["value"]["archive_file"] = outname;
    repertoire_cache["value"]["postit_id"] = postit["postit"];
    repertoire_cache["value"]["download_url"] = postit["_links"]["self"]["href"];
    repertoire_cache["value"]["is_cached"] = true;
    await agaveIO.updateMetadata(repertoire_cache['uuid'], repertoire_cache['name'], repertoire_cache['value'], null)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishQueue): Could not update metadata for repertoire cache: ' + repertoire_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    console.log('VDJ-API INFO: finishing ADC download cache job');

    ADCDownloadQueueManager.triggerDownloadCache();

    return Promise.resolve();
});

// Create a single archive for the whole study
// We directly access the Corral file system
ADCDownloadQueueManager.processStudyFile = async function(cache_dir, file_list) {
    var cache_path = config.vdjserver_data_path + 'community/cache/' + cache_dir + '/';
    var outfile = 'study.tar';
    var outname = cache_path + outfile;

    console.log('VDJ-API INFO (ADCDownloadQueueManager.processStudyFile):', file_list.length, ' input files');
    console.log('VDJ-API INFO (ADCDownloadQueueManager.processStudyFile): output file:', outname);

    await tar.create({ gzip:false, file:outname, cwd:cache_path }, file_list);

    return Promise.resolve(outfile);
}

// With the rearrangements cached in AIRR TSV files for all repertoires
// in a study, now create archive for the whole study
finishStudyQueue.process(async (job) => {
    var msg = null;

    var repository = job['data']['repository'];
    var study_cache = job['data']['study_cache'];

    console.log('VDJ-API INFO (finishStudyQueue): start job for repository:', study_cache['value']['repository_id'], 'and study:', study_cache['value']['study_id']);

    // reload cache metadata, to check if already finished
    var metadata = await agaveIO.getMetadata(study_cache['uuid'])
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): Could not get metadata id: ' + study_cache['uuid'] + ', error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });
    if ((! metadata['value']['should_cache']) || (metadata['value']['is_cached'])) {
        console.log('VDJ-API INFO (finishStudyQueue): already cached:',study_cache['uuid'],', skipping finish process');
        return Promise.resolve();
    }

    // get the cached repertoire entries for the study
    var cached_reps = await agaveIO.getRepertoireCacheEntries(study_cache['value']['repository_id'], study_cache['value']['study_id'], null, null, null)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): agaveIO.getRepertoireCacheEntries error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.reject(new Error(msg));
    }

    // get all the repertoire metadata for the study and put in file
    var repertoire_metadata = await adcIO.getRepertoires(repository, study_cache['value']['study_id'])
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): agaveIO.getRepertoires error ' + error;
        });
    if (msg) {
        console.error(msg);
        webhookIO.postToSlack(msg);
        return Promise.reject(new Error(msg));
    }

    var cache_path = config.vdjserver_data_path + 'community/cache/' + study_cache['uuid'] + '/';
    var metaname = 'repertoires.airr.json';
    var metafile = cache_path + metaname;
    fs.writeFileSync(metafile, JSON.stringify(repertoire_metadata, null, 2));

    var file_list = ['repertoires.airr.json'];
    for (var i in cached_reps) file_list.push(cached_reps[i]['value']['archive_file']);
    console.log(file_list);

    // TODO: analyze the size of files so that a single archive is not too big, split into multiple files

    // create the study archive
    var outname = await ADCDownloadQueueManager.processStudyFile(study_cache['uuid'], file_list)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): Could not create study archive for study cache: ' + study_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    // create permanent postit
    var url = 'https://' + agaveSettings.hostname
        + '/files/v2/media/system/'
        + agaveSettings.storageSystem
        + '//community/cache/' + study_cache['uuid'] + '/' + outname
        + '?force=true';

    var postit = await agaveIO.createPublicFilePostit(url, true)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): Could not create postit for study archive for study cache: ' + study_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });
    if (config.debug) console.log('VDJ-API INFO (finishStudyQueue): Created postit: ' + postit["postit"]);

    // update the metadata
    study_cache["value"]["archive_file"] = outname;
    study_cache["value"]["postit_id"] = postit["postit"];
    study_cache["value"]["download_url"] = postit["_links"]["self"]["href"];
    study_cache["value"]["is_cached"] = true;
    var stats = fs.statSync(cache_path + outname);
    study_cache["value"]["file_size"] = stats.size;
    await agaveIO.updateMetadata(study_cache['uuid'], study_cache['name'], study_cache['value'], null)
        .catch(function(error) {
            msg = 'VDJ-API ERROR (finishStudyQueue): Could not update metadata for study cache: ' + study_cache['uuid'] + '.\n' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            return Promise.reject(new Error(msg));
        });

    console.log('VDJ-API INFO (finishStudyQueue): end job for repository:', study_cache['value']['repository_id'], 'and study:', study_cache['value']['study_id']);

    // retrigger
    ADCDownloadQueueManager.triggerDownloadCache();

    return Promise.resolve();
});
