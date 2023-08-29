
'use strict';

//
// adminController.js
// Handle administration endpoints
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020-2022 The University of Texas Southwestern Medical Center
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

var AdminController = {};
module.exports = AdminController;

// config
var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var ServiceAccount = tapisIO.serviceAccount;

// Processing
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

AdminController.queryProjectLoad = async function(request, response) {
    var context = 'AdminController.queryProjectLoad';
    config.log.info(context, 'parameters: ' + JSON.stringify(request.query));

    var projectUuid = request.query.project_uuid;
    var collection = request.query.collection;
    var shouldLoad = request.query.should_load;
    var isLoaded = request.query.is_loaded;
    var repertoireMetadataLoaded = request.query.repertoire_loaded;
    var rearrangementDataLoaded = request.query.rearrangement_loaded;
    var msg = null;

    // query the records
    var project_loads = await tapisIO.queryProjectLoadMetadata(projectUuid, collection, shouldLoad, isLoaded, repertoireMetadataLoaded, rearrangementDataLoaded)
        .catch(function(error) {
            msg = config.log.error(context, 'error ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(project_loads, response);
}

