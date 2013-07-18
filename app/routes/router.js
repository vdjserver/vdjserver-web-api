// App
var express = require ('express');

// Processing
var Agave = require('../server/agave');

// Models
var ApiResponse      = require('../models/apiResponse');
var InternalUserAuth = require('../models/internalUserAuth');
var InternalUser     = require('../models/internalUser');



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
    app.post('/user', auth, function(request, response) {

        var internalUser = new InternalUser.schema();

        
        internalUser.password = "abcdefg";

        console.log("internalUser password is: " + internalUser.password);

        internalUser.saltAndHash();

        console.log("after hash, pswd is: " + internalUser.password);


        /*
        var newAccount = new accountCollection();

        newAccount.username  = request.param('username');
        newAccount.password  = request.param('password');
        newAccount.email     = request.param('email');

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

        */
    });



    app.get('*', function(request, response) {

        response.render('404',
                        { title: 'Page Not Found'}
        );

    });

};
