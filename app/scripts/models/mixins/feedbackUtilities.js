
'use strict';

// Node Libraries
var Q = require('q');
var _ = require('underscore');

// Processing
var agaveIO = require('../../vendor/agaveIO');

var FeedbackUtilities = {};

FeedbackUtilities.storeFeedbackInMetadata = function() {
    if (_.isString(this.feedback) === false) {
        var deferred = Q.defer();

        var error = new Error('Unable to find local feedback variable.');
        deferred.reject(error);

        return deferred.promise;
    }

    return agaveIO.createFeedbackMetadata(this.feedback, this.username, this.email);
};

module.exports = FeedbackUtilities;
