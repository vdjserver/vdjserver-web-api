
'use strict';

//
// feedback.js
// User feedback
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2015-2024 The University of Texas Southwestern Medical Center
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

// Node Libraries
var _ = require('underscore');

var config = require('../config/config');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;

var Feedback = function(attributes) {
    this.username = attributes.username || '';
    this.email    = attributes.email || '';
    this.feedback = attributes.feedback || '';
    this.remoteip = attributes.remoteip || '';
    this.g_recaptcha_response = attributes.g_recaptcha_response || '';
};

Feedback.prototype.storeFeedbackInMetadata = async function() {
    if (_.isString(this.feedback) === false) {
        return Promise.reject('internal error: Unable to find local feedback variable.');
    }

    return tapisIO.createFeedbackMetadata(
        this.feedback,
        this.username,
        this.email
    );
};

Feedback.prototype.getEmailMessage = function() {
    var emailFeedbackMessage = this.feedback
        + '\n\n VDJServer Automated Note: user email address is ' + this.email;

    return emailFeedbackMessage;
};

module.exports = Feedback;
