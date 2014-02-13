
'use strict';

var agaveSettings = require('../config/agaveSettings');

var ServiceAccount = function() {
    this.username = agaveSettings.serviceAccountKey;
    this.password = agaveSettings.serviceAccountSecret;
    this.accessToken = '';
};

ServiceAccount.prototype.setToken = function(vdjauthToken) {
    this.accessToken = vdjauthToken.access_token;
    return;
}

module.exports = ServiceAccount;
