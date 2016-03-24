
'use strict';

// Node Libraries
var Q = require('q');
var _ = require('underscore');

// Processing
var agaveIO = require('../vendor/agaveIO');

var Feedback = function(attributes) {
    this.username = attributes.username || '';
    this.email    = attributes.email || '';
    this.feedback = attributes.feedback || '';
    this.remoteip = attributes.remoteip || '';
    this.g_recaptcha_response = attributes.g_recaptcha_response || '';
};

Feedback.prototype.storeFeedbackInMetadata = function() {
    if (_.isString(this.feedback) === false) {
        var deferred = Q.defer();

        var error = new Error('Unable to find local feedback variable.');
        deferred.reject(error);

        return deferred.promise;
    }

    return agaveIO.createFeedbackMetadata(
        this.feedback,
        this.username,
        this.email
    );
};

Feedback.prototype.getEmailMessage = function() {
    var emailFeedbackMessage = this.feedback
                             + '\n\n VDJServer Automated Note: user email address is ' + this.email
                             ;

    return emailFeedbackMessage;
};

module.exports = Feedback;
