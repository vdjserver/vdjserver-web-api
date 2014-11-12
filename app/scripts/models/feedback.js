
'use strict';

var Feedback = function(attributes) {
    this.feedback                  = attributes.feedback || '';
    this.recaptcha_challenge_field = attributes.recaptcha_challenge_field || '';
    this.recaptcha_response_field  = attributes.recaptcha_response_field || '';
    this.remoteip                  = attributes.remoteip || '';
};

module.exports = Feedback;
