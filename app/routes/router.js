
var Agave = require('../server/agave');

module.exports = function(app) {

    // Request an Agave token
    app.post('/token', function(request, response) {
/*
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
*/
    });



    // Creating new accounts
    app.post('/user', function(request, response) {

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



    app.get('*', function(request, response) {

        response.render('404',
                        { title: 'Page Not Found'}
        );

    });

};
