
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Models
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
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

        var serviceAccount = new ServiceAccount();
        var user = createUserJob.data;

        agaveIO.createUserProfile(user, serviceAccount.accessToken)
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

                webhookIO.postToSlack('AccountQueueManager.processNewAccounts createUserProfileMetadataTask fail', user.username);

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

        agaveIO.createUserVerificationMetadata(user.username)
            .then(function(userVerificationMetadata) {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                    + ' - event - created metadata successful for ' + user.username
                );

                emailIO.sendWelcomeEmail(user.email, userVerificationMetadata.uuid);
            })
            .then(function() {
                console.log(
                    'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                    + ' - event - finish successful for ' + user.username
                );

                done();
            })
            .fail(function(error) {
                webhookIO.postToSlack('AccountQueueManager.processNewAccounts createUserVerificationMetadataTask fail', user.username);

                var errorMessage = 'AccountQueueManager.processNewAccounts createUserVerificationMetadataTask'
                                 + ' - error - user ' + user.username + ', error ' + error
                                 ;

                console.log(errorMessage);

                done(new Error(errorMessage));
            })
            ;
    });

};
