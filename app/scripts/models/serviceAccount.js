
'use strict';

// Node Libraries
var Q = require('q');

var agaveSettings = require('../config/agaveSettings');
var AgaveToken = require('./agaveToken');

var ServiceAccount = {
    username: agaveSettings.serviceAccountKey,
    password: agaveSettings.serviceAccountSecret,
    agaveToken: null
};

module.exports = ServiceAccount;

// Processing
var agaveIO = require('../vendor/agaveIO');

/*
var ServiceAccount = function() {
    this.username = agaveSettings.serviceAccountKey;
    this.password = agaveSettings.serviceAccountSecret;
    this.agaveToken = null;
}; */

ServiceAccount.getToken = function() {

    var deferred = Q.defer();
    var that = this;

    agaveIO.getToken(this)
    .then(function(responseObject) {
	that.agaveToken = new AgaveToken(responseObject);
	deferred.resolve(that.agaveToken);
    })
    .fail(function(errorObject) {
	console.log('VDJ-API ERROR: Unable to login with service account. ' + errorObject);
        deferred.reject(errorObject);
    });

    return deferred.promise;
}

ServiceAccount.accessToken = function() {
    return this.agaveToken.access_token;
}
