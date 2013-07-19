
// Controllers
var apiResponseController = require('./apiResponseController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');


var TokenController = {};
module.exports = TokenController;


// Retrieves an internal user token from Agave IO and returns it to the client
TokenController.getInternalUserToken = function(request, response) {

    var internalUserAuth = request.user;

    agaveIO.getInternalUserToken(internalUserAuth, function(error, internalUserAuth) {

        if (!error) {
            apiResponseController.sendSuccess(internalUserAuth, response);
        }
        else {
            apiResponseController.sendError("Unable to fetch Agave token for '" + request.user.username + "'", response);
        }

    });

};
