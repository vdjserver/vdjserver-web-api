
var CT = require('../server/country-list');
var AM = require('../server/account-manager');
var EM = require('../server/email-dispatcher');

var mongoose           = require('mongoose');
var accountCollection  = mongoose.model('accounts');


module.exports = function(app) {


    // Main Login
    app.get('/', function(request, response) {

        // check if the user's credentials are saved in a cookie //
        if (request.cookies.username  === undefined ||
            request.cookies.password  === undefined)
        {
            response.render('login',
                            { title: 'Hello - Please Login To Your Account' }
            );
        }
        else {

            // attempt automatic login //
            AM.autoLogin(request.cookies.username, request.cookies.password, function(account) {

                if (account) {
                    request.session.userAccountData = account;
                    response.redirect('/home');
                }
                else {
                    response.render('login',
                                    { title: 'Hello - Please Login To Your Account' }
                    );
                }
            });
        }
    });


    app.post('/', function(request, response) {

        AM.manualLogin(request.param('username'), request.param('password'), function(error, account) {
            if (!account) {
                response.send(error, 400);
            }
            else {
                request.session.userAccountData = account;

                if (request.param('remember-me') === 'true') {

                    response.cookie('username',
                                    account.username,
                                    { maxAge: 900000 });

                    response.cookie('password',
                                    account.password,
                                    { maxAge: 900000 });
                }

                response.send(account, 200);
            }
       });

    });



    // logged-in user homepage //

    app.get('/home', function(request, response) {

        if (request.session.userAccountData === null) {
            // if user is not logged-in redirect back to login page //
            response.redirect('/');
        }
        else {
            response.render('home',
                            {
                                title           : 'Control Panel',
                                countries       : CT,
                                userAccountData : request.session.userAccountData
                            }
            );
        }

    });


    app.post('/home', function(request, response) {

        if (request.param('username') != undefined) {
            AM.updateAccount({
                                firstname : request.param('firstname'),
                                lastname  : request.param('lastname'),
                                email     : request.param('email'),
                                username  : request.param('username'),
                                password  : request.param('password'),
                                country   : request.param('country')
                             },
                             function(error, account) {
                                 if (error) {
                                     response.send('error-updating-account', 400);
                                 }
                                 else {
                                     request.session.userdata = account;

                                     // update the user's login cookies if they exists //
                                     if (request.cookies.username != undefined &&
                                         request.cookies.password != undefined)
                                     {
                                         response.cookie('username',
                                                         account.username,
                                                         { maxAge: 900000 });

                                         response.cookie('password',
                                                         account.password,
                                                         { maxAge: 900000 });
                                     }

                                     response.send('ok', 200);
                                 }
                             }
            );
        }
        else if (request.param('logout') === 'true') {
            response.clearCookie('username');
            response.clearCookie('password');

            request.session.destroy(function(error) {
                response.send('ok', 200);
            });
        }
    });



    // creating new accounts //

    app.get('/signup', function(request, response) {

        response.render('signup',
                        {  title: 'Signup', countries : CT });

    });


    app.post('/signup', function(request, response) {

        var newAccount = new accountCollection();

        newAccount.firstname = request.param('firstname');
        newAccount.lastname  = request.param('lastname');
        newAccount.email     = request.param('email');
        newAccount.username  = request.param('username');
        newAccount.password  = request.param('password');
        newAccount.country   = request.param('country');

        AM.addNewAccount(newAccount, function(error) {

            if (error) {
                // Bad Request
                response.send(error, 400);
            }
            else {
                // Ok
                response.send('ok', 200);
            }

        });

    });



    // password reset //

    app.post('/lost-password', function(request, response) {

        // look up the user's account via their email //
        AM.getAccountByEmail(request.param('email'), function(account) {

            if (account) {
                response.send('ok', 200);

                // Set email settings before trying to use the email controller
                EM.setupEmailSettings(app.emailSettings);

                EM.dispatchResetPasswordLink(account, function(error, m) {

                    /*
                        this callback takes a moment to return
                        should add an ajax loader to give user feedback
                    */
                    if (!error) {
                        response.send('ok', 200);
                    }
                    else {
                        response.send('email-server-error', 400);
                        for (k in error) console.log('error : ', k, error[k]);
                    }

                });

            }
            else {
                response.send('email-not-found', 400);
            }

        });

    });


    app.get('/reset-password', function(request, response) {

        var passwordHash = request.query["p"];
        var email        = request.query["e"];

        AM.validateResetLink(email, passwordHash, function(resetStatus) {
            if (resetStatus != 'ok') {
                response.redirect('/');
            }
            else {

                // save the user's email in a session instead of sending to the client //
                request.session.reset = {
                    email        : email,
                    passwordHash : passwordHash
                };

                response.render('reset',
                                { title : 'Reset Password' });
            }
         });
    });


    app.post('/reset-password', function(request, response) {

        var nPass = request.param('password');

        // retrieve the user's email from the session to lookup their account and reset password //
        var email = request.session.reset.email;

        // destroy the session immediately after retrieving the stored email //
        request.session.destroy();

        AM.updatePassword(email, nPass, function(error, account) {
            if (!error) {
                response.send('ok', 200);
            }
            else {
                response.send('unable to update password', 400);
            }
        });
    });



    // view & delete accounts //

    app.get('/print', function(request, response) {

        AM.getAllRecords(function(error, accounts) {
            response.render('print',
                            { title : 'Account List', accts : accounts }
            );
        });

    });


    app.post('/delete', function(request, response) {

        AM.deleteAccount(request.body.id, function(error, account) {

            if (!error) {
                response.clearCookie('username');
                response.clearCookie('password');
                request.session.destroy(function(error) {
                    response.send('ok', 200);
                });
            }
            else {
                response.send('record not found', 400);
            }

        });

    });


    app.get('/reset', function(request, response) {

        AM.delAllRecords(function() {
            response.redirect('/print');
        });

    });


    app.get('*', function(request, response) {

        response.render('404',
                        { title: 'Page Not Found'}
        );

    });

};
