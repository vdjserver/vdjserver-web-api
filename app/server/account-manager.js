
// Database
var Agave = require('./agave');

var mongoose            = require('mongoose');
var accountCollection   = mongoose.model('accounts');


/* Login Validation Methods */

exports.autoLogin = function(username, password, callback) {

    accountCollection.findOne({username:username}, function(error, account) {

        if (account &&
            account.password === password)
        {
            callback(account);
        }
        else {
            callback(null);
        }

    });

};

exports.manualLogin = function(user, plaintextPassword, callback) {

    accountCollection.findOne({username:user}, function(error, account) {

        if (account === null) {
            callback('user-not-found');
        }
        else {

            var passwordStatus = account.validatePassword(plaintextPassword);

            if (passwordStatus === true) {

                //get an Agave Token
                var token = Agave.getToken();
                callback(null, account);
            }
            else {
                callback('invalid-password');
            }

        }
    });
};



/* record insertion, update & deletion methods */

// Create new account in local mongo db and register new account with Agave
exports.addNewAccount = function(newAccount, callback) {

    /*
        The basic idea here is to search for any mongo documents that match
        |newAccount| on either the username string OR the email string.

        Users are not allowed to proceed with account creation if a match
        exists; this would result in duplicate accounts.
    */
    accountCollection.findOne({username: newAccount.username}, function(error, account) {

        if (account) {
            callback('username-taken');
        }
        else {
            accountCollection.findOne({email: newAccount.email}, function(error, account) {

                if (account) {
                    callback('email-taken');
                }
                else {

                    // Go ahead and secure password, set date, and save
                    newAccount.saltAndHash();
                    newAccount.setDatestamp();

                    newAccount.save(function(error, data) {

                        if (error) {

                            // If there was a problem saving, then remove the new account from mongo and follow callback
                            newAccount.remove();
                            callback("error-saving");

                        }
                        else if (!error) {

                            /*
                                Since the mongo save was ok, also do the Agave save.

                                If there is any problem with the Agave save status,
                                then remove the new account and treat it as an error.
                             */
                            Agave.createInternalUser(newAccount, function(error, status) {

                                if (!error &&
                                    status === "success")
                                {
                                    callback();
                                }
                                else {
                                    newAccount.remove();
                                    callback('error-api');
                                }

                            });
                        }
                    });
                }
            });
        }
    });

};

exports.updateAccount = function(newData, callback) {

    accountCollection.findOne({username:newData.username}, function(error, account) {

        account.firstname = newData.firstname;
        account.lastname  = newData.lastname;
        account.email     = newData.email;
        account.country   = newData.country;

        if (newData.password === '') {
            account.save(function(error, data) {
                callback(null, account);
            });
        }
        else {
            account.password = newData.password;
            account.saltAndHash();

            account.save(function(error, data) {
                callback(null, account);
            });
        }
    });

    // NOTE: consider adding extra callback here for error
};

exports.updatePassword = function(email, newPassword, callback) {

    accountCollection.findOne({email:email}, function(error, account) {

        if (error) {
            callback(error, null);
        }
        else {
            account.password = newPassword;
            account.saltAndHash();

            account.save(function(error, data) {
                callback(null, account);
            });
        }
    });
};



/* account lookup methods */

exports.deleteAccount = function(id, callback) {

    accountCollection.findById(id, function(error, account) {

        account.remove(function(error, data) {

            // Note: if there was a way to also remove an account from Agave, then it'd go here.

            callback();
        });

    });

};

exports.getAccountByEmail = function(email, callback) {
    accountCollection.findOne({email:email}, function(error, account) {
        callback(account);
    });
};

exports.validateResetLink = function(email, passwordHash, callback) {

    accountCollection.find( {
                    $and: [{email:email, password:passwordHash}]
                  },
                  function(error, account) {
                        if (account) {
                            callback('ok');
                        }
                        else {
                            callback(null);
                        }
                  }
    );

};

exports.getAllRecords = function(callback) {
    accountCollection.find().toArray(function(error, response) {
        if (error) {
            callback(error);
        }
        else {
            callback(null, response);
        }
    });
};

exports.deleteAllRecords = function(callback) {
    accountCollection.remove({}, callback); // reset accounts collection for testing //
};
