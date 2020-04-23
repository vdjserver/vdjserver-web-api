
'use strict';

//
// userController.js
// Handle user entry points
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

var UserController = {};
module.exports = UserController;

var config = require('../config/config');

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');
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
var Recaptcha = require('recaptcha-v2').Recaptcha;

// we use recaptcha to deter user creation bots
var verifyRecaptcha = function(recaptchaData) {

    var deferred = Q.defer();

    var recaptcha = new Recaptcha(
        config.recaptchaPublic,
        config.recaptchaSecret,
        recaptchaData
    );

    recaptcha.verify(function(success, errorCode) {
        if (!success) {
	    deferred.reject(errorCode);
        } else {
	    deferred.resolve();
	}
    });

    return deferred.promise;
};

// create new user account
// 1. verify recaptcha
// 2. verify not duplicate username
// 3. create the tapis/agave user account
// 4. verify we can get token with username/password
// 5. create user profile metadata record
// 6. create user verification metadata record
// 7. send user verification email
UserController.createUser = function(request, response) {

    // the API middleware will reject if missing required fields
    var user = new User(request.body.user);

    // cannot be null
    if (!user.password) {
        console.error('VDJ-API ERROR: UserController.createUser - error - missing password parameter');
        apiResponseController.sendError('Password required.', 400, response);
        return;
    }

    console.log('VDJ-API INFO: UserController.createUser - begin for ' + JSON.stringify(user.getSanitizedAttributes()));

    Q.fcall(function() {
        var deferred = Q.defer();

	// BEGIN RECAPTCHA CHECK
	if (config.allowRecaptchaSkip && (request.body['g-recaptcha-response'] == 'skip_recaptcha')) {
            console.log('VDJ-API INFO: UserController.createUser - WARNING - Recaptcha check is being skipped.');
	    deferred.resolve();
	} else {
            var recaptchaData = {
		remoteip:  request.connection.remoteAddress,
		response: request.body['g-recaptcha-response'],
		secret: config.recaptchaSecret,
            };

	    verifyRecaptcha(recaptchaData)
		.then(function() {
		    //console.log('passed recaptcha');
		    deferred.resolve();
		})
		.fail(function(errorCode) {
                    console.log('VDJ-API ERROR: UserController.createUser - recaptcha error for '
				+ JSON.stringify(user.getSanitizedAttributes())
				+ ' and error code is: ' + errorCode
			       );
		    var error = new Error('Recaptcha response invalid: ' + errorCode);
		    deferred.reject(error);
		});
	}
	// END RECAPTCHA CHECK

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.isDuplicateUsername(user.username)
            .then(function(isDuplicate) {

		// skip for test account
		if (config.useTestAccount && user.username == config.testAccountUsername) {
		    console.log('VDJ-API INFO: UserController.createUser - WARNING - Duplicate username check is being bypassed.');
		    deferred.resolve();
		}

                if (isDuplicate === true) {
                    var error = new Error('duplicate');
                    deferred.reject(error);
                }
                else {
                    console.log(
                        'VDJ-API INFO: UserController.createUser - agave duplicate account check successful for '
                        + JSON.stringify(user.getSanitizedAttributes())
                    );

                    deferred.resolve();
                }
            })
            .fail(function() {
                console.error('VDJ-API ERROR: UserController.createUser - agave duplicate account check failed for ' + JSON.stringify(user.getSanitizedAttributes()));
                var error = new Error('duplicate');
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();
	
	// skip for test account
	if (config.useTestAccount && user.username == config.testAccountUsername) {
	    console.log('VDJ-API INFO: UserController.createUser - WARNING - Agave account creation is being bypassed.');
	    deferred.resolve();
	}

        agaveIO.createUser(user.getCreateUserAttributes())
            .then(function() {
                console.log('VDJ-API INFO: UserController.createUser - agave account creation successful for ' + JSON.stringify(user.getSanitizedAttributes()));
                deferred.resolve();
            })
            .fail(function() {
		var msg = 'VDJ-API ERROR: UserController.createUser - agave account creation failed for ' + JSON.stringify(user.getSanitizedAttributes());
		console.error(msg);
		webhookIO.postToSlack(msg);
                var error = new Error('account');
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.getToken(user)
            .then(function(userToken) {
                console.log('VDJ-API INFO: UserController.createUser - token fetch successful for ' + JSON.stringify(user.getSanitizedAttributes()));
                deferred.resolve(userToken);
            })
            .fail(function() {
                console.error('VDJ-API ERROR: UserController.createUser - token fetch failed for ' + JSON.stringify(user.getSanitizedAttributes()));
                var error = new Error('token');
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function(userToken) {
        var deferred = Q.defer();

        agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token)
            .then(function() {
                console.log('VDJ-API INFO: UserController.createUser - vdj profile successful for ' + JSON.stringify(user.getSanitizedAttributes()));

                deferred.resolve();
            })
            .fail(function() {
                var msg = 'VDJ-API ERROR: UserController.createUser - vdj profile failed for ' + JSON.stringify(user.getSanitizedAttributes());
		console.error(msg);
		webhookIO.postToSlack(msg);
                var error = new Error('profile');
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.createUserVerificationMetadata(user.username)
            .then(function(userVerificationMetadata) {
                console.log('VDJ-API INFO: UserController.createUser - verification metadata successful for ' + JSON.stringify(user.getSanitizedAttributes()));
                deferred.resolve(userVerificationMetadata);
            })
            .fail(function() {
                var msg = 'VDJ-API ERROR: UserController.createUser - verification metadata failed for ' + JSON.stringify(user.getSanitizedAttributes());
		console.error(msg);
		webhookIO.postToSlack(msg);
                var error = new Error('verification');
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function(userVerificationMetadata) {
        emailIO.sendWelcomeEmail(user.email, user.username, userVerificationMetadata.uuid);
        console.log('VDJ-API INFO: UserController.createUser - send email successful for ' + JSON.stringify(user.getSanitizedAttributes()));
    })
    .then(function() {
        console.log('VDJ-API INFO: UserController.createUser - acount creation complete for ' + JSON.stringify(user.getSanitizedAttributes()));
        apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
    })
    .fail(function(error) {
        console.error('VDJ-API ERROR: UserController.createUser - error - user ' + JSON.stringify(user.getSanitizedAttributes()) + ', error ' + error);

	// If one of the last steps fails, try later by putting in queue
        // Insert into appropriate place in queue
        switch (error.message) {

            case 'profile': {
                Q.fcall(function() {
                    taskQueue
                        .create('createUserProfileMetadataTask', user.getSanitizedAttributes())
                        .removeOnComplete(true)
                        .attempts(10)
                        .backoff({
                            delay: 60 * 1000,
                            type: 'fixed',
                        })
                        .save()
                        ;
                })
                ;

                break;
            }

            case 'verification': {
                Q.fcall(function() {
                    taskQueue
                        .create('createUserVerificationMetadataTask', user.getSanitizedAttributes())
                        .removeOnComplete(true)
                        .attempts(10)
                        .backoff({
                            delay: 60 * 1000,
                            type: 'fixed',
                        })
                        .save()
                        ;
                })
                ;

                break;
            }

            default: {
                break;
            }
        }

        apiResponseController.sendError(error.message, 500, response);
    })
    ;
};

// Change user password
// Only for authenticated user, plus have to send original password
UserController.changePassword = function(request, response) {
    var username = request.user.username;
    var password = request.body.password;
    var newPassword = request.body.new_password;

    console.log('VDJ-API INFO: UserController.changePassword - begin for ' + username);

    // 0.  Verify old password
    // 1.  Get user profile
    // 2.  Reset password
    // 3.  Response
    // 3a. Success
    // 3b. Fail
    var auth = {
        username: username,
        password: password,
    };

    agaveIO.getToken(auth) // 0.
        .then(function(/*token*/) {
            console.log('VDJ-API INFO: UserController.changePassword - token verify success for ' + username);

            // current password verified
            return agaveIO.getUserProfile(username); // 1.
        })
        .then(function(profile) {
            console.log('VDJ-API INFO: UserController.changePassword - profile fetch success for ' + username);

            if (profile && profile[0] && profile[0].value && profile[0].value.email) {
                return agaveIO.updateUserPassword({ // 2.
                    'username': username,
                    'email': profile[0].value.email,
                    'password': newPassword,
                });
            }
            else {
                return Q.reject(
                    new Error('UserController.changePassword - error - password change fail for ' + username + '. User profile not found.')
                );
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: UserController.changePassword - change password complete for ' + username);
            apiResponseController.sendSuccess('Password changed successfully.', response); // 3a.
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: UserController.changePassword - error - username ' + username + ', error ' + error);
            apiResponseController.sendError('Invalid authorization', 401, response); // 3b.
        })
        ;
};

// verify the user given the verification code sent by email
UserController.verifyUser = function(request, response) {

    console.log(request);
    var verificationId = request.params.verificationId.trim();

    if (!verificationId || verificationId.length == 0) {
        console.error('VDJ-API ERROR: UserController.verifyUser - error - missing verificationId parameter');
        apiResponseController.sendError('Verification Id required.', 400, response);
    }

    console.log('VDJ-API INFO: UserController.verifyUser - begin for ' + verificationId);

    // First, check to see if this verificationId corresponds to this username
    agaveIO.getMetadata(verificationId)
        .then(function(userVerificationMetadata) {

            console.log('VDJ-API INFO: UserController.verifyUser - getMetadata for ' + verificationId);

	    if (userVerificationMetadata.name != 'userVerification') {
                console.error('VDJ-API ERROR: UserController.verifyUser - error - metadata is not a userVerification item: ' + verificationId);
                return Q.reject(new Error('UserController.verifyUser - error - metadata is not a userVerification item: ' + verificationId));
	    }

            if (userVerificationMetadata && verificationId === userVerificationMetadata.uuid) {
                var username = userVerificationMetadata.value.username;

		if (!username) {
                    console.error('VDJ-API ERROR: UserController.verifyUser - error - metadata missing username: ' + verificationId);
                    return Q.reject(new Error('UserController.verifyUser - error - metadata missing username: ' + verificationId));
		}

                return agaveIO.verifyUser(username, verificationId);
            }
            else {
                return Q.reject(new Error('UserController.verifyUser - error - verification metadata failed comparison for ' + verificationId));
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: UserController.verifyUser - verification complete for ' + verificationId);
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: UserController.verifyUser - error - metadataId ' + verificationId + ', error ' + error);
            apiResponseController.sendError('Invalid verification id: ' + verificationId, 500, response);
        })
        ;
};

UserController.resendVerificationEmail = function(request, response) {

    var username = request.params.username;

    if (!username) {
        console.error('VDJ-API ERROR: UserController.resendVerificationEmail - error - missing username parameter for ' + username);
        apiResponseController.sendError('Username required.', 400, response);
    }

    console.log('VDJ-API INFO: UserController.resendVerificationEmail - begin for ' + username);

    var verificationId = '';

    agaveIO.getUserVerificationMetadata(username)
        .then(function(userVerificationMetadata) {
            console.log('VDJ-API INFO: UserController.resendVerificationEmail - get verification metadata for ' + username);

            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === false) {
                verificationId = userVerificationMetadata[0].uuid;

                return agaveIO.getUserProfile(username);
            }
            else {
                return Q.reject(
                    new Error('Non-existent verification for username: ' + username)
                );
            }
        })
        .then(function(profileMetadata) {
            console.log('VDJ-API INFO: UserController.resendVerificationEmail - get profile for ' + username);

            if (profileMetadata && profileMetadata[0] && profileMetadata[0].value && profileMetadata[0].value.email) {
                return emailIO.sendWelcomeEmail(profileMetadata[0].value.email, username, verificationId);
            }
            else {
                return Q.reject(
                    new Error('UserController.resendVerificationEmail - error - user profile could not be found for ' + username)
                );
            }
        })
        .then(function() {
            console.log('VDJ-API INFO: UserController.resendVerificationEmail - complete for ' + username);
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('VDJ-API ERROR: UserController.resendVerificationEmail - error - username ' + username + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

// TODO: this should be protected by a recaptcha
UserController.createResetPasswordRequest = function(request, response) {

    var username = request.body.username;

    console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - begin for user ' + username);

    var userProfile;

    // 1.  Get confirm username, email address from user profile
    // 2.  Generate random key by posting to metadata
    // 3.  Send email
    // 4a. Send response success
    // 4b. Send response error
    agaveIO.getUserProfile(username) // 1.
        .then(function(profile) {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - getUserProfile for user ' + username);

            if (profile[0]) {
                userProfile = profile[0];
                return agaveIO.createPasswordResetMetadata(username); // 2.
            }
            else {
                return Q.reject(new Error('PasswordResetController.createResetPasswordRequest - error - username unknown for ' + username));
            }
        })
        .then(function(passwordReset) {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - createPasswordResetMetadata for user ' + username);

            return emailIO.sendPasswordResetEmail(userProfile.value.email, passwordReset.uuid); // 3.
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.createResetPasswordRequest - sendPasswordResetEmail for user ' + username);

            apiResponseController.sendSuccess('Password reset email sent.', response); // 4a.
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: PasswordResetController.createResetPasswordRequest - error - username ' + username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response); // 4b.
        })
        ;
};

UserController.processResetPasswordRequest = function(request, response) {

    var username = request.body.username;
    var uuid = request.body.reset_code;
    var newPassword = request.body.new_password;

    console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - begin for user ' + username);

    var passwordReset;

    // 1.  Get password reset metadata for given uuid
    // 2.  Verify password reset uuid and matching username
    // 3.  Get user profile
    // 4.  Update user with new password
    // 5.  Delete password reset metadata
    // 5a. Report error if delete fails
    // 6.  Response
    // 6a. Success
    // 6b. Error
    agaveIO.getPasswordResetMetadata(uuid) // 1.
        .then(function(passwordResetMetadata) {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - getPasswordResetMetadata for user ' + username);

	    //console.log(passwordResetMetadata);
	    //console.log(passwordResetMetadata[0]);
	    if (passwordResetMetadata.length == 0)
		return Q.reject(new Error('Invalid metadata id: ' + uuid));

            if (username === passwordResetMetadata[0].value.username) { // 2.
                passwordReset = passwordResetMetadata[0];
                return agaveIO.getUserProfile(username); // 3.
            }
            else {
                return Q.reject(new Error('PasswordResetController.processResetPasswordRequest - error - reset metadata uuid does not match.'));
            }
        })
        .then(function(profile) {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - getUserProfile for user ' + username);

            return agaveIO.updateUserPassword({
                'username': username,
                'email': profile[0].value.email,
                'password': newPassword
            }); // 4.
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - updateUserPassword for user ' + username);

            /*
                while metadata is deleted, service returns 500 error;
                don't let this short-circuit the process
            */
            agaveIO.deleteMetadata(ServiceAccount.accessToken(), passwordReset.uuid) // 5.
                .fail(function(error) { // 5a.
                    console.error(error.message, error);
                });
        })
        .then(function() {
            console.log('VDJ-API INFO: PasswordResetController.processResetPasswordRequest - deleteMetadata for user ' + username);

            apiResponseController.sendSuccess('Password reset successfully.', response); // 6a.
        })
        .fail(function(error) {
            var msg = 'VDJ-API ERROR: PasswordResetController.processResetPasswordRequest - error - username ' + username + ', error ' + error;
	    console.error(msg);
	    webhookIO.postToSlack(msg);
            apiResponseController.sendError(error.message, 500, response); // 6b.
        })
        ;
};
