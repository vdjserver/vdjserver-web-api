
'use strict';

var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var Feedback = require('../models/feedback');

// Processing
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Recaptcha = require('recaptcha-v2').Recaptcha;
var _ = require('underscore');

var FeedbackController = {};
module.exports = FeedbackController;

FeedbackController.createFeedback = function(request, response) {

    if (_.isString(request.body.feedback) === false || request.body.feedback.length <= 0) {
        console.error('FeedbackController.createFeedback - error - missing feedback parameter');
        apiResponseController.sendError('Feedback parameter required.', 400, response);
        return;
    }

    if (_.isString(request.body.username) === false || request.body.username.length <= 0) {
        console.error('FeedbackController.createFeedback - error - missing username parameter');
        apiResponseController.sendError('Username parameter required.', 400, response);
        return;
    }

    var feedback = new Feedback({
        feedback: request.body.feedback,
        username: request.body.username,
    });

    console.log('FeedbackController.createFeedback - event - received feedback: ' + JSON.stringify(feedback));

    // store in metadata
    feedback.storeFeedbackInMetadata();

    // send as email
    emailIO.sendFeedbackEmail(config.feedbackEmail, feedback.feedback);

    apiResponseController.sendSuccess('Feedback submitted successfully.', response);
};

FeedbackController.createPublicFeedback = function(request, response) {
    var feedback = new Feedback({
        feedback: request.body.feedback,
        remoteip: request.connection.remoteAddress,
        g_recaptcha_response: request.body['g-recaptcha-response']
    });

    var recaptchaData = {
        remoteip:  feedback.remoteip,
        response: feedback.g_recaptcha_response,
        secret: config.recaptchaSecret
    };

    // verify the recaptcha
    var recaptcha = new Recaptcha(config.recaptchaPublic, config.recaptchaSecret, recaptchaData);

    recaptcha.verify(function(success, errorCode) {
        if (!success) {
            console.error('FeedbackController.createPublicFeedback - error - error code is: ' + errorCode);
            apiResponseController.sendError('Recaptcha response invalid: ' + errorCode, 400, response);
            return;
        }
        else {
            console.log('FeedbackController.createPublicFeedback - event - received feedback: ' + JSON.stringify(feedback));

            // store in metadata
            feedback.storeFeedbackInMetadata();

            // send the email
            emailIO.sendFeedbackEmail(config.feedbackEmail, feedback.feedback);

            //send the response
            apiResponseController.sendSuccess('Feedback submitted successfully.', response);
            return;
        }
    });
};
