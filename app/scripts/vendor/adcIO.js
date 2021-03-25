
'use strict';

//
// adcIO.js
// Functions for the AIRR Data Commons
//
// VDJServer Analysis Portal
// VDJ API Service
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

var adcIO  = {};
module.exports = adcIO;

// Server environment config
var config = require('../config/config');

// Processing
var webhookIO = require('../vendor/webhookIO');
var agaveIO = require('../vendor/agaveIO');

// Node Libraries
var _ = require('underscore');
var csv = require('csv-parser');
var fs = require('fs');
const zlib = require('zlib');

var airr = require('../vendor/airr');

// Get the set of default ADC repositories
adcIO.defaultADCRepositories = function() {
}

// Query the repertoires from an ADC repository with optional study_id
adcIO.getRepertoires = function(repository, study_id) {
}

// Query the studies from an ADC repository
adcIO.getStudies = function(repository) {
}

//
// Functions for the ADC download cache
//

adcIO.getCachedStudy = function(study_id) {
}

adcIO.getCachedRepertoiresForStudy = function(study_id) {
}

// 1. iterate
adcIO.createCacheEntries = function() {

}
