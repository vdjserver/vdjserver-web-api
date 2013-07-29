
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

    if (request.body.username &&
        request.body.password &&
        request.body.email) 
    {

        tokenController.provideVdjToken(function(error, tokenAuth) {
            if (!error) {
            
                var internalUser = new InternalUser.schema();
                 
                internalUser.username = request.body.username;
                internalUser.password = request.body.password;
                internalUser.email    = request.body.email;
                

                agaveIO.createInternalUser(internalUser, function(error, internalUser) {

                    if (!error) {
                        internalUser.password = "";
                        apiResponseController.sendSuccess(internalUser, response);
                    }
                    else {
                        apiResponseController.sendError("Unable to create a new Agave account for '" + request.body.username + "'.", response);
                    }

                });
            }
            else {
                apiResponseController.sendError("There was an error creating your new account. Please try again.", response);
            }
        });

    }
    else {
        apiResponseController.sendError("In order to create a new account, you must POST the following parameters JSON encoded: username, password, and email.", response);
    }
    
};
