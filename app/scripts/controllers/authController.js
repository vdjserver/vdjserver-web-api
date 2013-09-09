
// Models
var AppCredentials = require('../models/appCredentials');
var InternalUser   = require('../models/internalUser');

var AuthController = {};
module.exports     = AuthController;


// Validates an |appCredentials| object against |internalUsers| objects in mongoDB. Returns true/false depending on validity.
AuthController.validateCredentials = function(appCredentials, callback) {

    InternalUser.findOne({username: appCredentials.username}, function(error, account) {

        if (!error && account !== null) {

            callback(account.validatePassword(appCredentials.password));
        }
        else {
            callback(false);
        }

    });
};
