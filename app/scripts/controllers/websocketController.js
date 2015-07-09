'use strict';

var app = require('../app');

// Node Libraries
var io = require('socket.io')(app.server);
var nsp = io.of('/api/v1');

var WebsocketsController = {};
module.exports = WebsocketsController;

nsp.on('connection', function(socket) {

    socket.on('joinRoom', function(room) {
        //console.log("socket join. Rooms are: " + JSON.stringify(io.sockets.adapter.rooms));
        socket.join(room);
    });

    socket.on('disconnect', function() {
        //console.log("socket disconnect");

        // Clean empty rooms
        delete io.sockets.adapter.rooms[socket.id];
    });
});

app.on('jobNotification', function(jobNotification) {
    //console.log("jobNotification received ok: " + JSON.stringify(jobNotification));
    //console.log("jobNotification recieved. Rooms are: " + JSON.stringify(io.sockets.adapter.rooms));

    nsp.in(jobNotification.jobId).emit('jobUpdate', jobNotification);
});

app.on('fileImportNotification', function(fileImportNotification) {
    //console.log("fileImportNotification received ok: " + JSON.stringify(fileImportNotification));
    //console.log("fileImportNotification recieved. Rooms are: " + JSON.stringify(io.sockets.adapter.rooms));

    nsp.in(fileImportNotification.fileInformation.fileUuid).emit('fileImportUpdate', fileImportNotification);
});
