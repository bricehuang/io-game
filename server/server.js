var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
  console.log("Somebody connected!");
  // Write your code here
  socket.on('mouse_location', function(message){
    var bearing = Math.atan2(message.x, message.y) * 180 / Math.PI;
    socket.emit('bearing', bearing);
  })
});

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});
