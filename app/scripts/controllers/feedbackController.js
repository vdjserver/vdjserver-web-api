
'use strict';

var config = require('../config/config');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var Feedback = require('../models/feedback');

// Processing
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Recaptcha = require('recaptcha').Recaptcha;

var FeedbackController = {};
module.exports = FeedbackController;

FeedbackController.createFeedback = function(request, response) {

  var feedback = new Feedback({
    feedback : request.body.feedback,
    remoteip:  request.connection.remoteAddress,
    recaptcha_challenge_field : request.body.recaptcha_challenge_field,
    recaptcha_response_field : request.body.recaptcha_response_field,
  });

  var recaptchaData = {
    remoteip: feedback.remoteip,
    challenge: feedback.recaptcha_challenge_field,
    response: feedback.recaptcha_response_field,
  };

  //verify the recaptcha
  var recaptcha = new Recaptcha(config.recaptchaPublic, config.recaptchaSecret, recaptchaData);
  recaptcha.verify(
    function(success, error_code) {
        if (! success) {
            apiResponseController.sendError('Recaptcha response invalid: ' + error_code, response);
            return;
        } else {
          //send the email
          emailIO.sendFeedbackEmail(config.feedbackEmail, feedback.feedback);

          //send the response
          apiResponseController.sendSuccess('Feedback submitted successfully.', response);
          return;
        }
  });
};
