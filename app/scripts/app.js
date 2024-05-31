
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
//var morgan       = require('morgan');
var errorHandler = require('errorhandler');
var bodyParser   = require('body-parser');
var openapi      = require('express-openapi');
var passport     = require('passport');
var _            = require('underscore');
var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');
var $RefParser = require("@apidevtools/json-schema-ref-parser");
var airr = require('airr-js');
var vdj_schema = require('vdjserver-schema');


// Express app
var app = module.exports = express();
var context = 'app';

var webhookIO = require('./vendor/webhookIO');
var mongoSettings = require('./config/mongoSettings');

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
//app.use(morgan('combined'));
// Allow cross-origin resource sharing
app.use(allowCrossDomain);
// redis config
app.redisConfig = {
    port: 6379,
    host: 'vdj-redis'
};

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
var adminController = require('./controllers/adminController');
var tenantController = require('./controllers/tenantController');

// load API spec
var api_spec = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, '../../swagger/vdjserver-api.yaml'), 'utf8'));
// load AIRR Standards spec, openapi v3
//var airr_spec = yaml.safeLoad(fs.readFileSync(path.resolve(__dirname, '../airr-standards/specs/airr-schema-openapi3.yaml'), 'utf8'));
// fix up swagger v2 spec for openapi v3
/* for (var obj in airr_spec) {
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
} */

config.log.info(context, 'Using query collection suffix: ' + mongoSettings.queryCollection);
config.log.info(context, 'Using load collection suffix: ' + mongoSettings.loadCollection);

// Downgrade to host vdj user
// This is also so that the /vdjZ Corral file volume can be accessed,
// as it is restricted to the TACC vdj account.
// Currently only read access is required.
if (config.hostServiceAccount) {
    config.log.info(context, 'Downgrading to host user: ' + config.hostServiceAccount);
    process.setgid(config.hostServiceGroup);
    process.setuid(config.hostServiceAccount);
    config.log.info(context, 'Current uid: ' + process.getuid());
    config.log.info(context, 'Current gid: ' + process.getgid());
} else {
    config.log.info('WARNING', 'config.hostServiceAccount is not defined, Corral access will generate errors.');
}

// Tapis
if (config.tapis_version == 2) config.log.info(context, 'Using Tapis V2 API', true);
else if (config.tapis_version == 3) config.log.info(context, 'Using Tapis V3 API', true);
else {
    config.log.error(context, 'Invalid Tapis version, check TAPIS_VERSION environment variable');
    process.exit(1);
}
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

// Verify we can login with service account
var ServiceAccount = tapisIO.serviceAccount;
ServiceAccount.getToken()
    .then(function(serviceToken) {
        config.log.info(context, 'Successfully acquired service token.');

        // wait for the AIRR spec to be dereferenced
        return airr.load_schema();
    })
    .then(function() {
        config.log.info(context, 'Loaded AIRR Schema version ' + airr.get_info()['version']);

        // wait for the VDJServer spec to be dereferenced
        return vdj_schema.load_schema();
    })
    .then(function(schema) {
        config.log.info(context, 'Loaded VDJServer Schema version ' + vdj_schema.get_info()['version']);
        //console.log(vdj_schema.Schema['specification']);
        //let test = new vdj_schema.SchemaDefinition('PROVRequest');
        //console.log(test);
        //console.log(test.tapis_name());
        //console.log(test.template());
        //console.log(vdj_schema.get_schemas());

        //let test = new vdj_schema.SchemaDefinition('AnalysisRequest');
        //console.log(JSON.stringify(test));
        //console.log(test.tapis_name());
        //console.log(test.template());

        // dereference the AIRR spec
//        return $RefParser.dereference(airr_spec);
//    })
//    .then(function(schema) {
        //console.log(JSON.stringify(schema['Study'],null,2));

        // Drop in the VDJServer schema
        api_spec['components']['schemas'] = vdj_schema.get_schemas();

        // Connect schema to vdj-tapis
        if (tapisIO == tapisV3) tapisV3.init_with_schema(vdj_schema);

        // Put the AIRR objects into the API
        //api_spec['components']['schemas']['Study'] = schema['Study'];
        //api_spec['components']['schemas']['Repertoire'] = schema['Repertoire'];
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

        // wrap the operations functions to catch syntax errors and such
        // we do not get a good stack trace with the middleware error handler
        var try_function = async function (request, response, the_function) {
            try {
                await the_function(request, response);
            } catch (e) {
                console.error(e);
                console.error(e.stack);
                throw e;
            }
        };

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
                console.error(err.stack);
                //console.trace("Here I am!");
                if (err.status) res.status(err.status).json(err.errors);
                else apiResponseController.sendError('Unknown server error.', 500, res);
            },
            securityHandlers: {
                user_authorization: authController.userAuthorization,
                admin_authorization: authController.adminAuthorization,
                project_authorization: authController.projectAuthorization
            },
            operations: {
                //getStatus: function(req, res) { res.send('{"result":"success"}'); }
                getStatus: async function(req, res) { return try_function(req, res, apiResponseController.confirmUpStatus); },
                getTenants: async function(req, res) { return try_function(req, res, tenantController.getTenants); },

                // authentication
                createToken: async function(req, res) { return try_function(req, res, tokenController.getToken); },
                refreshToken: async function(req, res) { return try_function(req, res, tokenController.refreshToken); },

                // user
                createUser: async function(req, res) { return try_function(req, res, userController.createUser); },
                getUserProfile: async function(req, res) { return try_function(req, res, userController.getUserProfile); },
                duplicateUsername: async function(req, res) { return try_function(req, res, userController.duplicateUsername); },
                verifyUser: async function(req, res) { return try_function(req, res, userController.verifyUser); },
                resendVerifyEmail: async function(req, res) { return try_function(req, res, userController.resendVerificationEmail); },
                changePassword: async function(req, res) { return try_function(req, res, userController.changePassword); },
                resetPassword: async function(req, res) { return try_function(req, res, userController.createResetPasswordRequest); },
                verifyResetPassword: async function(req, res) { return try_function(req, res, userController.processResetPasswordRequest); },
                userHasAdminRole: async function(req, res) { return try_function(req, res, userController.userHasAdminRole); },

                // project
                createProject: async function(req, res) { return try_function(req, res, projectController.createProject); },
                getProjectMetadata: async function(req, res) { return try_function(req, res, projectController.getProjectMetadata); },
                getMetadata: async function(req, res) { return try_function(req, res, projectController.getMetadata); },
                createMetadata: async function(req, res) { return try_function(req, res, projectController.createMetadata); },
                updateMetadata: async function(req, res) { return try_function(req, res, projectController.updateMetadata); },
                queryMetadata: async function(req, res) { return try_function(req, res, projectController.queryMetadata); },
                deleteMetadata: async function(req, res) { return try_function(req, res, projectController.deleteMetadata); },
                exportMetadata: async function(req, res) { return try_function(req, res, projectController.exportMetadata); },
                importMetadata: async function(req, res) { return try_function(req, res, projectController.importMetadata); },
                exportTable: async function(req, res) { return try_function(req, res, projectController.exportTable); },
                importTable: async function(req, res) { return try_function(req, res, projectController.importTable); },
                importFile: async function(req, res) { return try_function(req, res, projectController.importFile); },
                postitFile: async function(req, res) { return try_function(req, res, projectController.postitFile); },
                getProjectFileMetadata: async function(req, res) { return try_function(req, res, projectController.getProjectFileMetadata); },
                deleteProjectFileMetadata: async function(req, res) { return try_function(req, res, projectController.deleteProjectFileMetadata); },
                executeWorkflow: async function(req, res) { return try_function(req, res, projectController.executeWorkflow); },
                generateVisualization: async function(req, res) { return try_function(req, res, projectController.generateVisualization); },
                publishProject: async function(req, res) { return try_function(req, res, projectController.publishProject); },
                unpublishProject: async function(req, res) { return try_function(req, res, projectController.unpublishProject); },
                loadProject: async function(req, res) { return try_function(req, res, projectController.loadProject); },
                unloadProject: async function(req, res) { return try_function(req, res, projectController.unloadProject); },
                reloadProject: async function(req, res) { return try_function(req, res, projectController.reloadProject); },
                archiveProject: async function(req, res) { return try_function(req, res, projectController.archiveProject); },
                unarchiveProject: async function(req, res) { return try_function(req, res, projectController.unarchiveProject); },
                purgeProject: async function(req, res) { return try_function(req, res, projectController.purgeProject); },

                // permissions
                addPermissionsForUsername: async function(req, res) { return try_function(req, res, permissionsController.addPermissionsForUsername); },
                removePermissionsForUsername: async function(req, res) { return try_function(req, res, permissionsController.removePermissionsForUsername); },
                //syncMetadataPermissionsWithProject: async function(req, res) { return try_function(req, res, permissionsController.syncMetadataPermissionsWithProject); },

                // feedback
                createFeedback: async function(req, res) { return try_function(req, res, feedbackController.createFeedback); },
                createPublicFeedback: async function(req, res) { return try_function(req, res, feedbackController.createPublicFeedback); },

                // telemetry
                recordErrorTelemetry: async function(req, res) { return try_function(req, res, telemetryController.recordErrorTelemetry); },
                
                // ADC
                statusADCRepository: async function(req, res) { return try_function(req, res, adcController.statusADCRepository); },
                defaultADCRepositories: async function(req, res) { return try_function(req, res, adcController.defaultADCRepositories); },
                updateADCRepositories: async function(req, res) { return try_function(req, res, adcController.updateADCRepositories); },

                // ADC Download Cache
                getADCDownloadCacheStatus: async function(req, res) { return try_function(req, res, adcController.getADCDownloadCacheStatus); },
                updateADCDownloadCacheStatus: async function(req, res) { return try_function(req, res, adcController.updateADCDownloadCacheStatus); },
                getADCDownloadCacheForStudies: async function(req, res) { return try_function(req, res, adcController.getADCDownloadCacheForStudies); },
                updateADCDownloadCacheForStudy: async function(req, res) { return try_function(req, res, adcController.updateADCDownloadCacheForStudy); },
                deleteADCDownloadCacheForStudy: async function(req, res) { return try_function(req, res, adcController.deleteADCDownloadCacheForStudy); },
                updateADCDownloadCacheForRepertoire: async function(req, res) { return try_function(req, res, adcController.updateADCDownloadCacheForRepertoire); },
                deleteADCDownloadCacheForRepertoire: async function(req, res) { return try_function(req, res, adcController.deleteADCDownloadCacheForRepertoire); },
                notifyADCDownloadCache: async function(req, res) { return try_function(req, res, adcController.notifyADCDownloadCache); },

                // administration
                queryProjectLoad: async function(req, res) { return try_function(req, res, adminController.queryProjectLoad); }
            }
        });

        // Start listening on port
        return new Promise(function(resolve, reject) {
            app.listen(app.get('port'), function() {
                config.log.info(context, 'VDJServer API (' + config.info.version + ') service listening on port ' + app.get('port'));
                resolve();
            });
        });
    })
    .then(function() {
        // Initialize queues

        // Manage Tapis jobs
        if (config.enable_job_queues) {
            config.log.info(context, 'Tapis job queues are enabled, triggering.');
            jobQueueManager.triggerQueue();
        } else {
            config.log.info(context, 'Tapis job queues are disabled, clearing queues.');
            jobQueueManager.clearQueues();
        }

        // ADC download cache queues
        if (config.enableADCDownloadCache) {
            config.log.info(context, 'ADC download cache is enabled, triggering cache.');
            adcDownloadQueueManager.triggerDownloadCache();
        } else {
            config.log.info(context, 'ADC download cache is disabled.');

            // TODO: remove any existing jobs from the queue
        }

        // ADC load of rearrangements
        if (config.enableADCLoad) {
            config.log.info(context, 'ADC loading is enabled, triggering checks.');
            projectQueueManager.checkRearrangementLoad();
            //projectQueueManager.triggerRearrangementLoad();
        } else {
            config.log.info(context, 'ADC loading is disabled.');
            // TODO: remove any existing jobs from the queue?
        }

        if (config.enable_job_queues) {
            config.log.info(context, 'Job queues are ENABLED.', true);
        } else {
            config.log.info(context, 'Job queues are DISABLED.', true);
        }

    })
    .catch(function(error) {
        var msg = config.log.error('Error occurred while initializing API service.\nSystem may need to be restarted.\n' + error);
        webhookIO.postToSlack(msg);
        // let it continue in case its a temporary error
        //process.exit(1);
    });

// WebsocketIO
require('./utilities/websocketManager');

var accountQueueManager = require('./queues/accountQueueManager');
accountQueueManager.processNewAccounts();

var jobQueueManager = require('./queues/jobQueueManager');
//jobQueueManager.processJobs();

var projectQueueManager = require('./queues/projectQueueManager');
projectQueueManager.processProjects();

var adcDownloadQueueManager = require('./queues/adcDownloadQueueManager');
