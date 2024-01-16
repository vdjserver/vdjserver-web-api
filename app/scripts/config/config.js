
'use strict';

//
// config.js
// General configuration settings
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

var config = {};

module.exports = config;

var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');

function parseBoolean(value)
{
    if (value == 'true') return true;
    else if (value == 1) return true;
    else return false;
}

// General
config.name = 'VDJ-API';
config.port = process.env.VDJ_API_PORT;
config.sessionSecret = process.env.SESSION_SECRET;
config.vdjserver_data_path = process.env.VDJSERVER_DATA_PATH;
config.lrqdata_path = process.env.LRQDATA_PATH;
config.tapis_version = process.env.TAPIS_VERSION;

// Queues
config.redis_port = 6379;
config.redis_host = 'vdj-redis';
config.enable_job_queues = parseBoolean(process.env.ENABLE_JOB_QUEUES);

// Host user and group
config.hostServiceAccount = process.env.HOST_SERVICE_ACCOUNT;
config.hostServiceGroup = process.env.HOST_SERVICE_GROUP;
config.vdjserver_data_path = process.env.VDJSERVER_DATA_PATH;
config.lrqdata_path = process.env.LRQDATA_PATH;

// Error/debug reporting
config.debug = parseBoolean(process.env.DEBUG_CONSOLE);

// standard info/error reporting
config.log = {};
config.log.info = function(context, msg, ignore_debug = false) {
    var date = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    if (ignore_debug)
        console.log(date, '-', config.name, 'INFO (' + context + '):', msg);
    else
        if (config.debug) console.log(date, '-', config.name, 'INFO (' + context + '):', msg);
}

config.log.error = function(context, msg) {
    var date = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
    var full_msg = date + ' - ' + config.name + ' ERROR (' + context + '): ' + msg
    console.error(full_msg);
    return full_msg;
}
config.log.info('config', 'Debug console messages are enabled.', true);

// AIRR Data Commons
config.adcRepositoryEntry = process.env.ADC_REPOSITORY_ENTRY;
if (! config.adcRepositoryEntry) config.adcRepositoryEntry = 'adc';
config.log.info('config', 'adc_system_repositories entry = ' + config.adcRepositoryEntry, true);
config.enableADCDownloadCache = parseBoolean(process.env.ENABLE_ADC_DOWNLOAD_CACHE);
config.enableADCLoad = parseBoolean(process.env.ENABLE_ADC_LOAD);

// Recaptcha
config.recaptchaSecret = process.env.RECAPTCHA_SECRET;
config.recaptchaPublic = process.env.RECAPTCHA_PUBLIC;
config.allowRecaptchaSkip = parseBoolean(process.env.ALLOW_RECAPTCHA_SKIP);
if (config.allowRecaptchaSkip) config.log.info('config', 'Recaptcha check is being skipped.', true);

// Test settings
config.useTestAccount = parseBoolean(process.env.USE_TEST_ACCOUNT);
config.testAccountUsername = process.env.TEST_ACCOUNT_USERNAME;
if (config.useTestAccount) config.log.info('config', 'Test account (' + config.testAccountUsername + ') is enabled.', true);
config.errorInjection = parseBoolean(process.env.ERROR_INJECTION);
if (config.errorInjection) config.log.info('config', 'Error injection is enabled.', true);

// Feedback Email address
config.feedbackEmail = process.env.FEEDBACK_EMAIL_ADDRESS;

// Error injection enabled
if (config.errorInjection) {
    global.errorInjection = require('../../../test/errorInjection');
    config.performInjectError = function() {
        return global.errorInjection.performInjectError();
    };
}
config.injectError = function(error) {
    if (config.errorInjection) return global.errorInjection.setCurrentError(error);
    else return null;
};
config.shouldInjectError = function(value) {
    if (config.errorInjection) return global.errorInjection.shouldInjectError(value);
    else return false;
};

// get service info
var infoFile = path.resolve(__dirname, '../../../package.json');
var infoString = fs.readFileSync(infoFile, 'utf8');
var info = JSON.parse(infoString);
config.info = {};
config.info.title = info.name;
config.info.description = info.description;
config.info.version = info.version;
config.info.contact = {
    name: "VDJServer",
    url: "http://vdjserver.org/",
    email: "vdjserver@utsouthwestern.edu"
};
config.info.license = {};
config.info.license.name = info.license;

// get schema info
var schemaFile = fs.readFileSync(path.resolve(__dirname, '../../airr-standards/specs/airr-schema.yaml'), 'utf8');
var schemaSpec = yaml.safeLoad(schemaFile);
config.info.schema = schemaSpec['Info'];

