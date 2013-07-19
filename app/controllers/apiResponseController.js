
// Models
var ApiResponse = require('../models/apiResponse');


var ApiResponseController = {};
module.exports = ApiResponseController;


// Sends a 200 response with a success message to the client
ApiResponseController.sendSuccess = function(successResultMessage, response) {
    
    var apiResponse = new ApiResponse.schema();
    apiResponse.setSuccess();
    apiResponse.result = successResultMessage;

    response.send(apiResponse);
};


// Sends a 200 response with an error message to the client
ApiResponseController.sendError = function(errorMessage, response) {

    var apiResponse = new ApiResponse.schema();
    apiResponse.setError();
    apiResponse.message = errorMessage;

    response.send(apiResponse);
};

// Sends a 404 response with an error message to the client
ApiResponseController.send404 = function(request, response) {

    var apiResponse = new ApiResponse.schema();

    apiResponse.setError();
    apiResponse.message = "The endpoint you are trying to reach either doesn't exist, or doesn't support the action that you're trying."; 
    
    response.send(404, apiResponse);

};
