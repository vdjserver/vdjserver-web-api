'use strict';

var agaveSettings = require('../config/agaveSettings');

var nodemailer = require('nodemailer');

var smtpTransport = nodemailer.createTransport('Sendmail');

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

    smtpTransport.sendMail(mailOptions);
};
