global.Buffer = global.Buffer || require("buffer").Buffer;

var express = require('express');

var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');
var util    = require('./lib/util');
var room    = require('./lib/room');
var obj     = require('./lib/objects');

var pendingPlayers = new Map();
var players = new Map();
var rooms = new Map();
var nextRoomID = 0;

function makeSecurityKey() {
  /*
  Makes a hex string of length 16.  This gets passed to clients in the welcome
  message.  Client must send this key with every request.
  */
  text = "";
  var possible = "0123456789abcdef";
  for (var i = 0; i < 16; i++){
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function authenticateAndExtractData(player, dataAndSecurity) {
  /*
  If data is not formatted as {securityKey: __, data: __}, return null.  Otherwise, extract data
  if securityKey equals player's securityKey, else returns null.
  */
  if (!(
    dataAndSecurity &&
    "securityKey" in dataAndSecurity &&
    "data" in dataAndSecurity
  )) { return null; }
  if (player.securityKey != dataAndSecurity.securityKey) { return null; }
  return dataAndSecurity.data;
}

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
  console.log("Somebody connected!");

  var securityKey = makeSecurityKey();

  var pendingPlayer = {securityKey: securityKey};
  pendingPlayers.set(socket.id, pendingPlayer);

  socket.emit('welcome', securityKey);

  socket.on('playerInformation', function(dataAndSecurity){
    var pendingPlayer = pendingPlayers.get(socket.id);
    if (!pendingPlayer) {return;}

    var data = authenticateAndExtractData(pendingPlayer, dataAndSecurity);
    if (data == null) {return; }
    if (!(data && "name" in data && "windowDimensions" in data)) { return; }
    if (!("width" in data.windowDimensions && "height" in data.windowDimensions)) { return; }

    var currentRoom = rooms.get(nextRoomID);
    if(currentRoom){
      var newPlayer = currentRoom.addPlayer(
        socket, data.name, data.windowDimensions, dataAndSecurity.securityKey
      );
      players.set(socket.id, newPlayer);
      pendingPlayers.delete(socket.id);
      if(currentRoom.players.size >= config.MAX_PLAYERS){
        nextRoomID++;
        rooms.set(nextRoomID, new room.Room(nextRoomID));
      }
    } else{
      rooms.set(nextRoomID, new room.Room(nextRoomID));
      currentRoom = rooms.get(nextRoomID);
      var newPlayer = currentRoom.addPlayer(
        socket, data.name, data.windowDimensions, dataAndSecurity.securityKey
      );
      players.set(socket.id, newPlayer);
      pendingPlayers.delete(socket.id);
    }

    currentRoom.emitToRoom('feed', data.name + " joined the game.");
  });

  socket.on('move', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    if (!(Array.isArray(data) && data.length == 4)) { return; }
    var acceleration = {x:0, y:0};
    if (data[0]) {acceleration.x -= 1};
    if (data[1]) {acceleration.y -= 1};
    if (data[2]) {acceleration.x += 1};
    if (data[3]) {acceleration.y += 1};
    player.acceleration = util.scaleToLength(acceleration, player.accelerationMagnitude());
  });

  socket.on('mouseCoords', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    if (!(data && "x" in data && "y" in data)) { return; }
    player.setMouseCoords(data);
  })

  socket.on('windowResized', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    if (!(data && "width" in data && "height" in data)) { return; }
    player.setWindowDimensions(data);
  })

  socket.on('fire', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    player.attemptFire(player.mouseCoords);
  })

  socket.on('continuousFire', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    player.tryingContinuousFire = data;
    return;
  })
  socket.on('fireSpecial', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    player.attemptSpecialFire(player.mouseCoords);
  })
  socket.on('dropSpecial', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    player.dropSpecialWeapon();
  })

  socket.on('pingcheck', function(dataAndSecurity){
    var player = players.get(socket.id);
    if (!player) { return; }
    var data = authenticateAndExtractData(player, dataAndSecurity);
    if (data == null) {return; }

    socket.emit('pongcheck');
  })

  socket.on('disconnect', function(){
    console.log('user disconnected');
    if (players.has(socket.id)) {
      players.delete(socket.id);
    }
    for (var [key, room] of rooms) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
      }
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
    /*
    var deadPlayers = room.expelDeadPlayers();
    for (var i=0; i<deadPlayers.length; i++) {
      var player = deadPlayers[i];
      if (players.has(player.id)){
        players.delete(player.id)
      }
    }*/
    if(Date.now()-room.startTime >=config.MATCH_LENGTH){
      for(var [playerKey,player] of room.players){
        player.socket.emit('death');
        player.socket.disconnect();
        if (players.has(player.id)){
          players.delete(player.id);
        }
        room.players.delete(player.id);
      }
      rooms.delete(key);
    }
  }
}

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});

setInterval(moveLoops, 1000 / config.FRAME_RATE);
