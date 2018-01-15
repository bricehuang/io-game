function Game() { };

var nearby_players = [];
var nearby_bullets = [];
var nearby_powerups = [];
var my_absolute_coord = {x: 0, y: 0};
var GRID_OFFSET = 200;

var ARENA_RADIUS = 1500;

Game.prototype.handleNetwork = function(socket) {
  console.log('Game connection process here');
  console.log(socket);

  socket.on('game_state', function(message){
    nearby_players = message.nearby_players;
    nearby_bullets = message.nearby_bullets;
    nearby_powerups = message.nearby_powerups;
    my_absolute_coord = message.my_absolute_coord;
    my_health = message.my_health;

    // console.log(message.my_absolute_coord);
    // console.log(message.nearby_players);
    // console.log(message.nearby_bullets);
  })
  // This is where you receive all socket messages
}

Game.prototype.handleLogic = function() {
  // console.log('Game is running');
  // This is where you update your game logic
}

function drawBackgroundGrid(gfx) {
  var smallest_x_line = (screenWidth/2 - my_absolute_coord.x) % GRID_OFFSET;
  if (smallest_x_line < 0){
    smallest_x_line += GRID_OFFSET;
  }
  for (var x = smallest_x_line; x<screenWidth; x+=GRID_OFFSET) {
    gfx.moveTo(x, 0);
    gfx.lineTo(x, screenHeight);
  }
  var smallest_y_line = (screenHeight/2 - my_absolute_coord.y) % GRID_OFFSET;
  if (smallest_y_line < 0){
    smallest_y_line += GRID_OFFSET;
  }
  for (var y = smallest_y_line; y<screenHeight; y+=GRID_OFFSET) {
    gfx.moveTo(0, y);
    gfx.lineTo(screenWidth, y);
  }
  gfx.stroke();
}

function drawObjects(gfx) {
  gfx.fillStyle = '#2ecc71';
  gfx.strokeStyle = '#003300';
  gfx.font = '12px Verdana';
  gfx.textAlign = 'center';
  // players
  for (var i=0; i<nearby_players.length; i++) {
    var player = nearby_players[i];
    var centerX = screenWidth/2 + player.x;
    var centerY = screenHeight/2 + player.y;
    var radius = 30;
    gfx.fillText(player.name, centerX, centerY+4);
    gfx.fillText(player.health, centerX, centerY-36);
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.closePath();
  }

  // bullets
  for (var i=0; i<nearby_bullets.length; i++) {
    var bullet = nearby_bullets[i];
    var centerX = screenWidth/2 + bullet.x;
    var centerY = screenHeight/2 + bullet.y;
    var radius = 5;
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.closePath();
  }
  //powerups
  for (var i=0; i<nearby_powerups.length; i++) {
    var bullet = nearby_powerups[i];
    var centerX = screenWidth/2 + bullet.x;
    var centerY = screenHeight/2 + bullet.y;
    var radius = 10;
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.closePath();
  }

}

function drawBoundary(gfx) {
  var x = Math.abs(my_absolute_coord.x)+screenWidth/2; // max absolute x on screen
  var y = Math.abs(my_absolute_coord.y)+screenHeight/2; // max absolute y on screen
  if (Math.sqrt(x*x+y*y) < ARENA_RADIUS) {
    // all four corners of screen are in the arena
    return;
  } else {
    // TODO: draw only the relevant part?
    gfx.beginPath();
    gfx.arc(
      -my_absolute_coord.x+screenWidth/2,
      -my_absolute_coord.y+screenHeight/2,
      ARENA_RADIUS, 0,
      2*Math.PI,
      false
    );
    gfx.stroke();
    gfx.closePath();
  }
}

Game.prototype.handleGraphics = function(gfx) {
  // This is where you draw everything
  gfx.fillStyle = '#fbfcfc';
  gfx.fillRect(0, 0, screenWidth, screenHeight);

  drawBackgroundGrid(gfx);
  drawObjects(gfx);
  drawBoundary(gfx);
}
