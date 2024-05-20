'use strict';

var moment = require('moment-timezone');
var request = require('request');

var webhookIO = {};
module.exports = webhookIO;

var config = require('../config/config');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;

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
