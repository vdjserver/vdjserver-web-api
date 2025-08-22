
'use strict';

//
// AnalysisDocument.js
// Analysis workflow document
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020-2021 The University of Texas Southwestern Medical Center
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

var config = require('../config/config');
var vdj_schema = require('vdjserver-schema');
var AnalysisConfig = require('../config/AnalysisConfig');

// cache the schema definition
var schema;

var _ = require('underscore');

var AnalysisDocument = function(document) {
    if (!schema) schema = new vdj_schema.SchemaDefinition('AnalysisDocument');

    // create template from schema
    let doc = schema.template();
    for (let p in doc) {
        this[p] = doc[p];
    }

    // deep copy of attributes
    for (let p in document) {
        this[p] = JSON.parse(JSON.stringify(document[p]));
    }
};
module.exports = AnalysisDocument;

// Tapis
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();

// Customization for VDJServer app:inputs entities
//
// AIRR types like Repertoire and RepertoireGroup get expanded
// into specific tapis file objects. Files are picked by matching
// types for inputs of activities.
//
// Document should be validated before calling this function.
// Call validate after this function to check correct expansion.
AnalysisDocument.prototype.expand_airr_types = async function(project_metadata) {
    var context = 'AnalysisDocument.expand_airr_types';

    if (!project_metadata) return Promise.reject('project metadata is null');
    var project_uuid = project_metadata['uuid'];

    // gather repertoire metadata for the project
    var AIRRMetadata = await tapisIO.gatherRepertoireMetadataForProject(project_metadata, true)
            .catch(function(error) {
                return Promise.reject(error);
            });
    if (AIRRMetadata.length == 0) return Promise.reject('AIRR metadata is null');
    //console.log(AIRRMetadata);

    var repertoires = {};
    for (let i = 0; i < AIRRMetadata.length; ++i) {
        let rep = AIRRMetadata[i];
        repertoires[rep['repertoire_id']] = rep;
    }

    var project_files = await tapisIO.queryMetadataForProject(project_uuid, 'project_file')
            .catch(function(error) {
                return Promise.reject(error);
            });
    config.log.info(context, project_files.length + ' project_file records');
    //console.log(project_files);
    var project_file_map = {};
    for (let i in project_files) project_file_map[project_files[i]['value']['name']] = project_files[i]['uuid'];
    //console.log(project_file_map);

    for (let entity_id in this.entity) {
        let e = this.entity[entity_id];
        if (e['vdjserver:type'] != 'app:inputs') continue;
        if ((e['airr:type'] != 'Repertoire') && (e['airr:type'] != 'RepertoireGroup')) continue;
        // if conditions are met, it must have uuid otherwise it is an error (unresolvable entity)
        if (! e['vdjserver:uuid'])
            return Promise.reject(new Error('Entity ' + entity_id + 'must have vdjserver:uuid to be expanded.'));

        // expand Repertoire entity into files
        // match file types with those used by activities
        // generates entities and uses relations and adds to AnalysisDocument
        var expand_repertoire = function(doc, rep) {
            config.log.info(context, 'expand repertoire: ' + rep);

            // loop through our defined activities(apps)
            for (let activity_id in AnalysisConfig['apps']) {
                // is this tapis app executed in this document
                if (doc.activity['vdjserver:activity:' + activity_id]) {
                    config.log.info(context, 'expanding activity: ' + activity_id);
                    let a = doc.activity['vdjserver:activity:' + activity_id];
                    // what does this app use?
                    let app = AnalysisConfig['apps'][activity_id];
                    for (let input_name in app['vdjserver:activity:uses']) {
                        let found = false;
                        // array to handle multiple samples in repertoire
                        let new_entity_id = [];
                        let extras = [];
                        let new_uses_id = [];
                        for (let ut in app['vdjserver:activity:uses'][input_name]) {
                            let use_type = app['vdjserver:activity:uses'][input_name][ut];
                            //console.log(input_name, use_type);
                            switch(use_type) {
                                case 'sequence_forward_paired_reads':
                                    // identifiers use the forward read file
                                    for (let i in rep['sample']) {
                                        let seqfiles = rep['sample'][i]['sequencing_files'];
                                        //console.log(seqfiles);
                                        if (seqfiles['filename'] && seqfiles['paired_filename']) {
                                            // only the forward read file gets the uses relation and uuid
                                            if ((seqfiles['read_direction'] == 'forward') && (seqfiles['paired_read_direction'] == 'reverse')) {
                                                found = true;
                                                new_entity_id.push('vdjserver:project_file:' + seqfiles['filename']);
                                                let extra = {};
                                                extra[input_name] = seqfiles['filename'];
                                                new_uses_id.push('vdjserver:app:inputs:' + activity_id + ':' + seqfiles['filename']);
                                                if (project_file_map[seqfiles['filename']]) {
                                                    extra['vdjserver:uuid'] = project_file_map[seqfiles['filename']];
                                                }
                                                extras.push(extra);
                                            } else if ((seqfiles['paired_read_direction'] == 'forward') && (seqfiles['read_direction'] == 'reverse')) {
                                                found = true;
                                                new_entity_id.push('vdjserver:project_file:' + seqfiles['paired_filename']);
                                                let extra = {};
                                                extra[input_name] = seqfiles['paired_filename'];
                                                new_uses_id.push('vdjserver:app:inputs:' + activity_id + ':' + seqfiles['paired_filename']);
                                                if (project_file_map[seqfiles['paired_filename']]) {
                                                    extra['vdjserver:uuid'] = project_file_map[seqfiles['paired_filename']];
                                                }
                                                extras.push(extra);
                                            }
                                        }
                                    }
                                    break;

                                case 'sequence_reverse_paired_reads':
                                    // identifiers use the forward read file
                                    // reverse adds another key/value
                                    for (let i in rep['sample']) {
                                        let seqfiles = rep['sample'][i]['sequencing_files'];
                                        //console.log(seqfiles);
                                        if (seqfiles['filename'] && seqfiles['paired_filename']) {
                                            if ((seqfiles['read_direction'] == 'forward') && (seqfiles['paired_read_direction'] == 'reverse')) {
                                                found = true;
                                                new_entity_id.push('vdjserver:project_file:' + seqfiles['filename']);
                                                let extra = {};
                                                extra[input_name] = seqfiles['paired_filename'];
                                                extras.push(extra);
                                            } else if ((seqfiles['paired_read_direction'] == 'forward') && (seqfiles['read_direction'] == 'reverse')) {
                                                found = true;
                                                new_entity_id.push('vdjserver:project_file:' + seqfiles['paired_filename']);
                                                let extra = {};
                                                extra[input_name] = seqfiles['filename'];
                                                extras.push(extra);
                                            }
                                        }
                                    }
                                    break;
                                case 'sequence_single_read':
                                case 'sequence_quality':
                                case 'sequence_reads':
                                case 'archive':
                                case 'compressed':
                                default:
                                    break;
                            }
                        }
                        if (found) {
                            console.log(new_entity_id);
                            console.log(extras);
                            console.log(new_uses_id);
                            // add input entities
                            for (let i = 0; i < new_entity_id.length; ++i) {
                                let newe = new_entity_id[i];
                                let e = null;
                                if (doc.entity[newe]) e = doc.entity[newe];
                                else {
                                    e = { "vdjserver:type": "app:inputs" };
                                    doc.entity[newe] = e;
                                }
                                let extra = extras[i];
                                for (let j in extra) e[j] = extra[j];
                            }
                            //console.log(doc.entity);
                            // add uses relations
                            if (new_uses_id.length > 0) {
                                for (let i = 0; i < new_uses_id.length; ++i) {
                                    let newu = new_uses_id[i];
                                    if (doc.uses[newu]) Promise.reject(new Error('internal error: id is not unique:' + newu));
                                    doc.uses[newu] = { 'prov:activity': 'vdjserver:activity:' + activity_id, 'prov:entity': new_entity_id[i] };
                                }
                                //console.log(doc.uses);
                            }
                        }
                    }
                }
            }
        }

        // get the Repertoire or RepertoireGroup
        let repertoire = null;
        let repertoire_group = null;
        if (e['airr:type'] == 'Repertoire') {
            repertoire = repertoires[e['vdjserver:uuid']];
            if (!repertoire) return Promise.reject(new Error('Entity ' + entity_id + 'with vdjserver:uuid not found: ' + e['vdjserver:uuid']));

            expand_repertoire(this, repertoire);

            //console.log(this.entity);
            //console.log(this.uses);

        } else if (e['airr:type'] == 'RepertoireGroup') {
            let data = await tapisIO.getMetadataForProject(project_uuid, e['vdjserver:uuid'])
                .catch(function(error) {
                    return Promise.reject(error);
                });
            if (data.length == 0)
                return Promise.reject(new Error('Entity ' + entity_id + 'with vdjserver:uuid not found: ' + e['vdjserver:uuid']));

            config.log.info(context, 'expanding group: ' + JSON.stringify(data));
            data = data[0]; // collapse the array

            // if RepertoireGroup then iterate over each Repertoire
            if (data['name'] != 'repertoire_group')
                return Promise.reject(new Error('Entity ' + entity_id + ' has RepertoireGroup airr:type but vdjserver:uuid object is not tapis_name: repertoire_group.'));

                if (data['value'] && data['value']['repertoires']) {
                    for (let rep in data['value']['repertoires']) {
                        let rep_id = data['value']['repertoires'][rep]['repertoire_id'];
                        //console.log(rep_id);
                        repertoire = repertoires[rep_id];
                        if (!repertoire) return Promise.reject(new Error('Repertoire: ' + rep_id + 'not found for RepertoireGroup: ' + e['vdjserver:uuid']));
    
                        //expand_repertoire(rep_data[0]);
                    }
                } // else we ignore empty groups
        }

    }
}

AnalysisDocument.prototype.get_input_entities = function() {
    var inputs = {};

    // input entities are ones that are not generated by an activity
    for (let e in this.entity) {
        let is_input = true;
        for (let g in this.isGeneratedBy) {
            if (this.isGeneratedBy[g]['prov:entity'] == e) {
                is_input = false;
                break;
            }
        }

        if (is_input) inputs[e] = this.entity[e];
    }

    return inputs;
}

AnalysisDocument.prototype.get_available_entities = function() {
    var available = this.get_input_entities();

    for (let e in this.entity) {
        // also, an entity that wasGeneratedBy by an activity which has finished
        let is_available = true;
        for (let w in this.wasGeneratedBy) {
            if ((this.wasGeneratedBy[w]['prov:entity'] == e)
                && (this.activity[this.wasGeneratedBy[w]['prov:activity']]['prov:endTime'])) {
                    is_available = true;
                    break;
                }
        }

        if (is_available) available[e] = this.entity[e];
    }

    return available;
}

AnalysisDocument.prototype.create_job_data = async function(activity_id, project_uuid, allow_alternate=false) {
    var context = 'AnalysisDocument.create_job_data';

    config.log.info(context, 'create job data for activity: ' + activity_id);

    if (!this.activity[activity_id]) return Promise.reject(new Error("Unknown activity: " + activity_id));

    let app = await tapisIO.getApplication(this.activity[activity_id]['vdjserver:app:name'], this.activity[activity_id]['vdjserver:app:version'])
        .catch(function(error) {
            return Promise.reject(error);
        });
    if (app['statusCode'] == 404) {
        if (allow_alternate) {
            // TODO: check alternates
        }
        return Promise.reject(new Error("Tapis application is not available."));
    } else {
        config.log.info(context, 'vdjserver:app (' + this.activity[activity_id]['vdjserver:app:name'] + ',' + this.activity[activity_id]['vdjserver:app:version'] + ') exists.');

        //console.log(JSON.stringify(app, null, 2));
        console.log(app);

        // TODO: size job for input size
        // TODO: notifications

        let job_data = {
            "name": "vdjserver tapis job",
            "appId": this.activity[activity_id]['vdjserver:app:name'],
            "appVersion": this.activity[activity_id]['vdjserver:app:version'],
            "maxMinutes": 240,
            "nodeCount": 1,
            "archiveSystemId": "data-storage.vdjserver.org",
            "archiveSystemDir": "/projects/" + project_uuid + "/analyses/${JobUUID}",
            "archiveOnAppError": false,
            "fileInputs": [],
            "fileInputArrays": [],
            "parameterSet": {
                "schedulerOptions": [
                    { "name":"allocation", "arg":"-A MCB23006" }
                ],
                "containerArgs": [],
                "appArgs": [],
                "envVariables": []
            }
        };

        // apply time multiplier
        if (this.activity[activity_id]['vdjserver:job:timeMultiplier']) {
            job_data['maxMinutes'] = job_data['maxMinutes'] * this.activity[activity_id]['vdjserver:job:timeMultiplier'];
            if (job_data['maxMinutes'] >= config.job_max_minutes) job_data['maxMinutes'] = config.job_max_minutes;
        }

        // set fileInputs from entities
        let app_inputs = app['jobAttributes']['fileInputs'];
        for (let i in app_inputs) {
            // skip if fixed
            if (app_inputs[i]['inputMode'] == 'FIXED') continue;

            let found = false;
            for (let u in this.uses) {
                if (this.uses[u]['prov:activity'] == activity_id)
                    if (this.entity[this.uses[u]['prov:entity']]['vdjserver:type'] == 'app:inputs')
                        if (this.entity[this.uses[u]['prov:entity']][app_inputs[i]['name']]) {
                            let input_value = this.entity[this.uses[u]['prov:entity']][app_inputs[i]['name']];
                            found = true;
                            config.log.info(context, 'fileInputs (' + app_inputs[i]['name'] + ') found, it is ' + app_inputs[i]['inputMode']);
                            // is it a project_file?
                            if (this.uses[u]['prov:entity'].startsWith('vdjserver:project_file')) {
                                job_data["fileInputs"].push({ name: app_inputs[i]['name'], sourceUrl: "tapis://" + tapisSettings.storageSystem + '/projects/' + project_uuid + '/files/' + input_value, targetPath: input_value});
                            } else if (this.uses[u]['prov:entity'].startsWith('vdjserver:project_job_file')) {
                                // or a project_job_file?
                                job_data["fileInputs"].push({ name: app_inputs[i]['name'], sourceUrl: "tapis://" + tapisSettings.storageSystem + '/projects/' + project_uuid + '/analyses/' + input_value, targetPath: input_value});
                            }
                            break;
                        }
            }
            if (!found) {
                if (app_inputs[i]['inputMode'] == 'REQUIRED') return Promise.reject(new Error('Required inputMode is missing: ' + app_inputs[i]['name']));
                config.log.info(context, 'fileInputs (' + app_inputs[i]['name'] + ') not found, it is ' + app_inputs[i]['inputMode']);
            }
        }

        // set fileInputArrays from entities
        app_inputs = app['jobAttributes']['fileInputArrays'];
        for (let i in app_inputs) {
            // skip if fixed
            if (app_inputs[i]['inputMode'] == 'FIXED') continue;

            let found = false;
            let inputArrayData = { "name": app_inputs[i]['name'], "sourceUrls": [] };
            let inputArrayEnv = [];
            for (let u in this.uses) {
                if (this.uses[u]['prov:activity'] == activity_id)
                    if (this.entity[this.uses[u]['prov:entity']]['vdjserver:type'] == 'app:inputs')
                        if (this.entity[this.uses[u]['prov:entity']][app_inputs[i]['name']]) {
                            let input_value = this.entity[this.uses[u]['prov:entity']][app_inputs[i]['name']];
                            found = true;
                            //console.log(this.entity[this.uses[u]['prov:entity']]);
                            config.log.info(context, 'fileInputArrays (' + app_inputs[i]['name'] + ') found, it is ' + app_inputs[i]['inputMode']);
                            // is it a project_file?
                            if (this.uses[u]['prov:entity'].startsWith('vdjserver:project_file')) {
                                inputArrayData["sourceUrls"].push("tapis://" + tapisSettings.storageSystem + '/projects/' + project_uuid + '/files/' + input_value);
                                inputArrayEnv.push(input_value);
                            } else if (this.uses[u]['prov:entity'].startsWith('vdjserver:project_job_file')) {
                                // or a project_job_file?
                                inputArrayData["sourceUrls"].push("tapis://" + tapisSettings.storageSystem + '/projects/' + project_uuid + '/analyses/' + input_value);
                                inputArrayEnv.push(input_value);
                            }
                        }
            }
            if (!found) {
                if (app_inputs[i]['inputMode'] == 'REQUIRED') return Promise.reject(new Error('Required inputMode is missing: ' + app_inputs[i]['name']));
                config.log.info(context, 'fileInputArrays (' + app_inputs[i]['name'] + ') not found, it is ' + app_inputs[i]['inputMode']);
            } else {
                //
                job_data['fileInputArrays'].push(inputArrayData);
                job_data['parameterSet']['envVariables'].push({ key: inputArrayData["name"], value: inputArrayEnv.join(" ")});
            }
        }

        // set envVariables from app:parameters entity
        let app_params = app['jobAttributes']['parameterSet']['envVariables'];
        for (let i in app_params) {
            // skip if fixed
            if (app_params[i]['inputMode'] == 'FIXED') continue;
            let param_key = app_params[i]['key'];
            config.log.info(context, 'set environment variable: ' + param_key);

            let param_entity = null;
            for (let u in this.uses) {
                if (this.uses[u]['prov:activity'] == activity_id) {
                    if (this.entity[this.uses[u]['prov:entity']]['vdjserver:type'] == 'app:parameters') {
                        param_entity = this.entity[this.uses[u]['prov:entity']];
                        break;
                    }
                }
            }
            if (param_entity) {
                if (param_entity[param_key] != null) {
                    // must cast value to string
                    let v = param_entity[param_key];
                    if (v === true) v = "1";
                    else if (v === false) v = "0";
                    else v = String(v);
                    job_data['parameterSet']['envVariables'].push({ key: param_key, value: v });
                }
            }
        }

        return Promise.resolve(job_data);
    }
}

// find set of activities which can be performed based on inputs
AnalysisDocument.prototype.perform_activities = function(is_executing) {
    var context = 'AnalysisDocument.perform_activities';
    var activities = {};
    var activity_uses = {};
    var inputs = this.get_available_entities();

    // get set of activities where all inputs are available
    for (let a in this.activity) {
        if (this.activity[a]['prov:startTime']) continue;
        let found_all = true;
        for (let u in this.uses) {
            if (this.uses[u]['prov:activity'] == a) {
                if (inputs[this.uses[u]['prov:entity']]) {
                    if (! activity_uses[a]) activity_uses[a] = [];
                    activity_uses[a].push(u);
                } else {
                    found_all = false;
                    if (activity_uses[a]) delete activity_uses[a];
                    break;
                }
            }
        }
        if (found_all) activities[a] = this.activity[a];
    }
    config.log.info(context, 'performing activities: ' + JSON.stringify(activities, null, 2));
    //config.log.info(context, 'activity uses: ' + JSON.stringify(activity_uses, null, 2));

    // no activities to perform
    if (Object.keys(activities).length == 0) return null;

    if (!this.used) this.used = {};
    if (!this.wasGeneratedBy) this.wasGeneratedBy = {};

    if (is_executing) {
        // execute activities
    } else {
        // simulate execution
        for (let a in activities) {
            this.activity[a]['prov:startTime'] = new Date().toISOString();
            for (let u in activity_uses[a])
                this.used[activity_uses[a][u]] = this.uses[activity_uses[a][u]];
            for (let g in this.isGeneratedBy) {
                if (this.isGeneratedBy[g]['prov:activity'] == a)
                    this.wasGeneratedBy[g] = this.isGeneratedBy[g];
            }
            this.activity[a]['prov:endTime'] = new Date().toISOString();
        }
    }

    return activities;
}

AnalysisDocument.prototype.validate = async function(project_uuid, allow_alternate) {
    var context = 'AnalysisDocument.validate';
    var valid = true;
    var errors = [];

    // TODO: need to return reasons/messages for anything invalid

    // check that all the uses relationships can be resolved
    for (let u in this.uses) {
        if (! this.uses[u]['prov:activity']) {
            errors.push({ message: "activity in uses relation not found:" + this.uses[u] });
            valid = false;
        } else if (! this.activity[this.uses[u]['prov:activity']]) {
            errors.push({ message: "activity in uses relation not found:" + this.uses[u]['prov:activity'] });
            valid = false;
        }

        if (! this.uses[u]['prov:entity']) {
            errors.push({ message: "entity in uses relation not found:" + this.uses[u] });
            valid = false;
        } else if (! this.entity[this.uses[u]['prov:entity']]) {
            errors.push({ message: "entity in uses relation not found:" + this.uses[u]['prov:entity'] });
            valid = false;
        }
    }

    // check that all the isGeneratedBy relationships can be resolved
    for (let u in this.isGeneratedBy) {
        if (! this.isGeneratedBy[u]['prov:activity']) {
            errors.push({ message: "activity in isGeneratedBy relation not found:" + this.isGeneratedBy[u] });
            valid = false;
        } else if (! this.activity[this.isGeneratedBy[u]['prov:activity']]) {
            errors.push({ message: "activity in isGeneratedBy relation not found:" + this.isGeneratedBy[u]['prov:activity'] });
            valid = false;
        }

        if (! this.isGeneratedBy[u]['prov:entity']) {
            errors.push({ message: "entity in isGeneratedBy relation not found:" + this.isGeneratedBy[u] });
            valid = false;
        } else if (! this.entity[this.isGeneratedBy[u]['prov:entity']]) {
            errors.push({ message: "entity in isGeneratedBy relation not found:" + this.isGeneratedBy[u]['prov:entity'] });
            valid = false;
        }
    }

    if (!valid) return Promise.resolve(errors);

    // validate that activities are tapis app ids
    for (let a in this.activity) {
        if (this.activity[a]['vdjserver:app:name'] && this.activity[a]['vdjserver:app:version']) {
            let app = await tapisIO.getApplication(this.activity[a]['vdjserver:app:name'], this.activity[a]['vdjserver:app:version'])
                .catch(function(error) {
                    return Promise.reject(error);
                });
            if (app['statusCode'] == 404) {
                if (allow_alternate) {
                    // TODO: check alternates
                }
                errors.push({ message: "Tapis app for activity not found: " + a });
                valid = false;
            } else
                config.log.info(context, 'vdjserver:app (' + this.activity[a]['vdjserver:app:name'] + ',' + this.activity[a]['vdjserver:app:version'] + ') exists.');

                // check that inputs can be resolved to entity attributes
                let app_inputs = app['jobAttributes']['fileInputs'];
                for (let i in app_inputs) {
                    // skip if fixed
                    if (app_inputs[i]['inputMode'] == 'FIXED') continue;

                    let found = false;
                    for (let u in this.uses) {
                        if (this.uses[u]['prov:activity'] == a)
                            if (this.entity[this.uses[u]['prov:entity']]['vdjserver:type'] == 'app:inputs')
                                if (this.entity[this.uses[u]['prov:entity']][app_inputs[i]['name']]) {
                                    found = true;
                                    config.log.info(context, 'app input (' + app_inputs[i]['name'] + ') found, it is ' + app_inputs[i]['inputMode']);
                                    break;
                                }
                    }
                    if (!found) {
                        if (app_inputs[i]['inputMode'] == 'REQUIRED') {
                            errors.push({ message: "Required input:" + i + " not found for activity: " + a });
                            valid = false;
                        }
                        config.log.info(context, 'app input (' + app_inputs[i]['name'] + ') not found, it is ' + app_inputs[i]['inputMode']);
                    }
                }

                // check that parameters can be resolved to entity attributes
                let app_params = app['jobAttributes']['parameterSet']['envVariables'];
                for (let i in app_params) {
                    // ok if fixed
                    if (app_params[i]['inputMode'] == 'FIXED') continue;

                    let found = false;
                    for (let u in this.uses) {
                        if (this.uses[u]['prov:activity'] == a)
                            if (this.entity[this.uses[u]['prov:entity']]['vdjserver:type'] == 'app:parameters')
                                if (this.entity[this.uses[u]['prov:entity']][app_params[i]['key']] != undefined) {
                                    found = true;
                                    config.log.info(context, 'app parameter (' + app_params[i]['key'] + ') found, it is ' + app_params[i]['inputMode']);
                                    break;
                                }
                    }
                    if (!found) {
                        if (app_params[i]['inputMode'] == 'REQUIRED') {
                            errors.push({ message: "Required parameter:" + app_params[i]['key'] + " not found for activity: " + a });
                            valid = false;
                        }
                        config.log.info(context, 'app parameter (' + app_params[i]['key'] + ') not found, it is ' + app_params[i]['inputMode']);
                    }
                }
        }
    }

    if (!valid) return Promise.resolve(errors);

    // determine input files, validate their existence
    var inputs = this.get_input_entities();
    console.log(inputs);
    for (let i in inputs) {
        if (inputs[i]['vdjserver:uuid']) {
            if (project_uuid == inputs[i]['vdjserver:uuid']) continue;
            let data = await tapisIO.getMetadataForProject(project_uuid, inputs[i]['vdjserver:uuid'])
                .catch(function(error) {
                    return Promise.reject(error);
                });
            if (data.length == 0) {
                errors.push({ message: "Input:" + i + " not found for vdjserver uuid: " + inputs[i]['vdjserver:uuid'] });
                valid = false;
            } else {
                config.log.info(context, JSON.stringify(data));
                config.log.info(context, 'vdjserver:uuid (' + inputs[i]['vdjserver:uuid'] + ') exists.');
            }
        }
    }

    // simulate execution
    while(this.perform_activities(false)) {
        config.log.info(context, 'document after performing activities: ' + JSON.stringify(this, null, 2));
    }

    // check that all activities were performed
    // check that entities were used
    // check that entities were generated

    return Promise.resolve(errors);
};
