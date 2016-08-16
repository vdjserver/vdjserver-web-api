
'use strict';

var config = require('../config/config');

// App
var app = require('../app');

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var User = require('../models/user');

// Processing
var agaveIO = require('../vendor/agaveIO');
var emailIO = require('../vendor/emailIO');

// Node Libraries
var Q = require('q');
var kue = require('kue');
var taskQueue = kue.createQueue({
    redis: app.redisConfig,
});
var Recaptcha = require('recaptcha-v2').Recaptcha;

var UserController = {};
module.exports = UserController;

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

UserController.createUser = function(request, response) {

    var user = new User({
        username:   request.body.username,
        password:   request.body.password,
        email:      request.body.email,
        firstName:  request.body.firstName,
        lastName:   request.body.lastName,
        city:       request.body.city,
        state:      request.body.state,
        country:    request.body.country,
        affiliation: request.body.affiliation,
    });

    if (!user.username) {
        console.error('UserController.createUser - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!user.password) {
        console.error('UserController.createUser - error - missing password parameter');
        apiResponseController.sendError('Password required.', 400, response);
        return;
    }

    if (!user.email) {
        console.error('UserController.createUser - error - missing email parameter');
        apiResponseController.sendError('Email required.', 400, response);
        return;
    }

    /*
    if (!user.firstName) {
        console.error('Error UserController.createUser: missing firstName parameter');
        apiResponseController.sendError('First Name required.', 400, response);
        return;
    }

    if (!user.lastName) {
        console.error('Error UserController.createUser: missing lastName parameter');
        apiResponseController.sendError('Last Name required.', 400, response);
        return;
    }

    if (!user.city) {
        console.error('Error UserController.createUser: missing city parameter');
        apiResponseController.sendError('City required.', 400, response);
        return;
    }

    if (!user.state) {
        console.error('Error UserController.createUser: missing state parameter');
        apiResponseController.sendError('State required.', 400, response);
        return;
    }

    if (!user.country) {
        console.error('Error UserController.createUser: missing country parameter');
        apiResponseController.sendError('Country required.', 400, response);
        return;
    }

    if (!user.affiliation) {
        console.error('Error UserController.createUser: missing affiliation parameter');
        apiResponseController.sendError('Affiliation required.', 400, response);
        return;
    }
    */

    //console.log(response);
    // BEGIN RECAPTCHA CHECK
    //console.log(config.allowRecaptchaSkip);
    //console.log(request.body['g-recaptcha-response']);
/*
    if (config.allowRecaptchaSkip && (request.body['g-recaptcha-response'] == 'skip_recaptcha')) {
        console.log('UserController.createUser - WARNING - Recaptcha check is being skipped.');
    } else {
        var recaptchaData = {
            remoteip:  request.connection.remoteAddress,
            response: request.body['g-recaptcha-response'],
            secret: config.recaptchaSecret,
        };

	verifyRecaptcha(recaptchaData)
	.then(function() {
	    console.log('passed recaptcha');
	})
	.fail(function() {
	    console.log('failed recaptcha');
	})

        var recaptcha = new Recaptcha(
            config.recaptchaPublic,
            config.recaptchaSecret,
            recaptchaData
        );

	var that = response;
        recaptcha.verify(function(success, errorCode) {
            if (!success) {
                console.log('UserController.createUser - recaptcha error for '
                    + JSON.stringify(user.getSanitizedAttributes())
                    + ' and error code is: ' + errorCode
                );

		console.log(response);
		//console.log(JSON.stringify(that));
                apiResponseController.sendError('Recaptcha response invalid: ' + errorCode, 400, response);
                return;
            }
        });
    }
*/
    // END RECAPTCHA CHECK

    console.log('UserController.createUser - event - begin for ' + JSON.stringify(user.getSanitizedAttributes()));

    Q.fcall(function() {
        var deferred = Q.defer();

	// BEGIN RECAPTCHA CHECK
	if (config.allowRecaptchaSkip && (request.body['g-recaptcha-response'] == 'skip_recaptcha')) {
            console.log('UserController.createUser - WARNING - Recaptcha check is being skipped.');
	    deferred.resolve();
	} else {
            var recaptchaData = {
		remoteip:  request.connection.remoteAddress,
		response: request.body['g-recaptcha-response'],
		secret: config.recaptchaSecret,
            };

	    verifyRecaptcha(recaptchaData)
		.then(function() {
		    console.log('passed recaptcha');
		    deferred.resolve();
		})
		.fail(function(errorCode) {
                    console.log('UserController.createUser - recaptcha error for '
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

                if (isDuplicate === true) {
                    var error = new Error(1);
                    deferred.reject(error);
                }
                else {
                    console.log(
                        'UserController.createUser - event - agave duplicate account check successful for '
                        + JSON.stringify(user.getSanitizedAttributes())
                    );

                    deferred.resolve();
                }
            })
            .fail(function() {
                var error = new Error(1);
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.createUser(user.getCreateUserAttributes())
            .then(function() {
                console.log('UserController.createUser - event - agave account successful for ' + JSON.stringify(user.getSanitizedAttributes()));
                deferred.resolve();
            })
            .fail(function() {
                var error = new Error(2);
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.getToken(user)
            .then(function(userToken) {
                console.log('UserController.createUser - event - token fetch successful for ' + JSON.stringify(user.getSanitizedAttributes()));
                deferred.resolve(userToken);
            })
            .fail(function() {
                var error = new Error(3);
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function(userToken) {
        var deferred = Q.defer();

        agaveIO.createUserProfile(user.getSanitizedAttributes(), userToken.access_token)
            .then(function() {
                console.log('UserController.createUser - event - vdj profile successful for ' + JSON.stringify(user.getSanitizedAttributes()));

                deferred.resolve();
            })
            .fail(function() {
                var error = new Error(4);
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function() {
        var deferred = Q.defer();

        agaveIO.createUserVerificationMetadata(user.username)
            .then(function(userVerificationMetadata) {
                console.log(
                    'UserController.createUser - event - verification metadata successful for ' + JSON.stringify(user.getSanitizedAttributes())
                );
                deferred.resolve(userVerificationMetadata);
            })
            .fail(function() {
                var error = new Error(5);
                deferred.reject(error);
            })
            ;

        return deferred.promise;
    })
    .then(function(userVerificationMetadata) {
        emailIO.sendWelcomeEmail(user.email, user.username, userVerificationMetadata.uuid);
        console.log('UserController.createUser - event - send email successful for ' + JSON.stringify(user.getSanitizedAttributes()));
    })
    .then(function() {
        console.log('UserController.createUser - event - acount creation complete for ' + JSON.stringify(user.getSanitizedAttributes()));
        apiResponseController.sendSuccess(user.getSanitizedAttributes(), response);
    })
    .fail(function(error) {
        console.error('UserController.createUser - error - user ' + JSON.stringify(user.getSanitizedAttributes()) + ', error ' + error);

        // Insert into appropriate place in queue
        switch (error.message) {

            case '4': {
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

            case '5': {
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

UserController.changePassword = function(request, response) {
    var username = request.user.username;
    var password = request.body.password;
    var newPassword = request.body.newPassword;

    if (!username) {
        console.error('UserController.changePassword - error - missing username parameter');
        apiResponseController.sendError('Username required.', 400, response);
        return;
    }

    if (!password) {
        console.error('UserController.changePassword - error - missing password parameter');
        apiResponseController.sendError('Password required.', 400, response);
        return;
    }

    if (!newPassword) {
        console.error('UserController.changePassword - error - missing newPassword parameter');
        apiResponseController.sendError('New Password required.', 400, response);
        return;
    }

    console.log('UserController.changePassword - event - begin for ' + username);

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
            console.log('UserController.changePassword - event - token verify success for ' + username);

            // current password verified
            return agaveIO.getUserProfile(username); // 1.
        })
        .then(function(profile) {
            console.log('UserController.changePassword - event - profile fetch success for ' + username);

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
            console.log('UserController.changePassword - event - change password complete for ' + username);
            apiResponseController.sendSuccess('Password changed successfully.', response); // 3a.
        })
        .fail(function(error) {
            console.error('UserController.changePassword - error - username ' + username + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response); // 3b.
        })
        ;
};

UserController.verifyUser = function(request, response) {

    var verificationId = request.params.verificationId;

    if (!verificationId) {
        console.error('UserController.verifyUser - error - missing verificationId parameter');
        apiResponseController.sendError('Verification Id required.', 400, response);
    }

    console.log('UserController.verifyUser - event - begin for ' + verificationId);

    // First, check to see if this verificationId corresponds to this username
    agaveIO.getMetadata(verificationId)
        .then(function(userVerificationMetadata) {

            console.log('UserController.verifyUser - event - getMetadata for ' + verificationId);

            if (userVerificationMetadata && verificationId === userVerificationMetadata.uuid) {
                var username = userVerificationMetadata.value.username;
                return agaveIO.verifyUser(username, verificationId);
            }
            else {
                return Q.reject(new Error('UserController.verifyUser - error - verification metadata failed comparison for ' + verificationId));
            }
        })
        .then(function() {
            console.log('UserController.verifyUser - event - verification complete for ' + verificationId);
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('UserController.verifyUser - error - metadataId ' + verificationId + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};

UserController.resendVerificationEmail = function(request, response) {

    var username = request.params.username;

    if (!username) {
        console.error('UserController.resendVerificationEmail - error - missing username parameter for ' + username);
        apiResponseController.sendError('Username required.', 400, response);
    }

    console.log('UserController.resendVerificationEmail - event - begin for ' + username);

    var verificationId = '';

    agaveIO.getUserVerificationMetadata(username)
        .then(function(userVerificationMetadata) {
            console.log('UserController.resendVerificationEmail - event - get verification metadata for ' + username);

            if (userVerificationMetadata && userVerificationMetadata[0] && userVerificationMetadata[0].value.isVerified === false) {
                verificationId = userVerificationMetadata[0].uuid;

                return agaveIO.getUserProfile(username);
            }
            else {
                return Q.reject(
                    new Error('UserController.resendVerificationEmail - error - verification metadata failed comparison for ' + username)
                );
            }
        })
        .then(function(profileMetadata) {
            console.log('UserController.resendVerificationEmail - event - get profile for ' + username);

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
            console.log('UserController.resendVerificationEmail - event - complete for ' + username);
            apiResponseController.sendSuccess('', response);
        })
        .fail(function(error) {
            console.error('UserController.resendVerificationEmail - error - username ' + username + ', error ' + error);
            apiResponseController.sendError(error.message, 500, response);
        })
        ;
};
