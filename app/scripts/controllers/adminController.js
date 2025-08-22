
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
var tapisSettings = require('vdj-tapis-js/tapisSettings');
var tapisIO = tapisSettings.get_default_tapis();
var ServiceAccount = tapisIO.serviceAccount;
var webhookIO = require('vdj-tapis-js/webhookIO');
var emailIO = require('vdj-tapis-js/emailIO');

AdminController.getAllPublicProjects = async function(request, response) {
    var context = 'AdminController.getAllPublicProjects';
    config.log.info(context, 'parameters: ' + JSON.stringify(request.query));

    var msg = null;

    // query the records
    var project_loads = await tapisIO.getAllPublicProjectMetadata()
        .catch(function(error) {
            msg = config.log.error(context, 'error ' + error);
        });
    if (msg) {
        webhookIO.postToSlack(msg);
        return apiResponseController.sendError(msg, 500, response);
    }

    return apiResponseController.sendSuccess(project_loads, response);
}

