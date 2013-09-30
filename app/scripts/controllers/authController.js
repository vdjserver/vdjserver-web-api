
// Models
var InternalUser   = require('../models/internalUser');

// Controllers
var TokenController = require('./tokenController');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var AuthController = {};
module.exports     = AuthController;


// Validates username and password against |internalUsers| objects in mongoDB. Returns true/false depending on validity.
AuthController.validateCredentials = function(username, password, callback) {

    InternalUser.findOne({username: username}, function(error, account) {

        if (!error && account !== null) {

            callback(account.validatePassword(password));
        }
        else {
            callback(false);
        }

    });
};

// Validates username and password against the agave auth service. Returns true/false depending on validity.
AuthController.validateToken = function(username, token, callback) {

    agaveIO.validateInternalUserToken(token, function(error, refreshedTokenAuth) {

        if (!error && refreshedTokenAuth.internalUsername === username) {
            callback(true);
        }
        else {
            callback(false);
        }

    });

};
