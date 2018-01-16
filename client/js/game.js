function Game() { };

var nearbyPlayers = [];
var nearbyBullets = [];
var nearbyPowerups = [];
var myAbsoluteCoord = {x: 0, y: 0};
var GRID_OFFSET = 200;
var ARENA_RADIUS = 1500;
var startPingTime;
//var numKills;
var leaderboard =[];
var myStats;

Game.prototype.handleNetwork = function(socket) {
  console.log('Game connection process here');
  console.log(socket);

  socket.on('gameState', function(message){
    nearbyPlayers = message.nearbyPlayers;
    nearbyBullets = message.nearbyBullets;
    nearbyPowerups = message.nearbyPowerups;
    myAbsoluteCoord = message.myAbsoluteCoord;
    //numKills = message.myScore;
    leaderboard = message.globalLeaderboard;
    myStats = message.yourStats;
    console.log("message " + message.yourStats);
  })
  socket.on('death', function(message){
    socket.disconnect();
    document.getElementById('gameAreaWrapper').style.display = 'none';
    document.getElementById('startMenuWrapper').style.display = 'block';
  })
  socket.on('pongcheck', function(){
    var timeNow = Date.now();
    console.log("Latency: " + (timeNow - startPingTime) + " ms.");
  })
}

Game.prototype.handleLogic = function() {
  // console.log('Game is running');
  // This is where you update your game logic
}

function drawBackgroundGrid(gfx) {

  gfx.strokeStyle = '#003300';
  var smallestXLine = (screenWidth/2 - myAbsoluteCoord.x) % GRID_OFFSET;
  if (smallestXLine < 0){
    smallestXLine += GRID_OFFSET;
  }
  for (var x = smallestXLine; x<screenWidth; x+=GRID_OFFSET) {
    gfx.moveTo(x, 0);
    gfx.lineTo(x, screenHeight);
  }
  var smallestYLine = (screenHeight/2 - myAbsoluteCoord.y) % GRID_OFFSET;
  if (smallestYLine < 0){
    smallestYLine += GRID_OFFSET;
  }
  for (var y = smallestYLine; y<screenHeight; y+=GRID_OFFSET) {
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
  gfx.lineWidth=5;
  for (var i=0; i<nearbyPlayers.length; i++) {
    var player = nearbyPlayers[i];
    var centerX = screenWidth/2 + player.x;
    var centerY = screenHeight/2 + player.y;
    var radius = 30;
    gfx.fillText(player.name, centerX, centerY-43);
    gfx.fillText(player.health,centerX, centerY+50);
    var color = '#00ff00';
    var h = player.health;

    var red = Math.round((Math.min(200-2*h,100)*255/100)).toString(16);
    if(red.length==1)
      red = '0'+red;
    var green = Math.round((Math.min(2*h,100)*255/100)).toString(16);
    if(green.length==1)
      green = '0'+green;
    var blue = '00';
    color = '#'+red+green+blue;
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();

    gfx.fillStyle = color;
    gfx.fill();
    gfx.closePath();
    //gfx.fillStyle = '#2ecc71';

    //rotate gun
    var mag = Math.sqrt(mouseCoords.x * mouseCoords.x+ mouseCoords.y * mouseCoords.y);
    var dir = {x: mouseCoords.x/mag, y: mouseCoords.y/mag};
    gfx.beginPath();
    gfx.moveTo(centerX+15*dir.x, centerY+15*dir.y);
    gfx.lineTo(centerX, centerY);
    gfx.stroke();
    gfx.closePath();

    gfx.beginPath();
    gfx.arc(centerX, centerY, 5, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.fillStyle = "#000000";
    gfx.fill();
    gfx.closePath();

    gfx.fillStyle = "#00ff00";
  }

  gfx.lineWidth = 1;
  // bullets
  for (var i=0; i<nearbyBullets.length; i++) {
    var bullet = nearbyBullets[i];
    var centerX = screenWidth/2 + bullet.x;
    var centerY = screenHeight/2 + bullet.y;
    var radius = 5;
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.closePath();
  }

  // powerups
  for (var i=0; i<nearbyPowerups.length; i++) {
    var powerup = nearbyPowerups[i];
    var centerX = screenWidth/2 + powerup.x;
    var centerY = screenHeight/2 + powerup.y;
    var radius = 10;
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();

    var powerupImg = getPowerupIcon(powerup.type);
    gfx.drawImage(powerupImg, centerX - 5 , centerY - 5,10,10);
    gfx.closePath();
  }
}

function getPowerupIcon(type) {
  switch(type) {
    case "gun": return gunImg;
    case "bomb": return bombImg;
    case "healthpack": return healthpackImg;
    default: return new Image();
  }
}

function drawBoundary(gfx) {

  var x = Math.abs(myAbsoluteCoord.x)+screenWidth/2; // max absolute x on screen
  var y = Math.abs(myAbsoluteCoord.y)+screenHeight/2; // max absolute y on screen
  if (Math.sqrt(x*x+y*y) >= ARENA_RADIUS) {
    // TODO: draw only the relevant part?
    gfx.beginPath();
    gfx.arc(
      -myAbsoluteCoord.x+screenWidth/2,
      -myAbsoluteCoord.y+screenHeight/2,
      ARENA_RADIUS, 0,
      2*Math.PI,
      false
    );
    gfx.stroke();
    gfx.closePath();
  }
}
function drawForeground(gfx){
  console.log(JSON.stringify(myStats));
  gfx.fillStyle = '#142DCC';
  gfx.strokeStyle = '#003300';
  gfx.font = '100px Verdana'
  gfx.textAlign = 'center'
  //gfx.fillText()
  /*
  if(typeof numKills != 'undefined'){
    if(numKills==1){
      gfx.fillText(numKills + " kill",screenWidth/2,screenHeight/8); 
    }
    else{
      gfx.fillText(numKills + " kills",screenWidth/2,screenHeight/8);
    }
  }
  gfx.stroke();*/
  gfx.font = '48px Verdana';
  gfx.textAlign = 'center';
  leaderboardOffset = {x:100,y:30};
  startTable = {x: screenWidth-300,y:100};
  gfx.fillText('Leaderboard', startTable.x+leaderboardOffset.x,startTable.y);
  gfx.textAlign = 'left';

  gfx.font = '24px Verdana';
  var onLeaderboard = false;
  for(var i =  0;i<leaderboard.length;i++){
    gfx.fillStyle = '#142DCC';
    if(leaderboard[i].id==myStats.id){
      onLeaderboard = true;
      gfx.fillStyle = 'red';
    }
    gfx.textAlign = 'left';
    gfx.fillText(leaderboard[i].name,startTable.x,startTable.y+(i+1)*leaderboardOffset.y);
    gfx.textAlign = 'right';
    gfx.fillText(leaderboard[i].score,startTable.x+2*leaderboardOffset.x,startTable.y+(i+1)*leaderboardOffset.y);
  }
  if(!onLeaderboard){

    gfx.fillStyle = 'red';
    gfx.textAlign = 'left';
    gfx.fillText(myStats.name,startTable.x,startTable.y+(leaderboard.length+1)*leaderboardOffset.y);
    gfx.textAlign = 'right';
    gfx.fillText(myStats.score,startTable.x+2*leaderboardOffset.x,startTable.y+(leaderboard.length+1)*leaderboardOffset.y);
  }
  gfx.stroke();
}

Game.prototype.handleGraphics = function(gfx,mouse) {
  // This is where you draw everything
  gfx.fillStyle = '#fbfcfc';
  gfx.fillRect(0, 0, screenWidth, screenHeight);

  drawBackgroundGrid(gfx);
  drawObjects(gfx);
  drawBoundary(gfx);
  drawForeground(gfx);
}
