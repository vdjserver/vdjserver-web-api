
'use strict';

// App
var app = require('../app');
var agaveSettings = require('../config/agaveSettings');

// Models
var FileUploadJob = require('../models/fileUploadJob');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');

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

        console.log("createUserProfileMetadataTask running");

        var serviceAccount = new ServiceAccount();
        var user = createUserJob.data;

        console.log("A user 1 is: " + JSON.stringify(user));

        agaveIO.createUserProfile(user, serviceAccount.accessToken)
            .then(function() {
                console.log("createUserProfileMetadataTask then ok");

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
                console.log("createUserProfileMetadataTask done");
                done();
            })
            .fail(function(error) {
                console.log("createUserProfileMetadataTask error");
                done(new Error('createUserProfileMetadataTask error is: ' + error));
            })
            ;
    });

    taskQueue.process('createUserVerificationMetadataTask', function(createUserJob, done) {

        console.log("createUserVerificationMetadataTask running");

        var user = createUserJob.data;

        console.log("B user 1 is: " + JSON.stringify(user));

        agaveIO.createUserVerificationMetadata(user.username)
            .then(function(userVerificationMetadata) {
                console.log("createUserVerificationMetadata then ok");

                emailIO.sendWelcomeEmail(user.email, userVerificationMetadata.uuid);
            })
            .then(function() {
                console.log("createUserProfileMetadataTask done");
                done();
            })
            .fail(function(error) {
                console.log("createUserVerificationMetadataTask error");
                done(new Error('createUserVerificationMetadataTask error is: ' + error));
            })
            ;
    });

};
