
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

                        InternalUserController.saveNewInternalUser(agaveSavedInternalUser, function(saveError) {

                            console.log("internal user save return");

                            if (!saveError) {

                                console.log("internal user final api output is: " + agaveSavedInternalUser.apiOutput());
                                apiResponseController.sendSuccess(agaveSavedInternalUser.apiOutput(), response);
                            }
                            else {
                                console.log("internal user fail");
                                console.log("warning: error edge case");
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

InternalUserController.saveNewInternalUser = function(internalUser, callback) {

    // Salt password
    internalUser.saltAndHash();

    console.log("starting to save internal user. obj looks like: " + JSON.stringify(internalUser));

    internalUser.save(function(error, data) {

        console.log("inside save function for internal user");

        if (error) {

            console.log("mayday mayday, error!");

            callback("save-error");

        }
        else if (!error) {

            console.log("no internal user save error. specific error is: " + error);

            callback();

        }
    });

};
