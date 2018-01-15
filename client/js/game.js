function Game() { };

Game.prototype.handleNetwork = function(socket) {
  console.log('Game connection process here');
  console.log(socket);
  socket.on('player_information', function(info){
    // TODO Michael
  })

  socket.on('bearing', function(message){
    console.log('bearing: ' + message);
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
  gfx.strokeStyle = '#27ae60';
  gfx.font = '12px Verdana';
  gfx.textAlign = 'center';
  gfx.lineWidth = 2;
  gfx.fillText(playerName, screenWidth / 2, screenHeight / 2);
  // gfx.strokeText('Now playing...', screenWidth / 2, screenHeight / 2);
}
