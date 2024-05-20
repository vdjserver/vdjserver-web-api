
'use strict';

// Node Libraries
var Q = require('q');
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

Feedback.prototype.storeFeedbackInMetadata = function() {
    if (_.isString(this.feedback) === false) {
        var deferred = Q.defer();

        var error = new Error('Unable to find local feedback variable.');
        deferred.reject(error);

        return deferred.promise;
    }

    return tapisIO.createFeedbackMetadata(
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
