
// Models
var ApiResponse = require('../models/apiResponse');


var ErrorController = {};
module.exports = ErrorController;


// Sends a 404 response with an error message to the client
ErrorController.send404 = function(request, response) {

    var apiResponse = new ApiResponse.schema();

    apiResponse.setError();
    apiResponse.message = "The endpoint you are trying to reach either doesn't exist, or doesn't support the action that you're trying."; 
    
    response.send(apiResponse, 404);

}
