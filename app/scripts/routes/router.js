
'use strict';

// Controllers
var apiResponseController = require('../controllers/apiResponseController');
var jobsController        = require('../controllers/jobsController');
var feedbackController    = require('../controllers/feedbackController');
var notificationsController = require('../controllers/notificationsController');
var passwordResetController = require('../controllers/passwordResetController');
var permissionsController = require('../controllers/permissionsController');
var projectController     = require('../controllers/projectController');
var tokenController       = require('../controllers/tokenController');
var userController        = require('../controllers/userController');

// Passport
var passport      = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

passport.use(new BasicStrategy(
    function(userKey, userSecret, next) {
        return next(null, {username: userKey, password: userSecret});
    }
));

module.exports = function(app) {

    app.get(
        '/',
        apiResponseController.confirmUpStatus
    );

    // Create a project
    app.post(
        '/projects',
        projectController.createProject
    );

    // Update file permissions
    app.post(
        '/permissions/files',
        passport.authenticate('basic', {session: false}),
        permissionsController.syncFilePermissionsWithProject
    );

    // Update metadata permissions
    app.post(
        '/permissions/metadata',
        passport.authenticate('basic', {session: false}),
        permissionsController.syncMetadataPermissionsWithProject
    );

    // Add permissions for new user
    app.post(
        '/permissions/username',
        passport.authenticate('basic', {session: false}),
        permissionsController.addPermissionsForUsername
    );

    // Remove all permissions for user
    app.delete(
        '/permissions/username',
        passport.authenticate('basic', {session: false}),
        permissionsController.removePermissionsForUsername
    );

    // Request an Agave token
    app.post(
        '/token',
        passport.authenticate('basic', {session: false}),
        tokenController.getToken
    );

    // Refresh an Agave token
    app.put(
        '/token',
        passport.authenticate('basic', {session: false}),
        tokenController.refreshToken
    );

    // Create a user
    app.post(
        '/user',
        userController.createUser
    );

    // User change password
    app.post(
        '/user/change-password',
        passport.authenticate('basic', {session: false}),
        userController.changePassword
    );

    // Initiate Password Reset
    app.post(
        '/user/reset-password',
        passwordResetController.createResetPasswordRequest
    );

    // Verify Password Reset
    app.post(
        '/user/reset-password/verify',
        passwordResetController.processResetPasswordRequest
    );

    // Verify Username
    app.post(
        '/user/verify/:verificationId',
        userController.verifyUser
    );

    // Resend User Verification Email
    app.post(
        '/user/:username/verify/email',
        userController.resendVerificationEmail
    );

    // Process Job Create Notification
    app.post(
        '/notifications/jobs/:jobId',
        notificationsController.processJobNotifications
    );

    // Create Job Metadata
    app.post(
        '/jobs/metadata',
        passport.authenticate('basic', {session: false}),
        jobsController.createJobMetadata
    );

    // Share Job With Project Member (update job permissions)
    app.post(
        '/permissions/jobs',
        passport.authenticate('basic', {session: false}),
        permissionsController.addPermissionsForJob
    );

    // Create a project
    app.post(
        '/feedback',
        feedbackController.createFeedback
    );

    // Errors
    app.route('*')
        .get(apiResponseController.send404)
        .post(apiResponseController.send404)
        .put(apiResponseController.send404)
        .delete(apiResponseController.send404);
};
