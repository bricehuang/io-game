function Game() { };

var nearby_objects = [];

Game.prototype.handleNetwork = function(socket) {
  console.log('Game connection process here');
  console.log(socket);
  socket.on('player_information', function(info){
    // TODO Michael
  })

  socket.on('bearing', function(message){
    console.log('bearing: ' + message);
  })
  socket.on('game_state', function(message){
    nearby_objects = message
  })
  // This is where you receive all socket messages
}

Game.prototype.handleLogic = function() {
  console.log('Game is running');
  // This is where you update your game logic
}

Game.prototype.handleGraphics = function(gfx) {
  // This is where you draw everything
  gfx.fillStyle = '#fbfcfc';
  gfx.fillRect(0, 0, screenWidth, screenHeight);

  gfx.fillStyle = '#2ecc71';
  gfx.strokeStyle = '#003300';
  gfx.font = '12px Verdana';
  gfx.textAlign = 'center';
  for (var i=0; i<nearby_objects.length; i++) {
    var object = nearby_objects[i];
    var centerX = screenWidth/2 + object.x;
    var centerY = screenHeight/2 + object.y;
    var radius = 30;
    gfx.fillText(object.name, centerX, centerY+4);
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
  }
  // gfx.strokeText('Now playing...', screenWidth / 2, screenHeight / 2);
}
