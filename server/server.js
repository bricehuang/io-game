var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');
var players = [];

app.use(express.static(__dirname + '/../client'));

var ARENA_RADIUS = 1500;

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
    windowWidth  : config.defaultWindowWidth,
    id : nextId,
    target  : {x:0,y:0},
  }
  players.push(currentPlayer);

  socket.on('player_information', function(data){
    currentPlayer.name         = data.name;
    currentPlayer.windowWidth  = data.windowWidth;
    currentPlayer.windowHeight = data.windowHeight;
  });

  socket.on('mouse_location', function(message){
    currentPlayer.target = {x:message.x,y:message.y};
    var bearing = Math.atan2(message.x, message.y) * 180 / Math.PI;
    socket.emit('bearing', bearing);
    });
  socket.on('move', function(message){
    currentPlayer.target.x += message.x;
    currentPlayer.target.y += message.y;
  });



  

  socket.on('window_resized', function(dimensions){
    currentPlayer.windowWidth = dimensions.windowWidth;
    currentPlayer.windowHeight = dimensions.windowHeight;
  })


});
function movePlayer(player){
  player.x = player.target.x;
  player.y = player.target.y;
  
  /*
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
  var changeX = 0;
  var changeY = 0;
  if(dist !=0){
    var changeX = speed*x/dist;
    var changeY = speed*y/dist;
  }
  player.x +=changeX;
  player.y +=changeY;
<<<<<<< HEAD
  
*/

//Move to boundary if outside
  var distFromCenter = Math.sqrt(player.x*player.x + player.y*player.y);
  if (distFromCenter > ARENA_RADIUS) {
    player.x *= (.99 * ARENA_RADIUS/distFromCenter);
    player.y *= (.99* ARENA_RADIUS/distFromCenter);
  }

  player.target.x = player.x;
  player.target.y = player.y;

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

function sendView(player) {
  var allPlayers = [];
  for(var i=0; i<players.length; i++)
  {
    var relX = players[i].x - player.x;
    var relY = players[i].y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2)
    {
      var current = {name:players[i].name, x:relX, y: relY};
      allPlayers.push(current);
    }
  }
  player.socket.emit(
    'game_state',
    {
      my_absolute_coord: {x: player.x, y:player.y},
      nearby_objects: allPlayers
    }
  );
}
function moveLoops(){
  for(var i = 0;i<players.length;i++){
    movePlayer(players[i]);
    sendView(players[i]);
  }
}
var updateRate = 60;
setInterval(moveLoops, 1000 / updateRate);
