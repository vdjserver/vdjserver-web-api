
'use strict';

var User = {};

User.schema = function() {
    this.email     = '';
    this.firstName = '';
    this.lastName  = '';

    this.username  = '';
    this.password  = '';
};

module.exports = User.schema;
