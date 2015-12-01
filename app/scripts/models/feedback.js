
'use strict';

var _ = require('underscore');
var FeedbackUtilities = require('./mixins/feedbackUtilities');

var Feedback = function(attributes) {
    this.username = attributes.username || '';
    this.feedback = attributes.feedback || '';
    this.remoteip = attributes.remoteip || '';
    this.g_recaptcha_response = attributes.g_recaptcha_response || '';
};

_.extend(Feedback.prototype, FeedbackUtilities);

module.exports = Feedback;
