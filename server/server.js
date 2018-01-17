var express = require('express');
var app     = express();
var http    = require('http').Server(app);
var io      = require('socket.io')(http);

var config  = require('./config.json');
var util    = require('./lib/util');
var obj     = require('./lib/objects');

var players = new Map();
var powerups = new Map();
var projectiles = new Map();
var nextProjectileID = 0;
var nextPowerupID = 0;
var leaderboard = [];

var numObstacles = 10;
var obstacles=[];

generateObstacles();


app.use(express.static(__dirname + '/../client'));




io.on('connection', function (socket) {
  console.log("Somebody connected!");
  // Write your code here
  // nextId = players.size;
  currentPlayer = {
    name:config.DEFAULT_NAME,
    x:0,
    y:0,
    socket:socket,
    windowHeight : config.DEFAULT_WINDOW_HEIGHT,
    windowWidth  : config.DEFAULT_WINDOW_WIDTH,
    id: socket.id,
    target  : {x:0,y:0},
    velocity: {x:0,y:0},
    acceleration: {x:0, y:0},
    radius: config.PLAYER_RADIUS,
    health: config.PLAYER_START_HEALTH,
    maxHealth: config.PLAYER_MAX_HEALTH,
    kills: 0,
    lastfire: -1,
    lastCollision: -1,
    ammo: config.STARTING_AMMO,
    sniperAmmo: 0
  }
  
  spawnPlayer(currentPlayer);
  spawnPowerup();
  players.set(socket.id,currentPlayer);

  socket.on('playerInformation', function(data){
    player = players.get(socket.id);
    if (!player) return;
    player.name         = data.name;
    player.windowWidth  = data.windowWidth;
    player.windowHeight = data.windowHeight;
  });

  socket.on('move', function(message){
    player = players.get(socket.id);
    if (!player) return;
    var acceleration = {x:0, y:0};
    if (message[0]) {acceleration.x -= 1};
    if (message[1]) {acceleration.y -= 1};
    if (message[2]) {acceleration.x += 1};
    if (message[3]) {acceleration.y += 1};
    var magnitude = util.magnitude(acceleration);
    if (magnitude > 0) {
      acceleration.x *= config.ACCELERATION_MAGNITUDE/magnitude;
      acceleration.y *= config.ACCELERATION_MAGNITUDE/magnitude;
    }
    player.acceleration = acceleration;
  });

  socket.on('windowResized', function(dimensions){
    player = players.get(socket.id);
    if (!player) return;
    player.windowWidth = dimensions.windowWidth;
    player.windowHeight = dimensions.windowHeight;
  })

  socket.on('fire', function(vector){
    player = players.get(socket.id);
    if (!player) return;
    if (Date.now() - player.lastfire > config.FIRE_COOLDOWN_MILLIS && player.ammo>0) {
      var length = util.magnitude(vector);
      var normalizedVector = {x: vector.x/length, y: vector.y/length};
      var bullet = new obj.Bullet(
        nextProjectileID++,
        socket.id,
        player.x + normalizedVector.x*30,
        player.y + normalizedVector.y*30,
       // player.x + normalizedVector.x*40,
        //player.y + normalizedVector.y*40,
        normalizedVector.x,
        normalizedVector.y
      )
      projectiles.set(bullet.id, bullet);
      player.lastfire = Date.now();
      player.ammo--;
    }
  })

  socket.on('fireSniper', function(vector){
    player = players.get(socket.id);
    if (!player) return;
    if (Date.now() - player.lastfire > config.FIRE_COOLDOWN_MILLIS && player.sniperAmmo>0) {
      var length = util.magnitude(vector);
      var normalizedVector = {x: vector.x/length, y: vector.y/length};
      var sniperBullet = new obj.SniperBullet(
        nextProjectileID++,
        socket.id,
        player.x + normalizedVector.x*30,
        player.y + normalizedVector.y*30,
        normalizedVector.x,
        normalizedVector.y
      )
      projectiles.set(sniperBullet.id, sniperBullet);
      player.lastfire = Date.now();
      player.sniperAmmo--;
    }
  })

  socket.on('pingcheck', function() {
    console.log('I was pinged!');
    socket.emit('pongcheck');
  })

  socket.on('disconnect', function(){
    console.log('user disconnected');
    if (players.has(socket.id)) {
      players.delete(socket.id);
    }
  })
});


function newObstacle(){
  check = false
  while(!check)
  {

    var angle1 = 2*Math.PI*Math.random();
    var r1 = 0.9*config.MAP_RADIUS*Math.sqrt(Math.random());
    var angle2 = 2*Math.PI/5*Math.random() + angle1;
    var r2 = 0.9*config.MAP_RADIUS*Math.sqrt(Math.random());
    var x1 = r1*Math.cos(angle1);
    var y1 = r1*Math.sin(angle1);
    var x2 = r2 * Math.cos(angle2);
    var y2 = r2 * Math.sin(angle2);
    var segment = {point1:{x:x1, y: y1}, point2: {x:x2,y:y2}};
    if(util.distance(segment.point1,segment.point2)<config.MAP_RADIUS && util.distance(segment.point1,segment.point2)>10*config.PLAYER_RADIUS)
            check = true;

  }

    return segment;
}


function generateObstacles(){
  var counter = 0;
  for(var i = 0 ; i<numObstacles; i++)
  {
    counter++;
    if(i==0)
    {
      var segment = newObstacle();
      obstacles.push(segment);
    }
    else {
      startNew = Math.random();
      if(startNew>0.4) {
          var segment = newObstacle();
          segment.point1.x = obstacles[i-1].point2.x;
          segment.point1.y = obstacles[i-1].point2.y;
          var good = true;

          //Make sure new segment isn't too small
          if(util.distance(segment.point1,segment.point2)<10*config.PLAYER_RADIUS)
            good = false
          else{
            //Make sure angle isnt too small
            var minAngle = 1.2;
            angle1 = Math.atan2(obstacles[i-1].point1.y-obstacles[i-1].point2.y, obstacles[i-1].point1.x-obstacles[i-1].point2.x);
            angle2 = Math.atan2(segment.point2.y-obstacles[i-1].point2.y, segment.point2.x-obstacles[i-1].point2.x);
            if(Math.abs(angle1-angle2) < minAngle)
              good = false;

            //Check all Intersections
            else{
              for(var j=0; j<i-1; j++){
                if(util.segmentIntersect(segment,obstacles[j]))
                  good = false;
              }
            }
          }
          if(good){
            obstacles.push(segment);
            //console.log(segment);
          }

          else
            i--;

      }

      else{

          var segment = newObstacle();
          var good = true;
          for(var j=0; j<i; j++)
          {
              if(util.segmentIntersect(segment,obstacles[j]))
                good = false;
          }
          if(good){
            obstacles.push(segment);
            //console.log(segment);
          }
          else
           i--;
      }

    }
  }


}

function collisionDetect(){
  for (var key1 of players.keys()) {
    for (var key2 of players.keys()) {
      var dx = players.get(key1).x - players.get(key2).x;
      var dy = players.get(key1).y - players.get(key2).y;
      var dist = util.magnitude({x:dx, y:dy});

      if (dist< 2*config.PLAYER_RADIUS && key1<key2) {
        var v1_x = players.get(key1).velocity.x;
        var v1_y = players.get(key1).velocity.y;
        var v2_x = players.get(key2).velocity.x;
        var v2_y = players.get(key2).velocity.y;
        var impulse = (dx*(v2_x-v1_x)+dy*(v2_y-v1_y))/(dx*dx+dy*dy);
        if (Math.abs(impulse)<.05) {
          impulse = .05;
        }
        players.get(key1).velocity.x = v1_x + impulse * dx;
        players.get(key1).velocity.y = v1_y + impulse * dy;
        players.get(key2).velocity.x = v2_x - impulse * dx;
        players.get(key2).velocity.y = v2_y - impulse * dy;
        var firstAlive = (players.get(key1).health>0);
        var secondAlive = (players.get(key2).health>0);
        players.get(key1).health -= config.BODY_COLLISION_DAMAGE;
        players.get(key2).health -= config.BODY_COLLISION_DAMAGE;
        if(players.get(key1).health<=0 && firstAlive){
          players.get(key2).kills++;
        }
        if(players.get(key2).health<=0 && secondAlive){
          players.get(key1).kills++;
        }
      }
    }
  }
  for (var key1 of players.keys()) {
    for (var key2 of projectiles.keys()) {
      var player = players.get(key1);
      var projectile = projectiles.get(key2);
      if (player && projectile && util.collided(player,projectile,config.EPS)) {
        registerPlayerProjectileHit(player,projectile);
      }
    }
  }
  for (var key1 of players.keys()) {
    for (var key2 of powerups.keys()) {
      var player = players.get(key1);
      var powerup = powerups.get(key2);
      if (player && powerup && util.collided(player,powerup,config.EPS)) {
        registerPlayerPowerupHit(player,powerup);
      }
    }
  }

  for(var i=0; i<numObstacles; i++)
  {
    for(var key of players.keys()){
      var player = players.get(key);
      if (player && util.pointLineDistance({x:player.x, y:player.y}, obstacles[i]).trueDist < config.PLAYER_RADIUS)
        registerPlayerWallHit(player,obstacles[i]);

    }
  }



}


function registerPlayerWallHit(player, wall){

  if(Date.now()- player.lastCollision > 200){
  var hitType = util.pointLineDistance({x:player.x, y:player.y}, wall);
  if(hitType.endpoint){
    var wallVector;
    if(hitType.index ==1){
      wallVector = {x: wall.point2.x - wall.point1.x, y:wall.point2.y - wall.point1.y };
    }
    else{
        wallVector = {x: wall.point1.x - wall.point2.x, y:wall.point1.y - wall.point2.y };
    }

    if(util.dotProduct(wallVector, player.velocity) > 0.25*util.magnitude(wallVector)*util.magnitude(player.velocity) )
    {
       var newVelocity = reflect(player.velocity.x, player.velocity.y, 
        wall.point2.y - wall.point1.y, wall.point1.x - wall.point2.x);
       newVelocity.x -= wallVector.x/util.magnitude(wallVector);
       newVelocity.y -= wallVector.y/util.magnitude(wallVector);

    }
    else{
      var newVelocity = reflect(player.velocity.x, player.velocity.y, 
        wall.point2.x - wall.point1.x, wall.point2.y - wall.point1.y);
    }
    
    player.velocity.x = newVelocity.x;
    player.velocity.y = newVelocity.y;
    
   
  }
  else{
    var newVelocity = reflect(player.velocity.x, player.velocity.y,
      wall.point2.x - wall.point1.x, wall.point2.y - wall.point1.y);
    player.velocity.x = newVelocity.x;
    player.velocity.y = newVelocity.y;

  }
  player.x+=player.velocity.x;
  player.y+=player.velocity.y;
  player.lastCollision = Date.now();
  }
}

function registerPlayerProjectileHit(player, projectile){
  var wasAlive = (player.health>0);
  if (projectile.type == "bullet"){
    player.health -= config.BULLET_COLLISION_DAMAGE;
  } else if (projectile.type == "sniperBullet") {
    player.health -= config.SNIPER_BULLET_DAMAGE;
  }
  projectiles.delete(projectile.id);
  if (player.health <= 0 && wasAlive) {
    var shooterPlayer = players.get(projectile.corrPlayerID);
    if (shooterPlayer) { // make sure shooterPlayer isn't already dead
      shooterPlayer.kills++;
    }
  }
  return;
}
function registerPlayerPowerupHit(player, powerup){
  if (powerup.type == "healthpack") {
    player.health = Math.min(
      player.health + config.HEALTHPACK_HP_GAIN, player.maxHealth
    );
  } else if (powerup.type == "ammo"){
    player.ammo = Math.min(
      player.ammo + config.AMMO_POWERUP_BULLETS, config.MAX_AMMO
    );
  } else if (powerup.type == "sniperAmmo") {
    player.sniperAmmo = Math.min(
      player.sniperAmmo + config.SNIPER_AMMO_POWERUP_BULLETS, config.MAX_SNIPER_AMMO
    );
  }
  powerups.delete(powerup.id);
  return;
}

function sign(x){
  return (x >= 0) ? 1 : -1;
}

//reflect vector x1,y1 about vector x2,y2
function reflect(x1,y1,x2,y2) {
  var a1 = Math.atan2(y1,x1);

  var a2 = Math.atan2(y2,x2);
  var answer = 2*a2-a1;
  var r = util.magnitude({x:x1, y:y1});
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
  if (powerups.size >= config.MAX_POWERUPS) {return; }
  var r = config.MAP_RADIUS;
  var pos = util.gaussianCircleGenerate(r,0.1,0.00001);
  var type = config.POWERUP_TYPES[Math.floor(Math.random()*config.POWERUP_TYPES.length)];

  var nextPowerup = {
    type:type,
    x:pos.x,
    y:pos.y,
    radius:config.POWERUP_RADIUS,
    id:nextPowerupID++,
  }

  powerups.set(nextPowerup.id,nextPowerup);
}

function movePlayer(player){
  var vx = player.velocity.x + player.acceleration.x;
  var vy = player.velocity.y + player.acceleration.y;

  var speedBeforeFricton = util.magnitude({x:vx, y:vy});
  if(speedBeforeFricton>0){
    vx -= (vx/speedBeforeFricton)*config.FRICTION;
    vy -= (vy/speedBeforeFricton)*config.FRICTION;
  }
  var speed = util.magnitude({x:vx, y:vy});
  if (speed > config.PLAYER_SPEED_LIMIT) {
    vx *= config.PLAYER_SPEED_LIMIT/speed;
    vy *= config.PLAYER_SPEED_LIMIT/speed;
  }

  player.velocity.x = vx;
  player.velocity.y = vy;

  player.x += player.velocity.x;
  player.y += player.velocity.y;

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
}

function moveProjectile(projectile){
  // moves a projectile, and returns whether the projectile is still alive
  // (i.e. has not run out of time or escaped the arena)

  var isAlive = (projectile.timeLeft > 0 && util.magnitude(projectile) <= config.ARENA_RADIUS)
  for(var i=0; i<numObstacles; i++)
  {
    if(util.pointLineDistance({x:projectile.x, y:projectile.y}, obstacles[i]).trueDist< 2*config.BULLET_RADIUS)
      isAlive = false;
  }
  if(isAlive)
    projectile.timeStep();
  return isAlive;

}
function moveAllProjectiles() {
  for(var key of projectiles.keys()){
    projectile = projectiles.get(key);
    if(!moveProjectile(projectile)){
      projectiles.delete(key);
    }
  }
}

function expelDeadPlayer(player) {
  players.delete(player.socket.id);
  player.socket.emit('death');
  // player.socket.disconnect();
}

function sendView(player) {
  var allPlayers = [];
  for (var key of players.keys()) {
    var otherPlayer = players.get(key);
    var relX = otherPlayer.x - player.x;
    var relY = otherPlayer.y - player.y;
    if (Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2) {
      var current = {name:otherPlayer.name, x:relX, y: relY, health: otherPlayer.health};
      allPlayers.push(current);
    }
  }
  var allPowerups = [];
  for (var key of powerups.keys()) {
    var powerup = powerups.get(key);
    var relX = powerup.x - player.x;
    var relY = powerup.y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2) {
      var current = {type:powerup.type, x:relX, y: relY};
      allPowerups.push(current);
    }
  }
  var nearbyProjectiles = [];
  for (var key of projectiles.keys()) {
    var projectile = projectiles.get(key);
    var relX = projectile.x - player.x;
    var relY = projectile.y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2) {
      var current = {x:relX, y:relY, type: projectile.type};
      nearbyProjectiles.push(current);
    }
  }


  var nearbyObstacles = [];
  for(var i=0; i<obstacles.length; i++) {
    var x1 = obstacles[i].point1.x - player.x;
    var y1 = obstacles[i].point1.y - player.y;
    var x2 = obstacles[i].point2.x - player.x;
    var y2 = obstacles[i].point2.y - player.y;
    var segment = {point1:{x:x1,y:y1}, point2: {x:x2,y:y2}};
    nearbyObstacles.push(segment);
  }


  player.socket.emit(
    'gameState',
    {
      myAbsoluteCoord: {x: player.x, y:player.y},
      nearbyPowerups: allPowerups,
      nearbyPlayers: allPlayers,
      nearbyObstacles: nearbyObstacles,
      nearbyProjectiles: nearbyProjectiles,
      globalLeaderboard : leaderboard,
      yourStats: {name:player.name, score:player.kills,id:player.id},
      ammo: player.ammo,
      sniperAmmo: player.sniperAmmo
    }
  );
}
function updateLeaderboard(){
  leaderboard = [];
  for(var key of players.keys()){
    player = players.get(key)
    leaderboard.push({name:player.name,score:player.kills, id:player.id,});
  }
  leaderboard.sort(function(a,b){return b.score-a.score});
  leaderboard = leaderboard.slice(0,Math.min(config.LEADERBOARD_SIZE,leaderboard.length));
}
function moveLoops(){
  moveAllProjectiles();
  collisionDetect();
  updateLeaderboard();
  for (var key of players.keys()) {
    movePlayer(players.get(key));
    sendView(players.get(key));
  }
  var keysOfPlayersToExpel = [];
  for (var key of players.keys()) {
    var player = players.get(key);
    if (player.health <= 0) {
      keysOfPlayersToExpel.push(key);
    }
  }
  if (keysOfPlayersToExpel.length > 0){
    console.log("expelling dead players: " + keysOfPlayersToExpel);
  }
  for (var i=0; i<keysOfPlayersToExpel.length; i++) {
    var player = players.get(keysOfPlayersToExpel[i]);
    expelDeadPlayer(player);
  }
}

var serverPort = process.env.PORT || config.port;
http.listen(serverPort, function() {
  console.log("Server is listening on port " + serverPort);
});

setInterval(moveLoops, 1000 / config.FRAME_RATE);
setInterval(spawnPowerup, 1000 / config.POWERUP_SPAWN_PER_SECOND);

