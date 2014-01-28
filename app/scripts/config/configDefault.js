
var config = {};

module.exports = config;


// General
config.port = 8443;
config.sessionSecret = 'super-duper-secret-secret';

// Server / SSL
var fs = require('fs');
config.sslOptions = {
    key:  fs.readFileSync(__dirname + '/vdjserver.org.certificate/vdjserver.org.key'),
    cert: fs.readFileSync(__dirname + '/vdjserver.org.certificate/vdjserver.org.cer')
};
