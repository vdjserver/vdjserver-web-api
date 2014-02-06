
'use strict';

var _ = require('underscore');

//var User = {};

//User.schema = function() {
var User = function() {
    this.username  = '';
    this.password  = '';

    this.email      = '';
    this.firstName  = '';
    this.lastName   = '';
    this.city       = '';
    this.state      = '';
};

User.prototype.getSanitizedAttributes = function() {
    return _.omit(this, 'password');
}

User.prototype.getCreateUserAttributes = function() {

    return {
        username: this.username,
        password: this.password,
        email:    this.email
    };
}

module.exports = User;
