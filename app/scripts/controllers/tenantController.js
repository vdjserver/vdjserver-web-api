'use strict';

//
// tenantController.js
// A specialized end point to provide a valid tenants response.
// Acts as a proxy for the Agave/Tapis V2 API service at:
// https://api.tacc.utexas.edu/tenants
// Which is useful for internal tools like agave-cli to be redirected
// to VDJServer proxy for vdj-agave-api.tacc.utexas.edu
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

// We hard code the response
// baseUrl changed to point to vdjserver.org proxy versus vdj-agave-api.tacc.utexas.edu
const tenants_list = [{
    "id": "42",
    "name": "VDJServer",
    "baseUrl": "http://TaxRefundTwo.local:8080/api/v2/",
//    "baseUrl": "http://vdjserver.org/",
    "code": "vdjserver.org",
    "contact": [
      {
        "name": "Scott Christley",
        "email": "scott.christley@utsouthwestern.edu",
        "url": "",
        "type": "admin",
        "primary": true
      },
      {
        "name": "Lindsay G. Cowell",
        "email": "lindsay.cowell@utsouthwestern.edu",
        "url": "",
        "type": "admin",
        "primary": true
      }
    ]
}];

var TenantController = {};
module.exports = TenantController;

// Controllers
var ApiResponseController = require('./apiResponseController');

TenantController.getTenants = function(request, response) {
    ApiResponseController.sendSuccess(tenants_list, response);
};

