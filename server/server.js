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
  var allPlayers = [];
  for(var i=0; i<players.length; i++)
  {
    var relX = players[i].x - player.x;
    var relY = players[i].y - player.y;
    if( abs(relX) <= player.windowWidth/2 && abs(relY) <= player.windowHeight/2)
    {
      var current = {name:players[i].name, x:relX, y: relY};
      allPlayers.push(current);

    }

  }
  player.socket.emit('game_state', allPlayers);
}

var updateRate = 10;
setInterval(sendView, 1000 / updateRate);


