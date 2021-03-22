
'use strict';

var agaveSettings = require('../config/agaveSettings');
var AgaveToken = require('./agaveToken');

// Processing
var agaveIO = require('../vendor/agaveIO');

var ServiceAccount = {
    username: agaveSettings.serviceAccountKey,
    password: agaveSettings.serviceAccountSecret,
    agaveToken: null
};

module.exports = ServiceAccount;

/*
var ServiceAccount = function() {
    this.username = agaveSettings.serviceAccountKey;
    this.password = agaveSettings.serviceAccountSecret;
    this.agaveToken = null;
}; */

ServiceAccount.getToken = function() {

    var that = this;

    return agaveIO.getToken(this)
        .then(function(responseObject) {
            that.agaveToken = new AgaveToken(responseObject);
            return Promise.resolve(that.agaveToken);
        })
        .catch(function(errorObject) {
            console.log('VDJ-API ERROR: Unable to login with service account. ' + errorObject);
            return Promise.reject(errorObject);
        });
}

ServiceAccount.accessToken = function() {
    return this.agaveToken.access_token;
}
