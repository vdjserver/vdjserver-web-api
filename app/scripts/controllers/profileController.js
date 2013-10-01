
// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var InternalUser = require('../models/internalUser');


var ProfileController = {};
module.exports = ProfileController;


ProfileController.getUserProfile = function(request, response) {

    InternalUser.findOne({ 'username': request.auth.username}, function(error, internalUser) {

        if (!error) {
            apiResponseController.sendSuccess(internalUser.profile[0], response);
        }
        else {
            apiResponseController.sendError("Unable to find profile information for user '" + request.auth.username + "'.", response);
        }
    });

};

ProfileController.updateUserProfile = function(request, response) {

    InternalUser.findOne({ 'username': request.auth.username}, function(error, internalUser) {

        if (!error) {
            internalUser.profile[0].firstName = request.body.firstName;
            internalUser.profile[0].lastName  = request.body.lastName;
            internalUser.profile[0].city      = request.body.city;
            internalUser.profile[0].state     = request.body.state;
            internalUser.profile[0].email     = request.body.email;


            internalUser.save(function (saveError, savedInternalUser) {
                apiResponseController.sendSuccess(savedInternalUser.profile[0], response);
            });

        }
        else {
            apiResponseController.sendError("Unable to find profile information for user '" + request.auth.username + "'.", response);
        }
    });

};
