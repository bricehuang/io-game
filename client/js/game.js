function Game() { };

var nearbyPlayers = [];
var nearbyProjectiles = [];
var nearbyPowerups = [];
var nearbyObstacles = [];
var myAbsoluteCoord = {x: 0, y: 0};
var GRID_OFFSET = 200;
var ARENA_RADIUS = 1500;
var startPingTime;
//var numKills;
var leaderboard =[];
var myStats;
var ammo = 30;
var specialAmmo = 0;
var specialWeapon = "";

var oscillateStep = 0;
var numOscillateSteps = 64;
//oscillateStep and numOscillateSteps maybe shouldn't be random global variables
var bson = new BSON();
var isSpiky = false;

Game.prototype.handleNetwork = function(socket) {
  console.log('Game connection process here');
  console.log(socket);

  socket.on('gameState', function(data){
    var message = bson.deserialize(Buffer.from(data));
    nearbyPlayers = message.nPl;
    nearbyProjectiles = message.nPj;
    nearbyPowerups = message.nPu;
    myAbsoluteCoord = message.AbCd;

    nearbyObstacles = message.nOb;


    leaderboard = message.Ldb;
    myStats = message.stats;
    ammo = message.am;
    specialAmmo = message.spA;
    specialWeapon = message.spW;
  })
  socket.on('death', function(message){
    document.getElementById('gameAreaWrapper').style.display = 'none';
    document.getElementById('startMenuWrapper').style.display = 'block';
    $('#feed').empty();
    while(feed.firstChild ){
      feed.removeChild(feed.firstChild);
    }
  })
  socket.on('pongcheck', function(){
    var timeNow = Date.now();
    console.log("Latency: " + (timeNow - startPingTime) + " ms.");
  })
  socket.on('feed', function(message){
    $('#feed').append($('<li>').text(message));
    var feedWindow = $('#feedContainer');
    if (feedWindow.scrollTop() + feedWindow.height() + 20 >= feedWindow[0].scrollHeight) {
        feedWindow.scrollTop(feedWindow[0].scrollHeight);
    }

  })
}

Game.prototype.handleLogic = function() {
  // console.log('Game is running');
  // This is where you update your game logic
}



function drawObjects(gfx) {
  drawProjectiles(gfx);
  drawPowerups(gfx);
  drawPlayers(gfx);
  drawObstacles(gfx);
}

function drawPlayers(gfx){
  gfx.lineWidth=5;
  for (var i=0; i<nearbyPlayers.length; i++) {
    var player = nearbyPlayers[i];
    var centerX = screenWidth/2 + player.pos.x;
    var centerY = screenHeight/2 + player.pos.y;
    var radius = 30+player.tier*3;
    if(player.Spk){
      gfx.beginPath();
      for(var j = 0; j<=36;j++){
        var angle = j*2*Math.PI/36-Math.PI/2;
        var rad = (j%2==0) ? radius*3/2 : radius;
        gfx.lineTo(centerX + rad*Math.cos(angle),centerY + rad*Math.sin(angle));
      }
      gfx.fillStyle= '#000000';
      gfx.fill();
      gfx.closePath();
    }

    //Eliminate some of the hardCoded numbers when we add client-side config
    var fraction = player.health/(25*player.tier + 100);
    var color = '#00ff00';
    var red = Math.round(Math.max(0,(1-3*fraction)*255)).toString(16);
    if(red.length==1)
      red = '0'+red;
    var green = Math.round(fraction*200).toString(16);
    if(green.length==1)
      green = '0'+green;
    var blue = '00';
    color = '#'+red+green+blue;


    gfx.fillStyle = color;

    
    gfx.textAlign = 'center';
    //Health total & Bar
    gfx.font = '12px Verdana';
    gfx.fillText(player.health, centerX +  1.1*radius, centerY+(player.Spk ? radius*1.8 : radius*1.4));

    gfx.lineWidth = 10;
    gfx.strokeStyle = color;
    gfx.beginPath();
    gfx.moveTo(centerX- radius ,centerY + (player.Spk ? radius*1.7 : radius*1.3) );
    gfx.lineTo(centerX + 0.8*radius*(2*fraction-1) - 0.2*radius,centerY + (player.Spk ? radius*1.7 : radius*1.3) );
    gfx.stroke();
    gfx.closePath();

    //name
    gfx.font = '20px Verdana';
    gfx.fillStyle = "#888888";
    gfx.fillText(player.name, centerX, centerY-(player.Spk ? radius*1.8 : radius*1.3));
    
  
    gfx.strokeStyle = '#000000';
    gfx.beginPath();
    gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.fill();
    gfx.closePath();
    //gfx.fillStyle = '#2ecc71';


    gfx.lineWidth = 5;
    
    //rotate gun
    var mag = Math.sqrt(
      player.mCd.x * player.mCd.x +
      player.mCd.y * player.mCd.y
    );
    var dir = {x: player.mCd.x/mag, y: player.mCd.y/mag};
    gfx.beginPath();
    gfx.moveTo(centerX+radius/0.8*dir.x, centerY+radius/0.8*dir.y);
    gfx.lineTo(centerX, centerY);
    gfx.stroke();
    gfx.closePath();

    gfx.beginPath();
    gfx.lineWidth = 11;
    gfx.moveTo(centerX+radius/1.5*dir.x, centerY+radius/1.5*dir.y);
    gfx.lineTo(centerX, centerY);gfx.stroke();
    gfx.closePath();


    //treads
    var speed = Math.sqrt(player.v.x*player.v.x + player.v.y*player.v.y);
    var mvDir = {x:1,y:0};
    if(speed>0.3)
        mvDir = {x:player.v.x/speed, y:player.v.y/speed};

    /*
    gfx.beginPath();
    gfx.lineCap='round';
    gfx.moveTo(centerX-radius*.9*mvDir.x - radius*.4*mvDir.y, centerY -radius*.9*mvDir.y + radius*.4*mvDir.x);
    gfx.lineTo(centerX-radius*.9*mvDir.x + radius*.4*mvDir.y, centerY- radius*.9*mvDir.y - radius*.4*mvDir.x);
    gfx.moveTo(centerX-radius*mvDir.x - radius*.5*mvDir.y, centerY -radius*mvDir.y + radius*.5*mvDir.x);
    gfx.lineTo(centerX-radius*mvDir.x + radius*.5*mvDir.y, centerY- radius*mvDir.y - radius*.5*mvDir.x);
    gfx.stroke();
    gfx.closePath();
    
    gfx.beginPath();
    gfx.moveTo(centerX+radius*1.1*mvDir.x, centerY +radius*1.1*mvDir.y );
    gfx.lineTo(centerX+radius*1.1*mvDir.x - radius*.5*(mvDir.y + mvDir.x), centerY + 1.1*radius*mvDir.y - radius*.5*(mvDir.y - mvDir.x));
    gfx.moveTo(centerX+radius*1.1*mvDir.x, centerY + radius*1.1*mvDir.y);
    gfx.lineTo(centerX+radius*1.1*mvDir.x - radius*.5*(-mvDir.y + mvDir.x), centerY + 1.1*radius*mvDir.y - radius*.5*(mvDir.y + mvDir.x));
    gfx.stroke();
    gfx.closePath();
   */



    gfx.lineWidth = 7;
    gfx.beginPath();
    gfx.arc(centerX, centerY, 5, 0, 2*Math.PI, false);
    gfx.stroke();
    gfx.fillStyle = "#000000";
    gfx.fill();
    gfx.closePath();

    
   
    //reset to default
    gfx.lineWidth = 5;
    gfx.fillStyle = "#00ff00";
    gfx.lineCap = "square";
  }

}

function drawPowerups(gfx){
  // powerups
  for (var i=0; i<nearbyPowerups.length; i++) {
    var powerup = nearbyPowerups[i];
    var centerX = screenWidth/2 + powerup.pos.x;
    var centerY = screenHeight/2 + powerup.pos.y;
    var radius = 20;
    radius*= 1+0.15*Math.sin(2*Math.PI*oscillateStep/numOscillateSteps);//precompute these?
    
    //gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
    //gfx.stroke();

    var powerupImg = getPowerupIcon(powerup.type);
    gfx.beginPath();
    gfx.drawImage(powerupImg, centerX - radius , centerY - radius,2*radius,2*radius);
    gfx.closePath();
  }
}
function drawProjectiles(gfx){
  gfx.lineWidth = 1;
  gfx.strokeStyle = '#003300';
  for (var i=0; i<nearbyProjectiles.length; i++) {
    var projectile = nearbyProjectiles[i];
    var centerX = screenWidth/2 + projectile.pos.x;
    var centerY = screenHeight/2 + projectile.pos.y;
    if (projectile.type == "bullet") {
      var radius = 5;
      gfx.beginPath();
      gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
      gfx.stroke();
      gfx.closePath();
    } else if (projectile.type == "sniperBullet") {
      var radius = 5;
      gfx.beginPath();
      gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
      gfx.fillStyle = "#003300";
      gfx.fill();
      gfx.closePath();
    } else if (projectile.type == "rocket"){
      var radius;
      if (projectile.isExploded) {
        radius = 120;
        gfx.fillStyle = "#FF0000";
      } else {
        radius = 20;
        gfx.fillStyle = "#000000";
      }
      gfx.beginPath();
      gfx.arc(centerX, centerY, radius, 0, 2*Math.PI, false);
      gfx.fill();
      gfx.closePath();
    }
  }


}
function drawObstacles(gfx){
  gfx.strokeStyle = "#003300";
  gfx.lineWidth=5;
   for(var i=0; i<nearbyObstacles.length; i++) {
    var segment = nearbyObstacles[i];
    var x1 = segment.pt1.x + screenWidth/2;
    var y1 = segment.pt1.y + screenHeight/2;
    var x2 = segment.pt2.x + screenWidth/2;
    var y2 = segment.pt2.y + screenHeight/2;
    gfx.beginPath();
    gfx.moveTo(x1,y1);
    gfx.lineTo(x2,y2);
    gfx.stroke();
    gfx.closePath();
  }

}
function getPowerupIcon(type) {
  switch(type) {
    case "bullet": return bulletImg;
    case "sniperBullet": return sniperImg;
    case "rocket": return rocketImg;
    case "healthpack": return healthpackImg;
    case "spike": return spikeImg;
    case "fast": return fastImg;
    case "heart": return heartImg;
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
    gfx.lineWidth = 1;
  }
}
function drawForeground(gfx){
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
  if(!onLeaderboard && myStats){
    gfx.fillStyle = 'red';
    gfx.textAlign = 'left';
    gfx.fillText(myStats.name,startTable.x,startTable.y+(leaderboard.length+1)*leaderboardOffset.y);
    gfx.textAlign = 'right';
    gfx.fillText(myStats.score,startTable.x+2*leaderboardOffset.x,startTable.y+(leaderboard.length+1)*leaderboardOffset.y);
  }
  gfx.stroke();
}
function drawAmmo(gfx) {
  gfx.strokeStyle = "#000000";
  gfx.fillStyle = "#000000";
  gfx.font = "16px Verdana";


  gfx.lineWidth =1;


  gfx.beginPath();
  gfx.rect(screenWidth - 120, screenHeight - 40, 25, 25);
  gfx.drawImage(bulletImg, screenWidth - 120 , screenHeight - 40, 25, 25);
  var offset = 0;
  if (ammo.toString().length == 1) {
    offset = 10;
  } // this makes the ammo count appear next to the icon.  TODO is there a better way?
  gfx.fillText(ammo, screenWidth-72-offset, screenHeight-15);
  gfx.rect(screenWidth - 60, screenHeight - 40, 25, 25);
  var specialWeaponImg = getPowerupIcon(specialWeapon);
  gfx.drawImage(specialWeaponImg, screenWidth - 60 , screenHeight - 40, 25, 25);
  gfx.fillText(specialAmmo, screenWidth - 22, screenHeight - 15);
  gfx.closePath();

  gfx.stroke();
  //gfx.asdf
}

function updateOscillate(){
  oscillateStep = (oscillateStep+1)%numOscillateSteps;
}

var cycleLength = 3;
setInterval(updateOscillate, cycleLength*1000/numOscillateSteps);


Game.prototype.handleGraphics = function(gfx,mouse) {
  // This is where you draw everything
  var grd=gfx.createRadialGradient(
    -myAbsoluteCoord.x+screenWidth/2,
    -myAbsoluteCoord.y+screenHeight/2,
    0,
    -myAbsoluteCoord.x+screenWidth/2,
    -myAbsoluteCoord.y+screenHeight/2,
    2*ARENA_RADIUS
  );
  grd.addColorStop(1,"#B8B8B8");
  grd.addColorStop(0,"#FFFFFF");

  // Fill with gradient
  gfx.fillStyle=grd;
  gfx.fillRect(0, 0, screenWidth, screenHeight);



  drawObjects(gfx);
  drawBoundary(gfx);
  drawForeground(gfx);
  drawAmmo(gfx);
}