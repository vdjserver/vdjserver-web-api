'use strict';

var agaveSettings = require('../config/agaveSettings');
var nodemailer    = require('nodemailer');
var sendmailTransport = require('nodemailer-sendmail-transport');

var transporter = nodemailer.createTransport(sendmailTransport());

var emailIO = {};
module.exports = emailIO;

emailIO.sendPasswordResetEmail = function(recipientEmail, passwordResetCode) {

    var passwordResetUrl = agaveSettings.vdjBackbone + '/password-reset/' + passwordResetCode;

    var mailOptions = {
        to: recipientEmail,
        subject: 'VDJ Password Reset',
        generateTextFromHTML: true,
        html: 'A VDJ password reset request has been submitted to vdjserver.org.'
              + '<br>'
              + 'Please go to <a href="' + passwordResetUrl + '">' + passwordResetUrl + '</a> to reset your password.'
              + '<br>'
              + 'If you have not submitted a password reset request, then please disregard this email.',

    };

    transporter.sendMail(
        mailOptions,
        function(error /*, info*/) {
            if (error) {
                console.log('Error sending password reset email.', error);
            }
        }
    );
};

emailIO.sendFeedbackEmail = function(recipientEmail, feedback) {
    var mailOptions = {
        to: recipientEmail,
        subject: 'VDJServer.org Feedback',
        text: feedback,
    };

    transporter.sendMail(
        mailOptions,
        function(error /*, info*/) {
            if (error) {
                console.log('Error sending feedback email.', error);
            }
        }
    );
};

emailIO.sendWelcomeEmail = function(recipientEmail, verificationId) {

    var vdjWebappUrl = agaveSettings.vdjBackbone
                     + '/account'
                     + '/verify'
                     + '/' + verificationId
                     ;

    var mailOptions = {
        to: recipientEmail,
        subject: 'VDJServer Account Verification',
        generateTextFromHTML: true,
        html: 'Welcome to VDJServer.'
              + '<br>'
              + 'Please verify your account by clicking on the link below:'
              + '<br>'
              + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
              ,

    };

    transporter.sendMail(
        mailOptions,
        function(error /*, info*/) {
            if (error) {
                console.log('Error sending account verification email.', error);
            }
        }
    );
};
