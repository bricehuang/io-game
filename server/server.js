global.Buffer = global.Buffer || require("buffer").Buffer;

var express = require('express');

var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');
var util    = require('./lib/util');
var room    = require('./lib/room');
var obj     = require('./lib/objects');

var players = new Map();
var rooms = new Map();
var nextRoomID = 0;

rooms.set(nextRoomID, new room.Room(nextRoomID));

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
  console.log("Somebody connected!");

  var currentRoom = rooms.get(nextRoomID);
  var newPlayer = currentRoom.addPlayer(socket);
  players.set(socket.id, newPlayer);

  socket.on('playerInformation', function(data){
    if (!(data && "name" in data && "windowDimensions" in data)) { return; }
    if (!("width" in data.windowDimensions && "height" in data.windowDimensions)) { return; }
    var player = players.get(socket.id);
    if (!player) return;
    player.setName(data.name);
    player.setWindowDimensions(data.windowDimensions);
    io.emit('feed', data.name + " joined the game.");
  });

  socket.on('move', function(message){
    if (!(Array.isArray(message) && message.length == 4)) { return; }
    var player = players.get(socket.id);
    if (!player) { return; }
    var acceleration = {x:0, y:0};
    if (message[0]) {acceleration.x -= 1};
    if (message[1]) {acceleration.y -= 1};
    if (message[2]) {acceleration.x += 1};
    if (message[3]) {acceleration.y += 1};
    player.acceleration = util.scaleToLength(acceleration, player.accelerationMagnitude())
  });

  socket.on('mouseCoords', function(mouseCoords){
    if (!(mouseCoords && "x" in mouseCoords && "y" in mouseCoords)) { return; }
    var player = players.get(socket.id);
    if (!player) return;
    player.setMouseCoords(mouseCoords);
  })

  socket.on('windowResized', function(dimensions){
    if (!(dimensions && "width" in dimensions && "height" in dimensions)) { return; }
    var player = players.get(socket.id);
    if (!player) return;
    player.setWindowDimensions(dimensions);
  })

  socket.on('fire', function(){
    var player = players.get(socket.id);
    if (!player) return;
    player.attemptFire(player.mouseCoords);
  })

  socket.on('continuousFire', function(tryFire){
    var player = players.get(socket.id);
    if(!player) return;
    player.tryingContinuousFire = tryFire;
    return;
  })
  socket.on('fireSniper', function(){
    var player = players.get(socket.id);
    if (!player) return;
    player.attemptSpecialFire(player.mouseCoords);
  })

  socket.on('pingcheck', function() {
    console.log('I was pinged!');
    socket.emit('pongcheck');
  })

  socket.on('disconnect', function(){
    console.log('user disconnected');
    if (players.has(socket.id)) {
      players.delete(socket.id);
    }
  })
});

function expelDeadPlayer(player) {
  players.delete(player.id);
  player.room.players.delete(player.id);
  player.socket.emit('death');
  player.socket.disconnect();
}

function moveLoops(){
  for (var key of rooms.keys()) {
    var room = rooms.get(key);
    room.moveLoop();
    var deadPlayers = room.expelDeadPlayers();
    for (var i=0; i<deadPlayers.length; i++) {
      var player = deadPlayers[i];
      if (players.has(player.id)){
        players.delete(player.id)
      }
    }
  }
}

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});

setInterval(moveLoops, 1000 / config.FRAME_RATE);
