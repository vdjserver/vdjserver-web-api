
'use strict';

var express = require('express');
var app     = express();

// Config
require('./config/appSettings.js')(app, express);

// Router
require('./routes/router')(app);

// Server
app.configure('development', function() {

    var http = require('http');
    http.createServer(app).listen(app.get('port'), function() {
        console.log('Express Dev HTTP server listening on port ' + app.get('port'));
    });
});

app.configure('production', function() {

    var https = require('https');
    https.createServer(app.get('sslOptions'), app).listen(app.get('port'), function() {
        console.log('Express Prod HTTPS server listening on port ' + app.get('port'));
    });
});
