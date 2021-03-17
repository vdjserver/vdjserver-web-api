
'use strict';

//
// user.js
// User account
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2015-2020 The University of Texas Southwestern Medical Center
//
// Author: Scott Christley <scott.christley@utsouthwestern.edu>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

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
