
'use strict';

// App
var app = require('../app');
var config = require('../config/config');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var ServiceAccount = tapisIO.serviceAccount;

// Processing
var emailIO = require('../vendor/emailIO');
var webhookIO = require('../vendor/webhookIO');

// Node Libraries
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});

var AccountQueueManager = {};
module.exports = AccountQueueManager;

AccountQueueManager.processNewAccounts = function() {

    taskQueue.process('createUserProfileMetadataTask', function(createUserJob, done) {

        var user = createUserJob.data;

        ServiceAccount.getToken()
            .then(function(token) {
                return tapisIO.createUserProfile(user, ServiceAccount.accessToken())
            })
            .then(function() {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserProfileMetadataTask'
                    + ' - event - createUserProfile successful for ' + user.username
                );

                taskQueue
                    .create('createUserVerificationMetadataTask', user)
                    .removeOnComplete(true)
                    .attempts(5)
                    .backoff({
                        delay: 60 * 1000,
                        type: 'fixed',
                    })
                    .save()
                    ;
            })
            .then(function() {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserProfileMetadataTask'
                    + ' - event - queued next task successful for ' + user.username
                );

                done();
            })
            .fail(function(error) {

                webhookIO.postToSlack('AccountQueueManager.processNewAccounts createUserProfileMetadataTask fail for user: ' + user.username);

                var errorMessage = 'AccountQueueManager.processNewAccounts createUserProfileMetadataTask'
                                 + ' - error - user ' + user.username + ', error ' + error
                                 ;

                console.log(errorMessage);

                done(new Error(errorMessage));
            })
            ;
    });

    taskQueue.process('createUserVerificationMetadataTask', function(createUserJob, done) {

        var user = createUserJob.data;

        tapisIO.createUserVerificationMetadata(user.username)
            .then(function(userVerificationMetadata) {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                    + ' - event - created metadata successful for ' + user.username
                );

                emailIO.sendWelcomeEmail(user.email, user.username, userVerificationMetadata.uuid);
            })
            .then(function() {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                    + ' - event - finish successful for ' + user.username
                );

                done();
            })
            .fail(function(error) {
                webhookIO.postToSlack('AccountQueueManager.processNewAccounts createUserVerificationMetadataTask fail for user: ' + user.username);

                var errorMessage = 'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                                 + ' - error - user ' + user.username + ', error ' + error
                                 ;

                console.log(errorMessage);

                done(new Error(errorMessage));
            })
            ;
    });

};
