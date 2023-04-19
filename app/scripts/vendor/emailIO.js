'use strict';

//
// emailIO.js
// Sending emails to users
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

var emailSettings = require('../config/emailSettings');
var nodemailer    = require('nodemailer');
var sendmailTransport = require('nodemailer-sendmail-transport');

var transporter = nodemailer.createTransport(sendmailTransport());

var emailIO = {};
module.exports = emailIO;

var config = require('../config/config');

// Tapis
var tapisV2 = require('vdj-tapis-js/tapis');
var tapisV3 = require('vdj-tapis-js/tapisV3');
var tapisIO = null;
if (config.tapis_version == 2) tapisIO = tapisV2;
if (config.tapis_version == 3) tapisIO = tapisV3;
var tapisSettings = tapisIO.tapisSettings;

emailIO.sendPasswordResetEmail = function(recipientEmail, username, passwordResetCode) {

    var passwordResetUrl = tapisSettings.vdjBackbone + '/password-reset/' + passwordResetCode;

    var mailOptions = {
        to: recipientEmail,
        from: emailSettings.fromAddress,
        replyTo: emailSettings.replyToAddress,
        subject: 'VDJServer Password Reset',
        generateTextFromHTML: true,
        html: 'A password reset request has been submitted to vdjserver.org.'
              + '<br>'
              + '<br>'
              + 'Reset your password for account "' + username + '" with reset code: ' + passwordResetCode + ', or by clicking on the link below:'
              + '<br>'
              + '<br>'
              + 'Please go to <a href="' + passwordResetUrl + '">' + passwordResetUrl + '</a> to reset your password.'
              + '<br>'
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
        from: emailSettings.fromAddress,
        replyTo: emailSettings.replyToAddress,
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

emailIO.sendFeedbackAcknowledgementEmail = function(recipientEmail, feedback) {
    var mailOptions = {
        to: recipientEmail,
        from: emailSettings.fromAddress,
        replyTo: emailSettings.replyToAddress,
        subject: 'VDJServer.org Feedback',
        text: 'Thank you for your feedback! Someone will respond shortly. Your feedback text is shown below\n\n-----\n\n' + feedback,
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

emailIO.sendWelcomeEmail = function(recipientEmail, username, verificationId) {

    var vdjWebappUrl = tapisSettings.vdjBackbone
                     + '/account'
                     + '/verify'
                     + '/' + verificationId
                     ;

    var mailOptions = {
        to: recipientEmail,
        from: emailSettings.fromAddress,
        replyTo: emailSettings.replyToAddress,
        subject: 'VDJServer Account Verification',
        generateTextFromHTML: true,
        html: 'Welcome to VDJServer!'
              + '<br>'
              + '<br>'
              + 'Please verify your account "' + username + '" with verification code: ' + verificationId + ', or by clicking on the link below:'
              + '<br>'
              + '<br>'
              + '<a href="' + vdjWebappUrl + '">' + vdjWebappUrl + '</a>.'
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

emailIO.sendGenericEmail = function(recipientEmail, subject, message) {

    var mailOptions = {
        to: recipientEmail,
        from: emailSettings.fromAddress,
        replyTo: emailSettings.replyToAddress,
        subject: subject,
        generateTextFromHTML: true,
        html: message
    };

    transporter.sendMail(
        mailOptions,
        function(error /*, info*/) {
            if (error) {
                console.log('Error sending email.', error);
            }
        }
    );
};
