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
    player = players.get(socket.id);
    if (!player) return;
    player.setName(data.name);
    player.setWindowDimensions(data.windowDimensions);
    io.emit('feed', data.name + " joined the game.");
  });

  socket.on('move', function(message){
    if (!(Array.isArray(message) && message.length == 4)) { return; }
    player = players.get(socket.id);
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
    player = players.get(socket.id);
    if (!player) return;
    player.setMouseCoords(mouseCoords);
  })

  socket.on('windowResized', function(dimensions){
    if (!(dimensions && "width" in dimensions && "height" in dimensions)) { return; }
    player = players.get(socket.id);
    if (!player) return;
    player.setWindowDimensions(dimensions);
  })

  socket.on('fire', function(vector){
    if (!(vector && "x" in vector && "y" in vector)) { return; }
    if (vector.x == 0 && vector.y == 0) { return; }
    player = players.get(socket.id);
    if (!player) return;
    if (player.canFireNow() && player.ammo > 0) {
      var heading = util.normalize(vector);
      var position = util.add(player.position, util.scale(heading, player.radius+config.BULLET_RADIUS+2));
      // TODO move to room.js
      var room = rooms.get(player.roomID);
      var bullet = new obj.Bullet(
        room.nextProjectileID++,
        player,
        position,
        heading
      )
      room.projectiles.set(bullet.id, bullet);
      player.refreshFireTimestamp();
      player.ammo--;
    }
  })

  socket.on('continuousFire', function(tryFire){
    player = players.get(socket.id);
    if(!player) return;
    player.tryingContinuousFire = tryFire;
    return;
  })
  socket.on('fireSniper', function(vector){
    if (!(vector && "x" in vector && "y" in vector)) { return; }
    if (vector.x == 0 && vector.y == 0) { return; }
    player = players.get(socket.id);
    if (!player) return;
    if (player.canFireNow() && player.sniperAmmo>0) {
      var heading = util.normalize(vector);
      // TODO move to room.js
      var room = rooms.get(player.roomID);
      var sniperBullet = new obj.SniperBullet(
        room.nextProjectileID++,
        player,
        util.add(player.position, util.scale(heading, player.radius+config.BULLET_RADIUS+2)),
        heading
      )
      room.projectiles.set(sniperBullet.id, sniperBullet);
      player.refreshFireTimestamp();
      player.sniperAmmo--;
    }
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
  players.delete(player.socket.id);
  var room = rooms.get(player.roomID);
  if (room) {
    room.players.delete(player.socket.id);
  }
  player.socket.emit('death');
  player.socket.disconnect();
}

function moveLoops(){
  for (var key of rooms.keys()) {
    var room = rooms.get(key);
    room.moveLoop();
  }
  var keysOfPlayersToExpel = [];
  for (var key of players.keys()) {
    var player = players.get(key);
    if (player.health <= 0) {
      keysOfPlayersToExpel.push(key);
      var room = rooms.get(player.roomID);
      if (room) {
        room.spawnPowerupsOnPlayerDeath(player);
      }
    }
  }
  if (keysOfPlayersToExpel.length > 0){
    console.log("expelling dead players: " + keysOfPlayersToExpel);
  }
  for (var i=0; i<keysOfPlayersToExpel.length; i++) {
    var player = players.get(keysOfPlayersToExpel[i]);
    expelDeadPlayer(player);
  }
}

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});

setInterval(moveLoops, 1000 / config.FRAME_RATE);
