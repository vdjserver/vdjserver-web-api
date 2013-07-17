// App
var express = require ('express');

// Processing
var Agave = require('../server/agave');

// Models
var InternalUserAuth = require('../models/internalUserAuth');
var ApiResponse      = require('../models/apiResponse');


module.exports = function(app) {


    // Verify user credentials via Agave
    var auth = express.basicAuth(function(username, password, callback) {

        //lookup auth via Agave
        var result = {"username": username, "password": password};

        callback(null /* error */, result);
    });



    // Request an Agave internalUsername token
    app.post('/token', auth, function(request, response) {

        Agave.getInternalUserToken(request.user.username, request.user.password, function(error, internalUserAuth) {
                
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

    });



    // Creating new accounts
    app.post('/signup', function(request, response) {

        var newAccount = new accountCollection();

        newAccount.firstname = request.param('firstname');
        newAccount.lastname  = request.param('lastname');
        newAccount.email     = request.param('email');
        newAccount.username  = request.param('username');
        newAccount.password  = request.param('password');
        newAccount.country   = request.param('country');

        AM.addNewAccount(newAccount, function(error) {

            if (error) {
                // Bad Request
                response.send(error, 400);
            }
            else {
                // Ok
                response.send('ok', 200);
            }

        });

    });



    app.get('*', function(request, response) {

        response.render('404',
                        { title: 'Page Not Found'}
        );

    });

};
