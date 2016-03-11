
'use strict';

var _ = require('underscore');
var FeedbackUtilities = require('./mixins/feedbackUtilities');

var PublicFeedback = function(attributes) {
    this.username                  = '';
    this.email                     = attributes.email || '';
    this.feedback                  = attributes.feedback || '';
    this.recaptcha_challenge_field = attributes.recaptcha_challenge_field || '';
    this.recaptcha_response_field  = attributes.recaptcha_response_field || '';
    this.remoteip                  = attributes.remoteip || '';
};

_.extend(PublicFeedback.prototype, FeedbackUtilities);

module.exports = PublicFeedback;
