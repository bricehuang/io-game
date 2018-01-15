var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);
var util    = require('./lib/util');

var config  = require('./config.json');
var players = new Map();

var powerups = new Map();

var bullets = new Map();
var nextBulletID = 0;
var nextPowerupID = 0;


app.use(express.static(__dirname + '/../client'));


io.on('connection', function (socket) {
  console.log("Somebody connected!");
  // Write your code here
  nextId = players.size;
  currentPlayer = {
    name:config.DEFAULT_NAME,
    x:0,
    y:0,
    socket:socket,
    windowHeight : config.DEFAULT_WINDOW_HEIGHT,
    windowWidth  : config.DEFAULT_WINDOW_WIDTH,
    id : nextId,
    target  : {x:0,y:0},
    velocity: {x:0,y:0},
    radius: config.PLAYER_RADIUS,
    health: config.PLAYER_MAX_HEALTH,
  }
  spawnPlayer(currentPlayer);
  spawnPowerup();
  players.set(socket.id,currentPlayer);

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
      timeLeft: config.BULLET_AGE,
      radius: config.BULLET_RADIUS,
      id: nextBulletID++,
    }
    bullets.set(newBullet.id,newBullet);
  })

  socket.on('disconnect', function(){
    console.log('user disconnected');
    // remove currentPlayer from players registry
    // TODO replace this when players gets set-ified
    players.delete(currentPlayer.socket.id);
  })

});


function collisionDetect(){
  for(var key1 of players.keys())
  {
    for(var key2 of players.keys())
    {
      var dx = players.get(key1).x - players.get(key2).x;
      var dy = players.get(key1).y - players.get(key2).y;
      var dist = Math.sqrt(dx*dx+dy*dy);

      if(dist< 2*config.PLAYER_RADIUS && key1<key2)

      {
        var v1_x = players.get(key1).velocity.x;
        var v1_y = players.get(key1).velocity.y;
        var v2_x = players.get(key2).velocity.x;
        var v2_y = players.get(key2).velocity.y;
        var impulse = (dx*(v2_x-v1_x)+dy*(v2_y-v1_y))/(dx*dx+dy*dy);

        players.get(key1).velocity.x = v1_x + impulse * dx;
        players.get(key1).velocity.y = v1_y + impulse * dy;
        players.get(key2).velocity.x = v2_x - impulse * dx;
        players.get(key2).velocity.y = v2_y - impulse * dy;
        players.get(key1).health -= config.BODY_COLLISION_DAMAGE;
        players.get(key2).health -= config.BODY_COLLISION_DAMAGE;



      }
    }
  }
  for(var key1 of players.keys()){
    for(var key2 of bullets.keys()){
      var player = players.get(key1);
      var bullet = bullets.get(key2);
      if(util.collided(player,bullet,config.EPS)){
        registerPlayerBulletHit(player,bullet);
      }
    }
  }
  for(var key1 of players.keys()){
    for(var key2 of powerups.keys()){
      var player = players.get(key1);
      var powerup = powerups.get(key2);
      if(util.collided(player,powerup,config.EPS)){
        registerPlayerPowerupHit(player,powerup);
      }
    }
  }
}
function registerPlayerBulletHit(player, bullet){
  console.log("Player Bullet Collision!");
  player.health-=config.BULLET_COLLISION_DAMAGE;
  bullets.delete(bullet.id);
  return;
}
function registerPlayerPowerupHit(player, powerup){
  console.log("Player Powerup Collision!");
  powerups.delete(powerup.id);
  return;
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
  return {x:r*Math.cos(answer), y:r*Math.sin(answer)};
}

function spawnPlayer(player){

  var numPlayers = players.size;
  var nextCoords = util.uniformCircleGenerate(config.MAP_RADIUS,players);

  player.x = nextCoords.x;
  player.y = nextCoords.y;
  player.target = nextCoords;
  console.log("Player spawned at " + JSON.stringify(nextCoords));
}
function spawnPowerup(){
  var r = config.MAP_RADIUS;
  var pos = util.gaussianCircleGenerate(r,0.01,0.00001);
  var type = config.WEAPON_TYPES[Math.floor(Math.random()*config.WEAPON_TYPES.length)];

  var nextPowerup = {
    type:type,
    x:pos.x,
    y:pos.y,
    radius:config.POWERUP_RADIUS,
    id:nextPowerupID++,
  }

  //console.log("Powerup spawned " + JSON.stringify(nextPowerup));
  powerups.set(nextPowerup.id,nextPowerup);
}

function movePlayer(player){
  var vx = player.velocity.x;
  var vy = player.velocity.y;

  var speedBeforeFricton = Math.sqrt(vx*vx+vy*vy);
  if(speedBeforeFricton>0){
    vx -= (vx/speedBeforeFricton)*config.FRICTION;
    vy -= (vy/speedBeforeFricton)*config.FRICTION;
  }
  var speed = Math.sqrt(vx*vx+vy*vy);
  if (speed > config.PLAYER_SPEED_LIMIT) {
    vx *= config.PLAYER_SPEED_LIMIT/speed;
    vy *= config.PLAYER_SPEED_LIMIT/speed;
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
  if (distFromCenter > config.ARENA_RADIUS-config.PLAYER_RADIUS) {
    player.x *= ( (config.ARENA_RADIUS-config.PLAYER_RADIUS)/distFromCenter);
    player.y *= ( (config.ARENA_RADIUS-config.PLAYER_RADIUS)/distFromCenter);
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
  var changeX = bullet.xHeading * config.BULLET_SPEED;
  var changeY = bullet.yHeading * config.BULLET_SPEED;
  bullet.x += changeX;
  bullet.y += changeY;
  bullet.timeLeft -= 1;
  var isAlive = (bullet.timeLeft > 0 && util.distance(bullet, {x:0, y:0}) <= config.ARENA_RADIUS)
  return isAlive;
}
function moveAllBullets() {
  for(var key of bullets.keys()){
    bullet = bullets.get(key);
    if(!moveBullet(bullet)){
      bullets.delete(key);
    }
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
  for(var key of players.keys())
  {
    var relX = players.get(key).x - player.x;
    var relY = players.get(key).y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2)
    {
      var current = {name:players.get(key).name, x:relX, y: relY, health: players.get(key).health};
      allPlayers.push(current);
    }
  }
  var allPowerups = [];
  for(var key of powerups.keys()){
    var relX = powerups.get(key).x - player.x;
    var relY = powerups.get(key).y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2)
    {
      var current = {name:powerups.get(key).type, x:relX, y: relY};
      allPowerups.push(current);
    }
  }
  var nearbyBullets = [];
  for (var key of bullets.keys()) {
    var relX = bullets.get(key).x - player.x;
    var relY = bullets.get(key).y - player.y;
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

  for(var key of players.keys()){
    movePlayer(players.get(key));
    sendView(players.get(key));
  }
  moveAllBullets();
}
var updateRate = 60;
setInterval(moveLoops, 1000 / updateRate);
setInterval(collisionDetect, 1000 / updateRate);
setInterval(spawnPowerup,1000/5);
