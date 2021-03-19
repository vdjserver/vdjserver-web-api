
'use strict';

//
// errorInjection.js
// Error injection for test suite
//
// VDJServer Analysis Portal
// VDJ API Service
// https://vdjserver.org
//
// Copyright (C) 2021 The University of Texas Southwestern Medical Center
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

var errorInjection = {};

module.exports = errorInjection;

var errorList = {
    "agaveIO.getToken": {},
    "agaveIO.createUserProfile": {},
    "agaveIO.createUserVerificationMetadata": {},
    "agaveIO.isDuplicateUsername": {}
};

var currentError = null;
errorInjection.getCurrentError = function() {
    return currentError;
}

errorInjection.setCurrentError = function(error) {
    if (errorList[error]) currentError = error;
    else currentError = null;
    console.log('VDJ-API WARNING: Current error injection: ' + currentError);
    return currentError;
}

errorInjection.shouldInjectError = function(value) {
    if (currentError == value) return true;
    else return false;
}

errorInjection.performInjectError = function() {
    console.log('VDJ-API WARNING: Injecting error: ' + currentError);
    return Promise.reject(new Error('VDJ-API INJECTED ERROR: ' + currentError));
}
