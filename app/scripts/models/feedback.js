
'use strict';

var _ = require('underscore');
var FeedbackUtilities = require('./mixins/feedbackUtilities');

var Feedback = function(attributes) {
    this.username = attributes.username || '';
    this.feedback = attributes.feedback || '';
};

_.extend(Feedback.prototype, FeedbackUtilities);

module.exports = Feedback;
