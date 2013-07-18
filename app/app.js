
var express = require('express');
var app     = express();
//var http    = require('https');
var http    = require('http');


// Config
var config = require('./config/config.js')(app, express);


// Router
require('./routes/router')(app);


// Server
//http.createServer(sslOptions,app).listen(app.get('port'), function() {
http.createServer(app).listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
});
