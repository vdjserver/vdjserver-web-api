'use strict';

var config = {};

module.exports = config;

// General
config.port = process.env.VDJ_API_PORT;
config.sessionSecret = process.env.SESSION_SECRET;

// Recaptcha
config.recaptchaSecret = process.env.RECAPTCHA_SECRET;
config.recaptchaPublic = process.env.RECAPTCHA_PUBLIC;
config.allowRecaptchaSkip = process.env.ALLOW_RECAPTCHA_SKIP;

// Test settings
config.useTestAccount = process.env.USE_TEST_ACCOUNT;
config.testAccountUsername = process.env.TEST_ACCOUNT_USERNAME;

// Feedback Email address
config.feedbackEmail = process.env.FEEDBACK_EMAIL_ADDRESS;

// Error/debug reporting
config.debug = process.env.DEBUG_CONSOLE;
if (config.debug == 'true') config.debug = true;
else if (config.debug == 1) config.debug = true;
else config.debug = false;
