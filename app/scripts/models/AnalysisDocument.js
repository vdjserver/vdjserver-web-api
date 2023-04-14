
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

var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

AnalysisDocument.prototype.get_inputs = function(is_executing) {
    var inputs = {};

    for (let e in this.entity) {
        // inputs are entities that are not isGeneratedBy an activity
        let is_input = true;
        for (let g in this.isGeneratedBy) {
            if (this.isGeneratedBy[g]['prov:entity'] == e) {
                is_input = false;
                break;
            }
        }

        // or alternatively, if we are executing the workflow
        // then an input is an entity that wasGeneratedBy an activity which has finished
        if (is_executing) {
            for (let w in this.wasGeneratedBy) {
                if ((this.wasGeneratedBy[w]['prov:entity'] == e)
                    && (this.activity[this.wasGeneratedBy[w]['prov:activity']]['prov:endTime'])) {
                        is_input = true;
                        break;
                    }
            }
        }

        if (is_input) inputs[e] = this.entity[e];
    }

    return inputs;
}

AnalysisDocument.prototype.validate = async function(project_uuid, allow_alternate) {
    var valid = true;

    // validate that activities are tapis app ids
    for (let a in this.activity) {
        if (this.activity[a]['vdjserver:app']) {
            let app = await tapisIO.getApplication(this.activity[a]['vdjserver:app'])
                .catch(function(error) {
                    return Promise.reject(error);
                });
            if (app['statusCode'] == 404) {
                if (allow_alternate) {
                    // TODO: check alternates
                }
                valid = false;
            }
        }
    }

    // check that all the uses relationships can be resolved
    for (let u in this.uses) {
        if (! this.uses[u]['prov:activity']) valid = false;
        else if (! this.activity[this.uses[u]['prov:activity']]) valid = false;

        if (! this.uses[u]['prov:entity']) valid = false;
        else if (! this.entity[this.uses[u]['prov:entity']]) valid = false;
    }

    // check that all the isGeneratedBy relationships can be resolved
    for (let u in this.isGeneratedBy) {
        if (! this.isGeneratedBy[u]['prov:activity']) valid = false;
        else if (! this.activity[this.isGeneratedBy[u]['prov:activity']]) valid = false;

        if (! this.isGeneratedBy[u]['prov:entity']) valid = false;
        else if (! this.entity[this.isGeneratedBy[u]['prov:entity']]) valid = false;
    }

    if (!valid) return Promise.resolve(valid);

    // determine input files, validate their existence
    var inputs = this.get_inputs(true);
    for (let i in inputs) {
        if (inputs[i]['vdjserver:uuid']) {
            let data = await tapisIO.getMetadata(inputs[i]['vdjserver:uuid'])
                .catch(function(error) {
                    return Promise.reject(error);
                });
            if (data['statusCode'] == 404) valid = false;
        }
    }

    return Promise.resolve(valid);
};

