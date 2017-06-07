
'use strict';

// Models
var ApiResponse = require('../models/apiResponse');

var ApiResponseController = {};
module.exports = ApiResponseController;

// Sends a 200 response with a success message to the client
ApiResponseController.sendSuccess = function(successResultMessage, response) {

    var apiResponse = new ApiResponse();
    apiResponse.setSuccess();
    apiResponse.result = successResultMessage;

    if (response) {
        response.status(200).send(apiResponse);
    }
};

// Sends a response with an error message to the client
ApiResponseController.sendError = function(errorMessage, errorCode, response) {

    var apiResponse = new ApiResponse();
    apiResponse.setError();
    apiResponse.message = errorMessage;

    if (response) {
        response.status(errorCode).send(apiResponse);
    }
};

// Sends a 404 response with an error message to the client
ApiResponseController.send404 = function(request, response) {

    var apiResponse = new ApiResponse();

    apiResponse.setError();
    apiResponse.message = 'The endpoint you are trying to reach either doesn\'t exist,'
                          + ' or doesn\'t support the action that you\'re trying.';

    console.error('Error ApiResponseController.send404: ' + JSON.stringify(request.route));

    if (response) {
        response.status(404).send(apiResponse);
    }
};

// Sends a 401 response with an error message to the client
ApiResponseController.send401 = function(request, response) {

    var apiResponse = new ApiResponse();

    apiResponse.setError();
    apiResponse.message = 'Unauthorized';

    console.error('Error ApiResponseController.send401: ' + JSON.stringify(request.route));

    if (response) {
        response.status(401).send(apiResponse);
    }
};

ApiResponseController.confirmUpStatus = function(request, response) {
    ApiResponseController.sendSuccess('', response);
};
