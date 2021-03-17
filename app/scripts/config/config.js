
'use strict';

//
// configu.js
// General configuration settings
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

var config = {};

module.exports = config;

function parseBoolean(value)
{
    if (value == 'true') return true;
    else if (value == 1) return true;
    else return false;
}

// General
config.port = process.env.VDJ_API_PORT;
config.sessionSecret = process.env.SESSION_SECRET;

// Host user and group
config.hostServiceAccount = process.env.HOST_SERVICE_ACCOUNT;
config.hostServiceGroup = process.env.HOST_SERVICE_GROUP;

// Recaptcha
config.recaptchaSecret = process.env.RECAPTCHA_SECRET;
config.recaptchaPublic = process.env.RECAPTCHA_PUBLIC;
config.allowRecaptchaSkip = parseBoolean(process.env.ALLOW_RECAPTCHA_SKIP);
if (config.allowRecaptchaSkip) console.log('VDJ-API WARNING: Recaptcha check is being skipped.');

// Test settings
config.useTestAccount = parseBoolean(process.env.USE_TEST_ACCOUNT);
config.testAccountUsername = process.env.TEST_ACCOUNT_USERNAME;
if (config.useTestAccount) console.log('VDJ-API WARNING: Test account (' + config.testAccountUsername + ') is enabled.');

// Feedback Email address
config.feedbackEmail = process.env.FEEDBACK_EMAIL_ADDRESS;

// Error/debug reporting
config.debug = parseBoolean(process.env.DEBUG_CONSOLE);
if (config.debug) console.log('VDJ-API WARNING: Debug console messages are enabled.');
