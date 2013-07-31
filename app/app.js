
var express = require('express');
var app     = express();
//var http    = require('https');
var http    = require('http');

// Mongoose
var mongoose = require('mongoose');

// Config
var config = require('./config/config.js')(app, express, mongoose);


// Router
require('./routes/router')(app);


// Server
//http.createServer(sslOptions,app).listen(app.get('port'), function() {
http.createServer(app).listen(app.get('port'), function() {
    console.log("Express server listening on port " + app.get('port'));
});
