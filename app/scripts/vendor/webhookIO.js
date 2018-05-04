'use strict';

var agaveSettings = require('../config/agaveSettings');

var moment = require('moment-timezone');
var request = require('request');

var webhookIO = {};
module.exports = webhookIO;

webhookIO.postToSlack = function(eventMessage, eventUsername) {

    if (process.env.DISABLE_SLACK) return;

    request({
        url: process.env.SLACK_WEBHOOK_URL,
        json: {
            text: 'Event: ' + eventMessage + '\n'
                  + 'Environment: ' + process.env.VDJ_BACKBONE_HOST + '\n'
                  + 'Timestamp: ' + moment().tz('America/Chicago').format()
                  ,
            username: 'VDJ Telemetry Bot',
        },
        method: 'POST',
    },
    function(requestError, response, body) {
        console.log('Posted slack webhook for message: "' + eventMessage + '"');
    })
    ;
};
