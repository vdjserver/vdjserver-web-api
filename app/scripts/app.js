
'use strict';

var express = require('express');
var app     = express();
var https    = require('https');
//var http    = require('http');

// Config
require('./config/appSettings.js')(app, express);

// Router
require('./routes/router')(app);

// Server
//http.createServer(app).listen(app.get('port'), function() {
https.createServer(app.get('sslOptions'), app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
