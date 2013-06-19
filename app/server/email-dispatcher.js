
var email = require("emailjs/email");

var EM = {};
module.exports = EM;


// Handy setter trick to let this controller get email settings from another source
var emailSettings = {};

EM.setupEmailSettings = function(_emailSettings) {
    emailSettings = _emailSettings;
};


EM.dispatchResetPasswordLink = function(account, callback) {

    var server = email.server.connect({
        user        : emailSettings.user,
        password    : emailSettings.password,
        host        : emailSettings.host,
        ssl         : emailSettings.ssl,
        port        : emailSettings.port
    });

    server.send({
        from         : emailSettings.sender,
        to           : account.email,
        subject      : 'Password Reset',
        text         : 'Password Reset Email',
        attachment   : EM.composeEmail(account)
    }, function(error, message) {
        console.log("email server error is: "   + error);
        console.log("email server message is: " + JSON.stringify(message));
    });

};

EM.composeEmail = function(account) {

    var link  = 'https://vdjserver.org/reset-password?e=';
        link += account.email
        link += '&p='
        link += account.password;


    var html  = "<html><body>";
        html += "Hi " + account.firstname + ",";
        html += "<br><br>";
        html += "Your username is: ";
        html += "<b>" + account.username + "</b><br><br>";
        html += "<a href='" + link + "'>Please click here to reset your password</a>";
        html += "<br><br>";
        html += "</body></html>";


    return  [{data:html, alternative:true}];
};
