var AGS = require('./agave-settings');
var AG  = {};
module.exports = AG;

var token = '';

AG.postOptionsAuth = function(path) {
    return {
        hostname:   AGS.agaveAuthHost,
        path:       path,
        method:     'POST',
        auth:       AGS.agaveUser + ':' + AGS.agavePass,
        rejectUnauthorized: false
    }
};

AG.postOptionsToken = function(path, token) {
    return {
        hostname:   AGS.agaveHost,
        path:       path,
        method:     'POST',
        auth:       AGS.agaveUser + ':' + token,
        rejectUnauthorized: false
    }
};

AG.getToken = function(callback) {
    var request = require('https').request(AG.postOptionsAuth(AGS.agaveAuth), function(response) {

        var output = '';

        response.on('data', function(chunk) {
            output += chunk;
        });

        response.on('end', function() {
            var obj = JSON.parse(output);
            token   = obj.result.token;

            console.log("Status: " + obj.status);
            console.log("Token: "  + obj.result.token);

            if (callback) {
                callback(token);
            }
        });
    });

    request.on('error', function(error) {
        console.log("Error: " + postOptions + "\n" + error.message);
        console.log( error.stack );
        return false;
    });

    request.end();
};

AG.createInternalUser = function(newAccount, callback) {

    console.log('AG.createInternalUser called with ' + JSON.stringify(newAccount));

    AG.getToken(function(token) {

        console.log("Got token with " + token);

        // The API currently returns an error if city is blank...this is probably a bug.
        var newUserJson = {
            "username":     newAccount.username,
            "email":        newAccount.email,
            "firstName":    newAccount.firstname,
            "lastName":     newAccount.lastname,
            "country":      newAccount.country,
            "city":         "testCity"
        };

/*
        var unshared = {
            "username":     "gibberish",
            "email":        "gibberish@example.com",
            "firstName":    "Unshared",
            "lastName":     "User",
            "position":     "Consumer",
            "institution":  "Example University",
            "phone":        "512-555-5555",
            "fax":          "512-555-5556",
            "researchArea": "Software Engineering",
            "department":   "QA",
            "city":         "Anywhere",
            "state":        "TX",
            "country":      "USA",
            "fundingAgencies": [
                "Dad",
                "Mom"
            ],
            "gender":       "MALE"
        };
*/
        var postOptions = AG.postOptionsToken(AGS.agaveRegInternal + '/profiles'
                                                                   + '/'
                                                                   + AGS.agaveUser
                                                                   + '/users'
                                                                   + '/',
                                              token);

        console.log("postOptions: " + JSON.stringify(postOptions));

        var request = require('https').request(postOptions, function(response) {

            var output = '';

            response.on('data', function(chunk) {
                output += chunk;
            });

            response.on('end', function() {
                var obj = JSON.parse(output);
                console.log("Obj is: "   + JSON.stringify(obj));
                console.log("Status: "   + obj.status);
                console.log("Username: " + obj.result.username);

                callback("", obj.status);
                return obj;
            });

        });

        request.on('error', function(error) {
            console.log("Error w/createInternalUser: " + postOptions + "\n" + error.message);
            console.log( error.stack );

            callback(error, "");

            return false;
        });

        //write the JSON of the internal user
        request.write(JSON.stringify(newUserJson));
        request.end();

        console.log("endOf createInternalUser");
    });

};

AG.uploadFile = function(newFile, callback) {

    AG.getToken(function(token) {

        console.log("Got token with " + token);

/*
        var newFileJson = {
            "":     newAccount.username,
        };
*/
        var postOptions = AG.postOptionsToken(AGS.agaveRegInternal + '/files'
                                                                   + '/media',
                          token);
        console.log("postOptions: " + JSON.stringify(postOptions));

        var request = require('https').request(postOptions, function(response) {

            var output = '';

            response.on('data', function(chunk) {
                output += chunk;
            });

            response.on('end', function() {
                var obj = JSON.parse(output);
                console.log("Obj is: "   + JSON.stringify(obj));
                console.log("Status: "   + obj.status);
                console.log("Username: " + obj.result.username);

                callback("", obj.status);
                return obj;
            });

        });

        request.on('error', function(error) {
            console.log("Error message: " + postOptions + "\n" + error.message);
            console.log( error.stack );

            callback(error, "");

            return false;
        });

        //write the JSON of the internal user
        request.write(JSON.stringify(newFileJson));
        request.end();

        console.log("endOf uploadFile");
    });

};
