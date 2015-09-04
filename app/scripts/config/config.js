'use strict';

var config = {};

module.exports = config;

// General
config.port = process.env.VDJ_API_PORT;
config.sessionSecret = process.env.SESSION_SECRET;

// Recaptcha
config.recaptchaSecret = process.env.RECAPTCHA_SECRET;
config.recaptchaPublic = process.env.RECAPTCHA_PUBLIC;

// Feedback Email address
config.feedbackEmail = process.env.FEEDBACK_EMAIL_ADDRESS;
