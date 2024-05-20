
'use strict';

//
// guest.js
// guest proxy
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

var http = require('http');
var https = require('https');

var config = require('./config/config');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;
var GuestAccount = tapisIO.guestAccount;

var webhookIO = require('./vendor/webhookIO');

// node libraries
var requestLib = require('request');

// Verify we can login with guest account
GuestAccount.getToken()
    .then(function(guestToken) {
        console.log('VDJ-GUEST INFO: Successfully acquired guest token.');
    })
    .catch(function(error) {
        console.error('VDJ-GUEST ERROR: Service may need to be restarted.');
        webhookIO.postToSlack('VDJ-GUEST ERROR: Unable to login with guest account.\nSystem may need to be restarted.\n' + error);
        //process.exit(1);
    });

http.createServer(function(request, response) {
    //console.log(request);

    if (request.method != 'GET') {
        console.error('VDJ-GUEST ERROR: Unauthorized request, method: ' + request.method + ' url: ' + request.url + ' headers: ' + request.headers);
        response.writeHead(401, {});
        response.end();
    } else {
        GuestAccount.getToken()
            .then(function(guestToken) {
                // splice out the leading guest path
                var newUrl = request.url;
                var pathList = newUrl.split("/");
                if (pathList.length > 1) pathList.splice(1,1);
                newUrl = pathList.join('/');

                var requestSettings = {
                    url: 'https://' + tapisSettings.hostname + newUrl,
                    method:   'GET',
                    rejectUnauthorized: false,
                    headers: {
                        'Authorization': 'Bearer ' + GuestAccount.accessToken(),
                    }
                };
                //console.log(request);
                //console.log(requestSettings);

                requestLib(requestSettings).pipe(response);
            })
            .catch(function(error) {
                console.error('VDJ-GUEST ERROR: Unable to acquire guest account token.\n' + error);
                webhookIO.postToSlack('VDJ-GUEST ERROR: Unable to login with guest account.\n' + error);
                response.end();
            });
    }
}).listen(8082);

