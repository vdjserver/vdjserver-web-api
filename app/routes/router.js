
// App
var express = require ('express');

// Controllers
var tokenController = require('../controllers/tokenController');
var errorController = require('../controllers/errorController');


module.exports = function(app) {


    // Verify user credentials via Agave
    var auth = express.basicAuth(function(username, password, callback) {

        console.log("app basic auth. username is: " + username);

        // TODO add lookup auth via storage (Agave?)
        
        var result = {"username": username, "password": password};

        callback(null /* error */, result);
    });


    // Request an Agave internalUsername token
    app.post('/token', auth, tokenController.retrieveInternalUserToken);


    // Creating new accounts
    app.post('/user', auth);


    // Errors
    app.get('*',    errorController.send404);
    app.post('*',   errorController.send404);
    app.put('*',    errorController.send404);
    app.delete('*', errorController.send404);



    // TEMP: misc. code that will help with creating a new account
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
};
