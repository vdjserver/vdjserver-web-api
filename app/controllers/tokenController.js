
// Processing
var agaveIO = require('../vendor/agave/agaveIO');

// Models
var ApiResponse      = require('../models/apiResponse');
var InternalUserAuth = require('../models/internalUserAuth');


var TokenController = {};
module.exports = TokenController;


// Retrieves an internal user token from Agave IO and returns it to the client
TokenController.retrieveInternalUserToken = function(request, response) {
    
        console.log("app received request for " + request.user.username);

    agaveIO.getInternalUserToken(request.user.username, request.user.password, function(error, internalUserAuth) {
            
        var apiResponse = new ApiResponse.schema();

        if (!error) {
            apiResponse.setSuccess();
            apiResponse.result = internalUserAuth;
        }
        else {
            apiResponse.setError();
            apiResponse.message = "Unable to fetch Agave token for '" + request.user.username + "'";
        }
        
        response.send(apiResponse);
    });
};
