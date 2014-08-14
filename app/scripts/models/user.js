
'use strict';

var _ = require('underscore');

var User = function(attributes) {
    this.username  = attributes.username || '';
    this.password  = attributes.password || '';

    this.email      = attributes.email || '';
    this.firstName  = attributes.firstName || '';
    this.lastName   = attributes.lastName  || '';
    this.city       = attributes.city  || '';
    this.state      = attributes.state || '';
    this.country    = attributes.country || '';
    this.affiliation = attributes.affiliation || '';
};

User.prototype.getSanitizedAttributes = function() {
    return _.omit(this, 'password');
};

User.prototype.getCreateUserAttributes = function() {

    return {
        username: this.username,
        password: this.password,
        email:    this.email
    };
};

module.exports = User;
