'use strict';

var agaveSettings = require('../config/agaveSettings');

var moment = require('moment-timezone');
var request = require('request');

var webhookIO = {};
module.exports = webhookIO;

webhookIO.postToSlack = function(eventMessage, eventUsername) {

    request({
        url: process.env.SLACK_WEBHOOK_URL,
        json: {
            text: 'Event: ' + eventMessage + '\n'
                  + 'Environment: ' + process.env.VDJ_BACKBONE_HOST + '\n'
                  + 'Timestamp: ' + moment().tz('America/Chicago').format()
                  ,
        },
        method: 'POST',
    },
    function(requestError, response, body) {
        console.log('Posted slack webhook for message: "' + eventMessage + '", username is: ' + eventUsername);
    })
    ;
};
