
'use strict';

// Controllers
var apiResponseController = require('./apiResponseController');

// Models
//var Project = require('../models/project');
var ServiceAccount = require('../models/serviceAccount');

// Processing
var agaveIO = require('../vendor/agave/agaveIO');

var ProjectController = {};
module.exports = ProjectController;


ProjectController.tokenExchange = function(request, callback) {

    // 1.) validate token
    agaveIO.getToken(request.auth, function(error, newUserToken) {

        if (error) {
            console.log("top level error");
            callback('error');
        }
        else {

// NOTE: MAKE SURE THIS SECTION WORKS
/*
            // validate token - if not valid, then callback error
            if (request.auth.password !== newUserToken.access_token) {
                console.log("token NOT match. orig is: " + JSON.stringify(request.auth) + ", but new is: " + JSON.stringify(newUserToken));
            }
            else if (request.auth.password === newUserToken.access_token) {
                console.log("token match!");

*/
                // Prep for VDJAuth token fetch
                var serviceAccount = new ServiceAccount();

                // 2.) get VDJAuth token
                agaveIO.getToken(serviceAccount, function(error, vdjauthToken) {

                    if (error) {
                        callback('error');
                    }
                    else {
                        // got token!
                        serviceAccount.setToken(vdjauthToken);

                        // callback
                        callback('', serviceAccount);
                    }
                });
//            }

            console.log("else if fail. orig is: " + JSON.stringify(request.auth) + ", but new is: " + JSON.stringify(newUserToken));
        }
    });
};

ProjectController.createProject = function(request, response) {

    console.log("createProject request body is: " + JSON.stringify(request.body));
    
    // Check that all necessary fields are present
    if (!request.body.projectName) {
        apiResponseController.sendError('Project name is required.', response);
        return;
    }

    // 1.) token exchange
    ProjectController.tokenExchange(request, function(error, serviceAccount) {

        console.log("tokenExchange return");
        if (error || serviceAccount.accessToken.length === 0) {
            apiResponseController.sendError('Unable to create project due to invalid authentication credentials.', response);
        }
        else {
            // ok, now we have the vdjauth token. let's use it to make a project
            console.log("tokenExchange success. accessToken is: " + JSON.stringify(serviceAccount));
    
            // 2.) create project
        }
    });

};

ProjectController.deleteProject = function(request, response) {
    // 1.) token exchange

    // 2.) delete project
};

ProjectController.addUser = function(request, response) {
    // 1.) token exchange

    // 2.) add user to project
};

ProjectController.deleteUser = function(request, response) {
    // 1.) token exchange

    // 2.) remove user from project
};

ProjectController.modifyUser = function(request, response) {
    // 1.) token exchange

    // 2.) change user role
};
