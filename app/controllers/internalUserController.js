
// Controllers
var tokenController       = require('./tokenController');
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Models
var InternalUser = require('../models/internalUser');


var InternalUserController = {};
module.exports = InternalUserController;


// Creates an internal user account via Agave IO and returns it to the client
InternalUserController.createInternalUser = function(request, response) {

    console.log("hit for internalUserController.createInternalUser. Attr are: " + JSON.stringify(request.body));

    var genericError = "Unable to create a new Agave account for '" + request.body.internalUsername + "'.";

    if (request.body.internalUsername &&
        request.body.password &&
        request.body.email)
    {

        tokenController.provideVdjToken(function(error, tokenAuth) {
            if (!error) {

                var internalUser = new InternalUser();

                internalUser.username = request.body.internalUsername;
                internalUser.password = request.body.password;
                internalUser.email    = request.body.email;


                console.log("internalUserController.createInternalUser - about to start agaveIO");
                agaveIO.createInternalUser(internalUser, function(agaveError, agaveSavedInternalUser) {

                    if (!agaveError) {

                        // Salt password
                        internalUser.saltAndHash();

                        internalUser.save(function(error, data) {

                            if (!error) {
                                apiResponseController.sendSuccess(agaveSavedInternalUser, response);
                            }
                            else {
                                apiResponseController.sendError(genericError, response);
                            }

                        });

                    }
                    else {
                        apiResponseController.sendError(genericError, response);
                    }

                });
            }
            else {
                apiResponseController.sendError("There was an error creating your new account. Please try again.", response);
            }
        });

    }
    else {
        apiResponseController.sendError("In order to create a new account, you must POST the following parameters JSON encoded: internalUsername, password, and email.", response);
    }

};

InternalUserController.updateUserProfile = function(request, response) {

    var appCredentials = request.user;

    InternalUser.findOne({ 'username': appCredentials.username}, function(error, internalUser) {

        if (!error) {
            internalUser.children.firstName = request.body.firstName;
            internalUser.children.lastName  = request.body.lastName;
            internalUser.children.city      = request.body.city;
            internalUser.children.state     = request.body.state;

            internalUser.save(function (saveError, savedInternalUser) {
                apiResponseController.sendSuccess(savedInternalUser, response);
            });

        }
        else {
            apiResponseController.sendError("Unable to find profile information for user '" + appCredentials.username + "'.", response);
        }
    });

};
