
'use strict';

var _ = require('underscore');
var FeedbackUtilities = require('./mixins/feedbackUtilities');

var Feedback = function(attributes) {
    this.username = attributes.username || '';
    this.feedback = attributes.feedback || '';
    this.remoteip = attributes.remoteip || '';
    this.recaptcha_challenge_field = attributes.recaptcha_challenge_field || '';
    this.recaptcha_response_field = attributes.recaptcha_response_field || '';
};

_.extend(Feedback.prototype, FeedbackUtilities);

module.exports = Feedback;
