
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
var CommunityData = require('./../models/communityData');

// Processing
var agaveIO = require('./../vendor/agaveIO');

var CommunityDataController = {};
module.exports = CommunityDataController;

// Creates a project and all initial directories
CommunityDataController.getCommunityData = function(request, response) {

    var token = request.user.password;

    agaveIO.validateToken(token)
        .then(function() {
            return agaveIO.getCommunityDataMetadata();
        })
        .then(function(communityDataMetadata) {
            var communityData = new CommunityData();

            communityDataMetadata = communityData.processLinksForCommunityDataMetadata(communityDataMetadata);

            return communityDataMetadata;
        })
        .then(function(communityDataMetadata) {
            // End user should only see standard Agave meta output
            apiResponseController.sendSuccess(communityDataMetadata, response);
        })
        .fail(function(error) {
            console.error('Error CommunityDataController.getCommunityData: ' + error);
            apiResponseController.sendError(error.message, 400, response);
        })
        ;
};
