
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

        // Clean empty rooms
        delete io.sockets.adapter.rooms[socket.id];
    });

});

app.on('jobNotification', function(jobNotification) {
    console.log("sending jobNotification: " + JSON.stringify(jobNotification));
    io.sockets.in(jobNotification.jobId).emit('jobUpdate', jobNotification);
});
