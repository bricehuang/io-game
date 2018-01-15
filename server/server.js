var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var util    = require('./lib/util');

var config  = require('./config.json');
var players = [];

var powerups = [];

var bullets = [];


app.use(express.static(__dirname + '/../client'));

var ARENA_RADIUS = 1500;
var BULLET_AGE = 60;
var BULLET_SPEED = 10;
var PLAYER_SPEED_LIMIT = 8;
var FRICTION = 0.1;
var playerRadius = 30;

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
    velocity: {x:0,y:0},
  }
  spawnPlayer(currentPlayer);
  spawnPowerup();
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
    currentPlayer.velocity.x += message.x;
    currentPlayer.velocity.y += message.y;
  });





  socket.on('window_resized', function(dimensions){
    currentPlayer.windowWidth = dimensions.windowWidth;
    currentPlayer.windowHeight = dimensions.windowHeight;
  })

  socket.on('fire', function(vector){
    var length = Math.sqrt(vector.x*vector.x + vector.y*vector.y);
    var normalizedVector = {x: vector.x/length, y: vector.y/length};
    newBullet = {
      x: currentPlayer.x + normalizedVector.x*40,
      y: currentPlayer.y + normalizedVector.y*40,
      xHeading: normalizedVector.x,
      yHeading: normalizedVector.y,
      timeLeft: BULLET_AGE,
    }
    bullets.push(newBullet);
  })

});


function collisionDetect(){
  for(var i = 0; i<players.length; i++)
  {
    for(var j=i+1; j<players.length; j++)
    {
      var dx = players[i].x - players[j].x;
      var dy = players[i].y - players[j].y;
      var dist = Math.sqrt(dx*dx+dy*dy);
      if(dist< 2*playerRadius)
      {
        var v1_x = players[i].velocity.x;
        var v1_y = players[i].velocity.y;
        var v2_x = players[j].velocity.x;
        var v2_y = players[j].velocity.y;
        var impulse = (dx*dx+dy*dy)/(dx*(v2_x-v1_x)+dy*(v2_y-v1_y)+.000001);
        players[i].velocity.x = v1_x + impulse * dx;
        players[i].velocity.y = v1_y + impulse * dy;
        players[j].velocity.x = v2_x - impulse * dx;
        players[j].velocity.y = v2_y - impulse * dy;


      }
    }
  }

}



function sign(x){
  if(x >=0)
    return 1;
  else
    return -1;
}

//reflect vector x1,y1 about vector x2,y2
function reflect(x1,y1,x2,y2)
{
  var a1 = Math.atan2(y1,x1);

  var a2 = Math.atan2(y2,x2);
  var answer = 2*a2-a1;
  var r = Math.sqrt(x1*x1+y1*y1);
  console.log(x1+" "+y1);
  console.log(a1);
  console.log(a2);
  console.log(answer);
  return {x:r*Math.cos(answer), y:r*Math.sin(answer)};
}

function spawnPlayer(player){
  var numPlayers = players.length;
  var nextCoords = util.uniformCircleGenerate(config.mapRadius,players);
  player.x = nextCoords.x;
  player.y = nextCoords.y;
  player.target = nextCoords;
  console.log("Player spawned at " + JSON.stringify(nextCoords));
}
function spawnPowerup(){
  var r = config.mapRadius;
  var pos = util.gaussianCircleGenerate(r,0.01,0.00001);
  var type = config.weaponTypes[Math.floor(Math.random()*config.weaponTypes.length)];
  
  var nextPowerup = {
    type:type,
    x:pos.x,
    y:pos.y,
  }

  console.log("Powerup spawned " + JSON.stringify(nextPowerup));
  powerups.push(nextPowerup);
}

function movePlayer(player){
  var vx = player.velocity.x;
  var vy = player.velocity.y;

  var speedBeforeFricton = Math.sqrt(vx*vx+vy*vy);
  if(speedBeforeFricton>0){
    vx -= (vx/speedBeforeFricton)*FRICTION;
    vy -= (vy/speedBeforeFricton)*FRICTION;
  }
  var speed = Math.sqrt(vx*vx+vy*vy);
  if (speed > PLAYER_SPEED_LIMIT) {
    vx *= PLAYER_SPEED_LIMIT/speed;
    vy *= PLAYER_SPEED_LIMIT/speed;
  }

  player.velocity.x = vx;
  player.velocity.y = vy;

  player.x += player.velocity.x;
  player.y += player.velocity.y;

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
  */

  //Move to boundary if outside
  var distFromCenter = util.distance({x: player.x, y:player.y}, {x:0, y:0});
  if (distFromCenter > ARENA_RADIUS-playerRadius) {
    player.x *= ( (ARENA_RADIUS-playerRadius)/distFromCenter);
    player.y *= ( (ARENA_RADIUS-playerRadius)/distFromCenter);
    newVelocity = reflect(player.velocity.x,player.velocity.y, -player.y, player.x);
    player.velocity.x = newVelocity.x;
    player.velocity.y = newVelocity.y;
    player.x+=player.velocity.x;
    player.y+=player.velocity.y;
  }


  //player.target.x = player.x;
  //player.target.y = player.y;

}

function moveBullet(bullet){
  // moves a bullet, and returns whether the bullet is still alive
  // (i.e. has not run out of time or escaped the arena)
  var changeX = bullet.xHeading * BULLET_SPEED;
  var changeY = bullet.yHeading * BULLET_SPEED;
  bullet.x += changeX;
  bullet.y += changeY;
  bullet.timeLeft -= 1;
  var isAlive = (bullet.timeLeft > 0 && util.distance(bullet, {x:0, y:0}) <= ARENA_RADIUS)
  return isAlive;
}
function moveAllBullets() {
  var indicesOfDeadBullets = [];
  for (var i=0; i<bullets.length; i++) {
    bullet = bullets[i];
    if (!moveBullet(bullet)) {
      indicesOfDeadBullets.push(i);
    }
  }
  // remove dead bullets
  for (var j=indicesOfDeadBullets.length-1; j>=0; j--) {
    bullets.splice(indicesOfDeadBullets[j], 1);
  }
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
  var allPowerups = [];
  for(var i = 0;i<powerups.length;i++){
    var relX = powerups[i].x - player.x;
    var relY = powerups[i].y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2)
    {
      var current = {name:powerups[i].type, x:relX, y: relY};
      allPowerups.push(current);
    }
  }
  var nearbyBullets = [];
  for (var i=0; i<bullets.length; i++) {
    var relX = bullets[i].x - player.x;
    var relY = bullets[i].y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2) {
      var current = {x:relX, y: relY};
      nearbyBullets.push(current);
    }
  }

  player.socket.emit(
    'game_state',
    {
      my_absolute_coord: {x: player.x, y:player.y},
      nearby_powerups: allPowerups,
      nearby_players: allPlayers,
      nearby_bullets: nearbyBullets,
    }
  );
}
function moveLoops(){
  for(var i = 0;i<players.length;i++){
    movePlayer(players[i]);
    sendView(players[i]);
  }
  moveAllBullets();
}
var updateRate = 60;
setInterval(moveLoops, 1000 / updateRate);
setInterval(collisionDetect, 1000 / updateRate);
setInterval(spawnPowerup,1000/5);
