
'use strict';

//
// mongoIO.js
// Functions for direct access to MongoDB
// These are specifically for loading data into the VDJServer ADC Data Repository
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

var mongoIO  = {};
module.exports = mongoIO;

// Server environment config
var config = require('../config/config');
var mongoSettings = require('../config/mongoSettings');

// Processing
var webhookIO = require('../vendor/webhookIO');
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var Q = require('q');
var _ = require('underscore');
var MongoClient = require('mongodb').MongoClient;
var csv = require('csv-parser');
var fs = require('fs');
const zlib = require('zlib');

var airr = require('../vendor/airr');

//
// Clean object by removing fields with null or empty string values
//
mongoIO.cleanObject = function(obj) {
    if (!obj) return;
    if ((typeof obj) != 'object') return;

    var keys = Object.keys(obj);
    for (var k = 0; k < keys.length; ++k) {
        var key = keys[k];
        if (obj[key] == null) {
            delete obj[key];
            continue;
        }
        if ((typeof obj[key]) == 'string') {
            if (obj[key].length == 0) {
                delete obj[key];
                continue;
            }
        }
        if ((typeof obj[key]) == 'array')
            for (var entry in obj[key])
                mongoIO.cleanObject(obj[key][entry]);
        if ((typeof obj[key]) == 'object')
            mongoIO.cleanObject(obj[key]);
    }
}

function getAllSubstrings(str,size) {
  var i, j, result = [];
  size = (size || 4);
  for (i = 0; i < str.length; i++) {
      for (j = str.length; j-i>=size; j--) {
          result.push(str.slice(i, j));
      }
  }
  return result;
}

function getAllSuffixes(str,size) {
    var i, j, result = [];
    size = (size || 4);
    if (str.length < size) return null;
    for (i = 0; i <= (str.length - size); i++) {
        result.push(str.slice(i));
    }
    return result;
}

function parseGene(str) {
    var result = {
        gene: null,
        subgroup: null
    };
    var aidx = str.indexOf('*');
    if (aidx < 0) return null;
    result.gene = str.slice(0,aidx);

    var didx = result.gene.indexOf('-');
    if (didx >= 0) result.subgroup = result.gene.slice(0,didx);
    
    return result;
}

mongoIO.processRearrangementRow = function(row, rep, dp_id, load_set) {
    // identifiers
    if (row['sequence_id']) delete row['sequence_id'];
    if (!row['repertoire_id']) row['repertoire_id'] = rep['repertoire_id'];
    if (row['repertoire_id'].length == 0) row['repertoire_id'] = rep['repertoire_id'];
    if (!row['data_processing_id'])
        row['data_processing_id'] = dp_id;
    if (row['data_processing_id'].length == 0)
        row['data_processing_id'] = dp_id;
    row['vdjserver_load_set'] = load_set

    // change V gene calls to an array, add gene and subgroup
    if ((typeof row['v_call']) == 'string') {
        var fields = row['v_call'].split(',');
        if (fields.length > 1) {
            row["v_call"] = fields;
            var genes = [];
            var subgroups = []
            for (var i = 0; i < fields.length; ++i) {
                var c = fields[i];
                var result = parseGene(c);
                if (!result) {
                    genes.push(null);
                    subgroups.push(null);
                } else {
                    genes.push(result.gene);
                    subgroups.push(result.subgroup);
                }
            }
            row["v_gene"] = genes;
            row["v_subgroup"] = subgroups;
        } else {
            var result = parseGene(row['v_call']);
            if (result) {
                row["v_gene"] = result.gene;
                if (result.subgroup) row["v_subgroup"] = result.subgroup;
            }
        }
    } else if (row['v_call']) {
        var genes = [];
        var subgroups = []
        for (var i = 0; i < row['v_call'].length; ++i) {
            var c = row['v_call'][i];
            var result = parseGene(c);
            if (!result) {
                genes.push(null);
                subgroups.push(null);
            } else {
                genes.push(result.gene);
                subgroups.push(result.subgroup);
            }
        }
        row["v_gene"] = genes;
        row["v_subgroup"] = subgroups;
    }

    // change D gene calls to an array, add gene and subgroup
    if ((typeof row['d_call']) == 'string') {
        var fields = row['d_call'].split(',');
        if (fields.length > 1) {
            //printjson(fields);
            row["d_call"] = fields;
            var genes = [];
            var subgroups = []
            for (var i = 0; i < fields.length; ++i) {
                var c = fields[i];
                var result = parseGene(c);
                if (!result) {
                    genes.push(null);
                    subgroups.push(null);
                } else {
                    genes.push(result.gene);
                    subgroups.push(result.subgroup);
                }
            }
            row["d_gene"] = genes;
            row["d_subgroup"] = subgroups;
        } else {
            var result = parseGene(row['d_call']);
            if (result) {
                row["d_gene"] = result.gene;
                if (result.subgroup) row["d_subgroup"] = result.subgroup;
            }
        }
    } else if (row['d_call']) {
        var genes = [];
        var subgroups = []
        for (var i = 0; i < row['d_call'].length; ++i) {
            var c = row['d_call'][i];
            var result = parseGene(c);
            if (!result) {
                genes.push(null);
                subgroups.push(null);
            } else {
                genes.push(result.gene);
                subgroups.push(result.subgroup);
            }
        }
        row["d_gene"] = genes;
        row["d_subgroup"] = subgroups;
    }

    // change J gene calls to an array, add gene and subgroup
    if ((typeof row['j_call']) == 'string') {
        var fields = row['j_call'].split(',');
        if (fields.length > 1) {
            //printjson(fields);
            row["j_call"] = fields;
            var genes = [];
            var subgroups = []
            for (var i = 0; i < fields.length; ++i) {
                var c = fields[i];
                var result = parseGene(c);
                if (!result) {
                    genes.push(null);
                    subgroups.push(null);
                } else {
                    genes.push(result.gene);
                    subgroups.push(result.subgroup);
                }
            }
            row["j_gene"] = genes;
            row["j_subgroup"] = subgroups;
        } else {
            var result = parseGene(row['j_call']);
            if (result) {
                row["j_gene"] = result.gene;
                if (result.subgroup) row["j_subgroup"] = result.subgroup;
            }
        }
    } else if (row['j_call']) {
        var genes = [];
        var subgroups = []
        for (var i = 0; i < row['j_call'].length; ++i) {
            var c = row['j_call'][i];
            var result = parseGene(c);
            if (!result) {
                genes.push(null);
                subgroups.push(null);
            } else {
                genes.push(result.gene);
                subgroups.push(result.subgroup);
            }
        }
        row["j_gene"] = genes;
        row["j_subgroup"] = subgroups;
    }

    // junction substrings
    if (row['junction_aa']) {
        if (row['junction_aa'].length > 3) {
            //var result = getAllSubstrings(row['junction_aa'], 4);
            //row["vdjserver_junction_substrings"] = result;
            var result = getAllSuffixes(row['junction_aa'], 4);
            row["vdjserver_junction_suffixes"] = result;
        }
    }

    return;
}

mongoIO.processFile = async function(filename, rep, dp_id, dataLoad, load_set, load_set_start, loadCollection) {
    var deferred = Q.defer();

    var records = [];
    var rows = [];
    var total_cnt = 0;

    var schema = airr.getSchema('Rearrangement');
    //console.log(schema.spec('sequence_id'));

    var mapValues = function(map) {
        return schema.map_value(map);
    };

    var readable = fs.createReadStream(filename)
        .pipe(zlib.createGunzip())
        .pipe(csv({separator:'\t', mapValues: mapValues}))
        .on('data', async function(row) {
            rows.push(row);
            if (rows.length == 10000) {
                // pause the stream while we insert the data
                readable.pause();

                if (load_set >= load_set_start) {
                    console.log('VDJ-API INFO: mongoIO.loadRearrangementData, inserting load set: ' + load_set);
                    // process and cleanup records
                    for (var r = 0; r < rows.length; ++r) {
                        //if (r == 0) console.log(rows[r]);
                        mongoIO.processRearrangementRow(rows[r], rep, dp_id, load_set);
                        mongoIO.cleanObject(rows[r]);
                        records.push(rows[r]);
                    }

                    // perform the database insert
                    await mongoIO.insertRearrangement(records, loadCollection);

                    // update rearrangement data load record
                    var retry = false;
                    dataLoad['value']['load_set'] = load_set + 1;
                    await agaveIO.updateMetadata(dataLoad.uuid, dataLoad.name, dataLoad.value, dataLoad.associationIds)
                        .fail(function(error) {
	                    var msg = 'VDJ-API ERROR: mongoIO.processFile, updateMetadata error occurred, error: ' + error;
                            console.error(msg);
                            retry = true;
                        });
                    if (retry) {
                        console.log('VDJ-API INFO: mongoIO.processFile, retrying updateMetadata');
                        await agaveIO.updateMetadata(dataLoad.uuid, dataLoad.name, dataLoad.value, dataLoad.associationIds)
                            .fail(function(error) {
	                        var msg = 'VDJ-API ERROR: mongoIO.processFile, updateMetadata error occurred, error: ' + error;
                                console.error(msg);
                                return deferred.reject(msg);
                            });
                    }
                } else {
                    console.log('VDJ-API INFO: mongoIO.loadRearrangementData, skipping load set: ' + load_set);
                }
                total_cnt += records.length;
                ++load_set;
                records = [];
                rows = [];
                // resume the stream
                readable.resume();
            }
        })
        .on('end', async function() {
            if (rows.length > 0) {
                if (load_set >= load_set_start) {
                    console.log('VDJ-API INFO: mongoIO.loadRearrangementData, end file, inserting load set: ' + load_set);
                    // process and cleanup records
                    for (var r = 0; r < rows.length; ++r) {
                        //if (r == 0) console.log(rows[r]);
                        mongoIO.processRearrangementRow(rows[r], rep, dp_id, load_set);
                        mongoIO.cleanObject(rows[r]);
                        records.push(rows[r]);
                    }

                    // perform the database insert
                    await mongoIO.insertRearrangement(records, loadCollection);

                    // update rearrangement data load record
                    var retry = false;
                    dataLoad['value']['load_set'] = load_set + 1;
                    await agaveIO.updateMetadata(dataLoad.uuid, dataLoad.name, dataLoad.value, dataLoad.associationIds)
                        .fail(function(error) {
	                    var msg = 'VDJ-API ERROR: mongoIO.processFile, updateMetadata error occurred, error: ' + error;
                            console.error(msg);
                            retry = true;
                        });
                    if (retry) {
                        console.log('VDJ-API INFO: mongoIO.processFile, retrying updateMetadata');
                        await agaveIO.updateMetadata(dataLoad.uuid, dataLoad.name, dataLoad.value, dataLoad.associationIds)
                            .fail(function(error) {
	                        var msg = 'VDJ-API ERROR: mongoIO.processFile, updateMetadata error occurred, error: ' + error;
                                console.error(msg);
                                return deferred.reject(msg);
                            });
                    }

                } else {
                    console.log('VDJ-API INFO: mongoIO.loadRearrangementData, end file, skipping load set: ' + load_set);
                }
                total_cnt += records.length;
                ++load_set;
                records = [];
                rows = [];
            }
            console.log('VDJ-API INFO: mongoIO.loadRearrangementData, file successfully processed: ' + filename + ', rearrangement count: ' + total_cnt);
            return deferred.resolve(load_set);
        });
    return deferred.promise;
}

// Delete all rearrangements for a repertoire_id or for
// just a given load_set.
mongoIO.deleteLoadSet = async function(repertoire_id, load_set, loadCollection) {
    var deferred = Q.defer();

    console.log('VDJ-API INFO: mongoIO.deleteLoadSet, repertoire: ' + repertoire_id + ' load set: ' + load_set);

    // get connection to database
    MongoClient.connect(mongoSettings.url, async function(err, db) {
        if (err) {
            var msg = "Could not connect to database: " + err;
            console.error(msg);
            deferred.reject(new Error(msg))
        } else {
            var v1airr = db.db(mongoSettings.dbname);
            var collection = v1airr.collection(loadCollection);

            // delete load_set for repertoire
            var filter = {"repertoire_id":repertoire_id}
            if (load_set >= 0)
                filter['vdjserver_load_set'] = load_set;
            console.log(filter);

            var result = await collection.deleteMany(filter);
            console.log('VDJ-API INFO: mongoIO.deleteLoadSet, deleted rearrangements: ' + result);
            db.close();
            deferred.resolve(result);
        }
    });

    return deferred.promise;
}

// Insert rearrangement records
mongoIO.insertRearrangement = async function(records, loadCollection) {
    var deferred = Q.defer();

    // get connection to database
    const client = new MongoClient(mongoSettings.url, { socketTimeoutMS: 0 });
    client.connect(async function(err, db) {
        if (err) {
            var msg = "Could not connect to database: " + err;
            console.error(msg);
            deferred.reject(new Error(msg))
        } else {
            var v1airr = db.db(mongoSettings.dbname);
            //var collection = v1airr.collection('rearrangement');
            var collection = v1airr.collection(loadCollection);

            //var bulk = collection.initializeUnorderedBulkOp();
            //for (var r in records)
            //    bulk.insert(records[r]);
            //var result = await bulk.execute();
            // insert rearrangements
            //console.log(records[0]);
            var result = await collection.insertMany(records);

            console.log('Inserted rearrangements: ' + JSON.stringify(result['result']));
            db.close();
            deferred.resolve(result);
        }
    });

    return deferred.promise;
}

// Delete repertoire for given repertoire_id
mongoIO.deleteRepertoire = async function(repertoire_id, loadCollection) {
    var deferred = Q.defer();

    // get connection to database
    MongoClient.connect(mongoSettings.url, async function(err, db) {
        if (err) {
            var msg = "Could not connect to database: " + err;
            console.error(msg);
            deferred.reject(new Error(msg))
        } else {
            var v1airr = db.db(mongoSettings.dbname);
            var collection = v1airr.collection(loadCollection);

            // delete than insert repertoire
            var filter = {"repertoire_id":repertoire_id}
            console.log(filter);

            var result = await collection.deleteMany(filter);
            console.log('Deleted repertoire: ' + JSON.stringify(result));
            db.close();
            deferred.resolve(result);
        }
    });

    return deferred.promise;
}

// Insert repertoire
mongoIO.insertRepertoire = async function(repertoire, loadCollection) {
    var deferred = Q.defer();

    // get connection to database
    MongoClient.connect(mongoSettings.url, async function(err, db) {
        if (err) {
            var msg = "Could not connect to database: " + err;
            console.error(msg);
            deferred.reject(new Error(msg))
        } else {
            var v1airr = db.db(mongoSettings.dbname);
            var collection = v1airr.collection(loadCollection);

            mongoIO.cleanObject(repertoire);

            // do insert
            var result = await collection.insertOne(repertoire);
            console.log('Inserted repertoire: ' + JSON.stringify(result['result']));
            db.close();
            deferred.resolve(result);
        }
    });

    return deferred.promise;
}

//
// Load a set of repertoire metadata objects
//
mongoIO.loadRepertoireMetadata = async function(repertoireMetadata, collection) {
    var loadCollection = 'repertoire' + collection;
    for (var i in repertoireMetadata) {
        var rep = repertoireMetadata[i];
        var result = await mongoIO.deleteRepertoire(rep['repertoire_id'], loadCollection);
        result = await mongoIO.insertRepertoire(rep, loadCollection);
    }
}

//
// Load rearrangement data for a repertoire
//
mongoIO.loadRearrangementData = async function(dataLoad, repertoire, primaryDP, jobOutput) {
    var filePath = '/vdjZ' + jobOutput['archivePath'];
    var files = primaryDP['data_processing_files'];
    var dp_id = primaryDP['data_processing_id'];
    var loadCollection = 'rearrangement' + dataLoad['value']['collection'];
    var load_set_start = dataLoad['value']['load_set'];
    var load_set = 0;
    var total_cnt = 0;

    // delete starting load set in case it has partial records
    await mongoIO.deleteLoadSet(repertoire['repertoire_id'], load_set_start, loadCollection);

    // loop through files and load
    for (var i = 0; i < files.length; ++i) {
        var filename = filePath + '/' + files[i];
	console.log('VDJ-API INFO: mongoIO.loadRearrangementData, processing file: ' + filename + ' load set start: ' + load_set_start);

        var result = await mongoIO.processFile(filename, repertoire, dp_id, dataLoad, load_set, load_set_start, loadCollection)
            .catch(function(error) {
                // pass reject to next level
	        return Q.reject(error);
            });
        load_set = result;
        //console.log(result);
    }

    // update rearrangement data load record
    dataLoad['value']['isLoaded'] = true;
    await agaveIO.updateMetadata(dataLoad.uuid, dataLoad.name, dataLoad.value, dataLoad.associationIds)
        .fail(function(error) {
	    var msg = 'VDJ-API ERROR: mongoIO.loadRearrangementData, updateMetadata error occurred, error: ' + error;
	    return Q.reject(msg);
        });
}
