
'use strict';

//
// app.js
// Application entry
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

// Express Modules
var express      = require('express');
var morgan       = require('morgan');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var openapi      = require('express-openapi');
var passport     = require('passport');
var _            = require('underscore');
var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');
var $RefParser = require("@apidevtools/json-schema-ref-parser");
var airr = require('./vendor/airr');

// Express app
var app = module.exports = express();

var webhookIO = require('./vendor/webhookIO');
var mongoSettings = require('./config/mongoSettings');

// Controllers
var apiResponseController = require('./controllers/apiResponseController');
var tokenController       = require('./controllers/tokenController');
var authController       = require('./controllers/authController');
var projectController = require('./controllers/projectController');
var feedbackController = require('./controllers/feedbackController');
var userController = require('./controllers/userController');
var telemetryController = require('./controllers/telemetryController');
var permissionsController = require('./controllers/permissionsController');
var adcController = require('./controllers/adcController');

// Server Options
var config = require('./config/config');
app.set('port', config.port);
app.set('sslOptions', config.sslOptions);

// CORS
var allowCrossDomain = function(request, response, next) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    // intercept OPTIONS method
    if ('OPTIONS' === request.method) {
        response.status(200).end();
    }
    else {
        next();
    }
};

// Server Settings
// Puts an Apache-style log line into stdout
app.use(morgan('combined'));
// Allow cross-origin resource sharing
app.use(allowCrossDomain);
// redis config
app.redisConfig = {
    port: 6379,
    host: 'localhost',
};

// load API spec
var api_spec = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, '../../swagger/vdjserver-api.yaml'), 'utf8'));
// load AIRR Standards spec
var airr_spec = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, '../airr-standards/specs/airr-schema.yaml'), 'utf8'));
// fix up swagger v2 spec for openapi v3
for (var obj in airr_spec) {
    // discriminator is an object vs string
    if (airr_spec[obj]['discriminator'])
        airr_spec[obj]['discriminator'] = { propertyName: airr_spec[obj]['discriminator'] };
    // add nullable flags
    for (var prop in airr_spec[obj]['properties']) {
        var p = airr_spec[obj]['properties'][prop];
        if ((p['x-airr']) && (p['x-airr']['nullable'])) {
            p['nullable'] = true;
        }
    }
}

console.log('VDJ-API INFO: Using query collection suffix: ' + mongoSettings.queryCollection);
console.log('VDJ-API INFO: Using load collection suffix: ' + mongoSettings.loadCollection);

// Downgrade to host vdj user
// This is also so that the /vdjZ Corral file volume can be accessed,
// as it is restricted to the TACC vdj account.
// Currently only read access is required.
if (config.hostServiceAccount) {
    console.log('VDJ-API INFO: Downgrading to host user: ' + config.hostServiceAccount);
    process.setgid(config.hostServiceGroup);
    process.setuid(config.hostServiceAccount);
    console.log('VDJ-API INFO: Current uid: ' + process.getuid());
    console.log('VDJ-API INFO: Current gid: ' + process.getgid());
} else {
    console.log('VDJ-API WARNING: config.hostServiceAccount is not defined, Corral access will generate errors.');
}

// Verify we can login with service account
var ServiceAccount = require('./models/serviceAccount');
ServiceAccount.getToken()
    .then(function(serviceToken) {
        console.log('VDJ-API INFO: Successfully acquired service token.');

        // wait for the AIRR spec to be dereferenced
        return airr.schemaPromise();
    })
    .then(function() {
        // dereference the AIRR spec
        return $RefParser.dereference(airr_spec);
    })
    .then(function(schema) {
        //console.log(JSON.stringify(schema['Study'],null,2));

        // Put the AIRR objects into the API
        api_spec['components']['schemas']['Study'] = schema['Study'];
        api_spec['components']['schemas']['Repertoire'] = schema['Repertoire'];
        //console.log(JSON.stringify(api_spec, null, 2));

        // dereference the API spec
        //
        // OPENAPI BUG: We should not have to do this, but openapi does not seem
        // to recognize the nullable flags or the types with $ref
        // https://github.com/kogosoftwarellc/open-api/issues/647
        return $RefParser.dereference(api_spec);
    })
    .then(function(api_schema) {
        //console.log(JSON.stringify(api_schema,null,2));

        // Initialize express-openapi middleware
        openapi.initialize({
            apiDoc: api_schema,
            app: app,
            promiseMode: true,
            consumesMiddleware: {
                'application/json': bodyParser.json(),
                'application/x-www-form-urlencoded': bodyParser.urlencoded({extended: true})
            },
            errorMiddleware: function(err, req, res, next) {
                console.log('Got an error!');
                console.log(JSON.stringify(err));
                //console.trace("Here I am!");
                res.status(err.status).json(err.errors);
            },
            securityHandlers: {
                user_authorization: authController.userAuthorization,
                admin_authorization: authController.adminAuthorization,
                project_authorization: authController.projectAuthorization
            },
            operations: {
                //getStatus: function(req, res) { res.send('{"result":"success"}'); }
                getStatus: apiResponseController.confirmUpStatus,

                // authentication
                createToken: tokenController.getToken,
                refreshToken: tokenController.refreshToken,

                // user
                createUser: userController.createUser,
                duplicateUsername: userController.duplicateUsername,
                verifyUser: userController.verifyUser,
                resendVerifyEmail: userController.resendVerificationEmail,
                changePassword: userController.changePassword,
                resetPassword: userController.createResetPasswordRequest,
                verifyResetPassword: userController.processResetPasswordRequest,

                // project
                createProject: projectController.createProject,
                importFile: projectController.importFile,
                exportMetadata: projectController.exportMetadata,
                importMetadata: projectController.importMetadata,
                publishProject: projectController.publishProject,
                unpublishProject: projectController.unpublishProject,
                loadProject: projectController.loadProject,
                unloadProject: projectController.unloadProject,
                reloadProject: projectController.reloadProject,
                archiveProject: projectController.archiveProject,
                unarchiveProject: projectController.unarchiveProject,
                purgeProject: projectController.purgeProject,

                // permissions
                addPermissionsForUsername: permissionsController.addPermissionsForUsername,
                removePermissionsForUsername: permissionsController.removePermissionsForUsername,
                syncMetadataPermissionsWithProject: permissionsController.syncMetadataPermissionsWithProject,

                // feedback
                createFeedback: feedbackController.createFeedback,
                createPublicFeedback: feedbackController.createPublicFeedback,

                // telemetry
                recordErrorTelemetry: telemetryController.recordErrorTelemetry,
                
                // ADC
                defaultADCRepositories: adcController.defaultADCRepositories,
                updateADCRepositories: adcController.updateADCRepositories,

                // ADC Download Cache
                getADCDownloadCacheStatus: adcController.getADCDownloadCacheStatus,
                updateADCDownloadCacheStatus: adcController.updateADCDownloadCacheStatus,
                getADCDownloadCacheForStudies: adcController.getADCDownloadCacheForStudies,
                updateADCDownloadCacheForStudy: adcController.updateADCDownloadCacheForStudy,
                deleteADCDownloadCacheForStudy: adcController.deleteADCDownloadCacheForStudy,
                updateADCDownloadCacheForRepertoire: adcController.updateADCDownloadCacheForRepertoire,
                deleteADCDownloadCacheForRepertoire: adcController.deleteADCDownloadCacheForRepertoire,
                notifyADCDownloadCache: adcController.notifyADCDownloadCache
            }
        });

        // Start listening on port
        return new Promise(function(resolve, reject) {
            app.listen(app.get('port'), function() {
                console.log('VDJ-API INFO: VDJServer API (' + config.info.version + ') service listening on port ' + app.get('port'));
                resolve();
            });
        });
    })
    .then(function() {
        // Initialize queues

        // ADC download cache queues
        if (config.enableADCDownloadCache) {
            console.log('VDJ-API INFO: ADC download cache is enabled, triggering cache.');
            adcDownloadQueueManager.triggerDownloadCache();
        } else {
            console.log('VDJ-API INFO: ADC download cache is disabled.');

            // TODO: remove any existing jobs from the queue
        }

        // TODO: decide how to restart
        // ADC load of rearrangements
        projectQueueManager.checkRearrangementLoad();
        //projectQueueManager.triggerRearrangementLoad();

    })
    .catch(function(error) {
        var msg = 'VDJ-API ERROR: Error occurred while initializing API service.\nSystem may need to be restarted.\n' + error;
        console.error(msg);
        webhookIO.postToSlack(msg);
        // let it continue in case its a temporary error
        //process.exit(1);
    });

// WebsocketIO
require('./utilities/websocketManager');

var accountQueueManager = require('./queues/accountQueueManager');
accountQueueManager.processNewAccounts();

var jobQueueManager = require('./queues/jobQueueManager');
jobQueueManager.processJobs();

var projectQueueManager = require('./queues/projectQueueManager');
projectQueueManager.processProjects();

var adcDownloadQueueManager = require('./queues/adcDownloadQueueManager');
