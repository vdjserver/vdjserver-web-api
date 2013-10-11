
// Models
var InternalUser = require('../models/internalUser');
var Project      = require('../models/project');

// Controllers
var apiResponseController = require('./apiResponseController');

var ProjectController = {};
module.exports = ProjectController;


ProjectController.getUserProjectList = function(request, response) {

    InternalUser.findOne({ 'username': request.auth.username}, function(error, internalUser) {

        if (error) {
            apiResponseController.sendError("Unable to find a user id for username '" + request.auth.username + "'.", response);
        }
        else {
            Project.find({'members': internalUser._id}, function(error, projects) {
                if (error) {
                    apiResponseController.sendError("Unable to find projects for user id '" + internalUser._id + "'.");
                }
                else {
                    apiResponseController.sendSuccess(projects, response);
                }
            });
        }
    });


};


ProjectController.createProject = function(request, response) {

    if (request.body.members.length < 1 || !request.body.name) {
        apiResponseController.sendError(genericError, response);
    }
    else {
        InternalUser.find({username: {$all: request.body.members}}, function(error, internalUser) {

            if (error) {
                apiResponseController.sendError(genericError, response);
            }
            else {

                // Make a list of internal user ids associated with this project
                var internalUserIds = [];

                for (var i = 0; i < internalUser.length; i++) {
                    internalUserIds.push(internalUser[i]['_id']);
                };


                // Set attributes and save
                var project = new Project();
                project.name = request.body.name;
                project.members = internalUserIds;

                project.save(function(error, savedProject) {

                    if (error) {
                        apiResponseController.sendError(genericError, response);
                    }
                    else {
                        Project.findOne({'_id': savedProject._id}).populate({path: 'members', select:'username'}).exec(function(error, outputProject) {

                            apiResponseController.sendSuccess(outputProject, response);
                        });
                    }

                });

            }
        });
    }
};

ProjectController.getProject = function(request, response) {
    
    if (request.params.length !== 1) {
        apiResponseController.sendError("Please request a single project id at a time.", response);
    }

    InternalUser.findOne({ 'username': request.auth.username}, function(error, internalUser) {

        if (error) {
            apiResponseController.sendError("Unable to find a user id for username '" + request.auth.username + "'.", response);
        }
        else {
            Project.findOne({'members': internalUser._id , '_id':request.params[0]}, function(error, project) {
                if (error) {
                    apiResponseController.sendError("Unable to find project for user id '" + internalUser._id + "'.");
                }
                else {
                    apiResponseController.sendSuccess(project, response);
                }
            });
        }
    });
};

ProjectController.deleteProject = function(request, response) {
    
    console.log("request body is: " + JSON.stringify(request.params));
    if (request.params.length !== 1) {
        apiResponseController.sendError("Please request a single project id at a time.", response);
    }

    InternalUser.findOne({ 'username': request.auth.username}, function(error, internalUser) {

        if (error) {
            apiResponseController.sendError("Unable to find a user id for username '" + request.auth.username + "'.", response);
        }
        else {
            Project.findOne({'members': internalUser._id , '_id':request.params[0]}, function(error, project) {
                if (error) {
                    apiResponseController.sendError("Unable to find project for user id '" + internalUser._id + "'.");
                }
                else {
                    project.remove();
                    apiResponseController.sendSuccess('', response);
                }
            });
        }
    });
};
