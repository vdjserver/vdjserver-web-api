
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

io.of('/api/v1').on('connection', function(socket) {

    socket.on('joinRoom', function(room) {
        socket.join(room);
    });

    socket.on('disconnect', function() {
        // Clean empty rooms
        delete io.sockets.adapter.rooms[socket.id];
    });

});

app.on('jobNotification', function(jobNotification) {
    io.sockets.in(jobNotification.jobId).emit('jobUpdate', jobNotification);
});
