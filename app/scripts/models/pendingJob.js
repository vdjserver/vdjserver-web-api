
'use strict';

var _ = require('underscore');

// Node Libraries
var moment = require('moment');

var PendingJob = function(attributes) {
    if (typeof attributes === 'object') {
        this.name  = attributes.name || '';
        this.appId = attributes.appId || '';
        this.executionSystem = attributes.executionSystem || '';
    }
};

PendingJob.prototype.getAgaveFormattedJobObject = function() {
    return {
        'id': '',
        'name': this.name,
        'owner': 'vdj',
        'executionSystem': this.executionSystem,
        'appId': this.appId,
        'created': '',
        'status': 'PENDING',
        'startTime': '',
        'endTime': '',
        '_links': {},
    };
};

module.exports = PendingJob;
