
'use strict';

// Controllers
var apiResponseController = require('../controllers/apiResponseController');
var communityDataController = require('../controllers/communityDataController');
var jobsController        = require('../controllers/jobsController');
var feedbackController    = require('../controllers/feedbackController');
var notificationsController = require('../controllers/notificationsController');
var passwordResetController = require('../controllers/passwordResetController');
var permissionsController = require('../controllers/permissionsController');
var projectController     = require('../controllers/projectController');
var telemetryController   = require('../controllers/telemetryController');
var tokenController       = require('../controllers/tokenController');
var userController        = require('../controllers/userController');
var authController        = require('../controllers/authController');

// Passport
var passport      = require('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

passport.use(new BasicStrategy(
    function(userKey, userSecret, next) {
	console.log(userKey);
        return next(null, {username: userKey, password: userSecret});
    }
));

module.exports = function(app) {

    app.get(
        '/',
        apiResponseController.confirmUpStatus
    );

    // not used, so disabled
    //app.get(
    //    '/export/community',
    //    passport.authenticate('basic', {session: false}),
    //    communityDataController.getCommunityData
    //);

    // Send feedback
    app.post(
        '/feedback',
        feedbackController.createFeedback
    );

    app.post(
        '/feedback/public',
        feedbackController.createPublicFeedback
    );

    app.get(
        '/jobs/queue/pending',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromQuery,
        jobsController.getPendingJobs
    );

    // Queue Jobs
    app.post(
        '/jobs/queue',
        passport.authenticate('basic', {session: false}),
        jobsController.queueJob
    );

    // Archive/Unarchive Jobs
    app.post(
        '/jobs/archive/:jobId',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
        jobsController.archiveJob
    );

    app.post(
        '/jobs/unarchive/:jobId',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
        jobsController.unarchiveJob
    );

    // Process File Import Notification
    app.post(
        '/notifications/files/import',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromQuery,
        notificationsController.processFileImportNotifications
    );

    // Process Job Create Notification
    app.post(
        '/notifications/jobs/:jobId',
        notificationsController.processJobNotifications
    );

    // Update file permissions
    // not used, so disabled
    //app.post(
    //    '/permissions/files',
    //    passport.authenticate('basic', {session: false}),
    //    permissionsController.syncFilePermissionsWithProject
    //);

    // Share Job With Project Member (update job permissions)
    // not used, so disabled
    //app.post(
    //    '/permissions/jobs',
    //    passport.authenticate('basic', {session: false}),
    //    permissionsController.addPermissionsForJob
    //);

    // Update metadata permissions
    app.post(
        '/permissions/metadata',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromBody,
	authController.authForMetadataFromBody,
        permissionsController.syncMetadataPermissionsWithProject
    );

    // Add permissions for new user
    app.post(
        '/permissions/username',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.verifyUserFromBody,
	authController.authForProjectFromBody,
        permissionsController.addPermissionsForUsername
    );

    // Remove all permissions for user
    app.delete(
        '/permissions/username',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.verifyUserFromBody,
	authController.authForProjectFromBody,
        permissionsController.removePermissionsForUsername
    );

    // Create a project
    app.post(
        '/projects',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.verifyUserFromBody,
        projectController.createProject
    );

    // Import/export subject metadata
    app.get(
        '/projects/:projectUuid/metadata/subject/export',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromParams,
        projectController.exportSubjectMetadata
    );
    app.post(
        '/projects/:projectUuid/metadata/subject/import',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromParams,
        projectController.importSubjectMetadata
    );

    // Import/export sample metadata
    app.get(
        '/projects/:projectUuid/metadata/sample/export',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromParams,
        projectController.exportSampleMetadata
    );
    app.post(
        '/projects/:projectUuid/metadata/sample/import',
        passport.authenticate('basic', {session: false}),
	authController.authUser,
	authController.authForProjectFromParams,
        projectController.importSampleMetadata
    );

    // Record Telemetry Data
    app.post(
        '/telemetry',
        telemetryController.recordErrorTelemetry
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

    // Resend User Verification Email
    app.post(
        '/user/:username/verify/email',
        userController.resendVerificationEmail
    );

    // Verify Username
    app.post(
        '/user/verify/:verificationId',
        userController.verifyUser
    );

    // Errors
    app.route('*')
        .get(apiResponseController.send404)
        .post(apiResponseController.send404)
        .put(apiResponseController.send404)
        .delete(apiResponseController.send404)
        ;
};
