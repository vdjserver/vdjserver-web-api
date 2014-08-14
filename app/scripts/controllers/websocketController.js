
'use strict';

var app = require('../app');

// Controllers
//var apiResponseController = require('./apiResponseController');

// Processing
//var agaveIO = require('../vendor/agave/agaveIO');

// Node Libraries
//var Q = require('q');
var io = require('socket.io')(app.server);

var WebsocketsController = {};
module.exports = WebsocketsController;


io.on('connection', function(socket) {
    console.log("connection ok. rooms are: " + JSON.stringify(io.sockets.adapter.rooms));

    socket.on('joinRoom', function(room) {
        console.log("joining room: " + room);
        socket.join(room);
    });

    socket.on('disconnect', function() {
        console.log("user disconnected");
    });

    app.on('event:jobNotification', function(jobNotification) {
        io.sockets.in(jobNotification.jobId).emit('jobUpdate:' + jobNotification.jobId, jobNotification);
        //console.log(io.sockets);
    });
});
