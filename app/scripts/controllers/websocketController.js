
'use strict';

var app = require('../app');

// Node Libraries
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

    app.on('jobNotification', function(jobNotification) {
        socket.in(jobNotification.jobId).emit('jobUpdate', jobNotification);
    });

});
