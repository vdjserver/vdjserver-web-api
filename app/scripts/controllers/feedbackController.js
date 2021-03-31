
'use strict';

//
// feedbackController.js
// Handle feedback entry points
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

var FeedbackController = {};
module.exports = FeedbackController;

var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var Feedback = require('../models/feedback');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Recaptcha = require('recaptcha-v2').Recaptcha;
var _ = require('underscore');

// we use recaptcha to deter user creation bots
var verifyRecaptcha = function(recaptchaData) {

    var recaptcha = new Recaptcha(
        config.recaptchaPublic,
        config.recaptchaSecret,
        recaptchaData
    );

    return new Promise(function(resolve, reject) {
        recaptcha.verify(function(success, errorCode) {
            if (!success) {
                reject(errorCode);
            } else {
                resolve();
            }
        });
    });
};

// This requires an authenticated user
FeedbackController.createFeedback = function(request, response) {

    if (_.isString(request.body.feedback) === false || request.body.feedback.length <= 0) {
        var msg = 'VDJ-API ERROR: FeedbackController.createFeedback - error - missing feedback parameter';
        console.error(msg);
        webhookIO.postToSlack(msg);
        apiResponseController.sendError(msg, 400, response);
        return;
    }

    // the user profile is set from the authorization check

    var feedback = new Feedback({
        feedback: request.body.feedback,
        username: request.user.username,
        email: request.user.email
    });

    console.log('VDJ-API INFO: FeedbackController.createFeedback - event - received feedback: ' + JSON.stringify(feedback));

    // store in metadata
    var emailFeedbackMessage = feedback.getEmailMessage();
    feedback.storeFeedbackInMetadata()
        .then(function() {
            // send as email
            return emailIO.sendFeedbackEmail(config.feedbackEmail, emailFeedbackMessage);
        })
        .then(function() {
            // send acknowledgement
            return emailIO.sendFeedbackAcknowledgementEmail(feedback.email, emailFeedbackMessage);
        })
        .then(function() {
            apiResponseController.sendSuccess('Feedback submitted successfully.', response);
            return;
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: FeedbackController.createFeedback - error occured while processing feedback. Feedback is: ' + JSON.stringify(feedback) + ' error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 400, response);
        })
        ;
};

// public feedback, this requires a valid recaptcha response
FeedbackController.createPublicFeedback = async function(request, response) {
    var msg = null;
    var feedback = new Feedback({
        feedback: request.body.feedback,
        email: request.body.email,
        remoteip: request.connection.remoteAddress,
        g_recaptcha_response: request.body['g-recaptcha-response'],
    });

    var recaptchaData = {
        remoteip:  feedback.remoteip,
        response: feedback.g_recaptcha_response,
        secret: config.recaptchaSecret,
    };

    // BEGIN RECAPTCHA CHECK
    if (config.allowRecaptchaSkip && (recaptchaData['response'] == 'skip_recaptcha')) {
        console.log('VDJ-API INFO: FeedbackController.createPublicFeedback - WARNING - Recaptcha check is being skipped.');
    } else {
        await verifyRecaptcha(recaptchaData)
            .catch(function(errorCode) {
                msg = 'VDJ-API ERROR: FeedbackController.createPublicFeedback - Recaptcha response invalid - error code is: ' + errorCode;
            });

        if (msg) {
            console.error(msg);
            webhookIO.postToSlack(msg);
            return apiResponseController.sendError(msg, 400, response);
        }
    }
    // END RECAPTCHA CHECK

    console.log('VDJ-API INFO: FeedbackController.createPublicFeedback - event - received feedback: ' + JSON.stringify(feedback));

    // store in metadata
    var emailFeedbackMessage = feedback.getEmailMessage();
    feedback.storeFeedbackInMetadata()
        .then(function() {
            // send as email
            return emailIO.sendFeedbackEmail(config.feedbackEmail, emailFeedbackMessage);
        })
        .then(function() {
            // send acknowledgement
            return emailIO.sendFeedbackAcknowledgementEmail(feedback.email, emailFeedbackMessage);
        })
        .then(function() {
            apiResponseController.sendSuccess('Feedback submitted successfully.', response);
            return;
        })
        .catch(function(error) {
            var msg = 'VDJ-API ERROR: FeedbackController.createPublicFeedback - error occured while processing feedback. Feedback is: '
                + JSON.stringify(feedback) + ' error: ' + error;
            console.error(msg);
            webhookIO.postToSlack(msg);
            apiResponseController.sendError(msg, 400, response);
        });
};
