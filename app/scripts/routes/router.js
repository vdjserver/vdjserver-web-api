
// App
var express = require('express');

// Controllers
var tokenController       = require('../controllers/tokenController');
var apiResponseController = require('../controllers/apiResponseController');

module.exports = function(app) {

    // noValidation
    var noValidation = express.basicAuth(function(userKey, userSecret, next) {
        next(null, userKey, userSecret);
    });



    // Request an Agave internalUsername token
    app.post('/token', noValidation, tokenController.getToken);

    // Refresh an Agave internalUsername token
    app.put('/token', noValidation, tokenController.refreshToken);

    // Delete an Agave internalUsername token
    //app.delete('/token/*', noValidation, tokenController.deleteInternalUserToken);



    // Errors
    app.get('*', apiResponseController.send404);
    app.post('*', apiResponseController.send404);
    app.put('*', apiResponseController.send404);
    app.delete('*', apiResponseController.send404);
};
