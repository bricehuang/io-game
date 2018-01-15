var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');
var players = [];

app.use(express.static(__dirname + '/../client'));

io.on('connection', function (socket) {
  console.log("Somebody connected!");
  // Write your code here
  nextId = players.length;
  currentPlayer = {
    name:config.defaultName,
    x:0,
    y:0,
    socket:socket,
    windowHeight : config.defaultWindowHeight,
    windowWidth  : config.defaultWindowWidth;
    id : nextId;
    target  : {x:0,y:0}
  }
  players.push(currentPlayer);

  socket.on('player_information', function(data){
    currentPlayer.name         = data.playerName;
    currentPlayer.windowWidth  = data.playerWidth;
    currentPlayer.windowHeight = data.playerHeight;
  });

  socket.on('mouse_location', function(message){
    currentPlayer.target = {x:message.x,y:message.y};
    var bearing = Math.atan2(message.x, message.y) * 180 / Math.PI;
    socket.emit('bearing', bearing);
  });

});
function movePlayer(player){
  var x = player.target.x;
  var y = player.target.y;
  var maxSpeed = 6;
  var speed;
  var dist = Math.sqrt(x*x+y*y);
  if(dist>50){
    speed = maxSpeed;
  }
  else if(dist<20){
    speed = 0;
  }
  else{
    speed = (dist-20)* (maxSpeed)/30;
  }
  var deg = Math.atan2(x,y);
  var changeX = speed*cos(deg);
  var changeY = speed*sin(deg);
  player.x +=changeX;
  player.y +=changeY;
}
var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});

/*
Players should have fields:
player.name (string, name)
player.y (float, absolute x-coordinate in game grid)
player.y (float, absolute y-coordinate in game grid)
player.socket (player's socket)
player.windowWidth (width of player's client window)
player.windowHeight (height of player's client window)
*/

/*
Return an array
  [
    {
      name: __
      x: __
      y: __
    },
    {
      name: __
      x: __
      y: __
    },
    ...
  ]
where each element in this array is a player within
x-distance player.windowWidth/2 and y-distance
player.windowHeight/2 from this player.  For each object,
the x,y values returned represent the location of the
player relative to this player.
*/
function sendView(player) {
  // TODO replace "" with something
  player.socket.emit('game_state', "")
}


