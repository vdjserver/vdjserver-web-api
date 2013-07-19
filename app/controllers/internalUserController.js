
// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Models
var InternalUser = require('../models/internalUser');


var InternalUserController = {};
module.exports = InternalUserController;


// Creates an internal user account via Agave IO and returns it to the client
InternalUserController.createInternalUser = function(request, response) {

    console.log("createInternalUser ok");

    console.log("request.body is: " + JSON.stringify(request.body));

    if (request.body.username &&
        request.body.password &&
        request.body.email) 
    {
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
                apiResponseController.sendError("Unable to create a new Agave account for '" + internalUser.username + "'.");
            }

        });
    }
    else {
        apiResponseController.sendError("In order to create a new account, you must POST the following parameters JSON encoded: username, password, and email.", response);
    }
    
};
