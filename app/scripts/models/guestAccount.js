
'use strict';

var agaveSettings = require('../config/agaveSettings');
var AgaveToken = require('./agaveToken');

var GuestAccount = {
    username: agaveSettings.guestAccountKey,
    password: agaveSettings.guestAccountSecret,
    agaveToken: null
};

module.exports = GuestAccount;

// Processing
var agaveIO = require('../vendor/agaveIO');

GuestAccount.getToken = function() {

    var that = this;

    return agaveIO.getToken(this)
        .then(function(responseObject) {
            that.agaveToken = new AgaveToken(responseObject);
        })
        .catch(function(errorObject) {
            console.log('VDJ-GUEST ERROR: Unable to login with guest account. ' + errorObject);
            return Promise.reject(errorObject);
        });
}

GuestAccount.accessToken = function() {
    return this.agaveToken.access_token;
}
