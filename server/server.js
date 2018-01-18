lobal.Buffer = global.Buffer || require("buffer").Buffer;

var express = require('express');
var BSON = require('bson');
var Long = BSON.Binary;
var bson = new BSON();

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
  for(var i = 0;i<config.POWERUPS_PER_PLAYER;i++) spawnPowerup();
  // Write your code here
  // nextId = players.size;

  var spawnPosition = findSpawnLocation();
  var currentPlayer = new obj.Player(socket, spawnPosition);

  players.set(socket.id, currentPlayer);

  socket.on('playerInformation', function(data){
    if (!(data && "name" in data && "windowDimensions" in data)) { return; }
    if (!("width" in data.windowDimensions && "height" in data.windowDimensions)) { return; }
    player = players.get(socket.id);
    if (!player) return;
    player.setName(data.name);
    player.setWindowDimensions(data.windowDimensions);
  });

  socket.on('move', function(message){
    if (!(Array.isArray(message) && message.length == 4)) { return; }
    player = players.get(socket.id);
    if (!player) { return; }
    var acceleration = {x:0, y:0};
    if (message[0]) {acceleration.x -= 1};
    if (message[1]) {acceleration.y -= 1};
    if (message[2]) {acceleration.x += 1};
    if (message[3]) {acceleration.y += 1};
    player.acceleration = util.scaleToLength(acceleration, player.accelerationMagnitude())
  });

  socket.on('mouseCoords', function(mouseCoords){
    if (!(mouseCoords && "x" in mouseCoords && "y" in mouseCoords)) { return; }
    player = players.get(socket.id);
    if (!player) return;
    player.setMouseCoords(mouseCoords);
  })

  socket.on('windowResized', function(dimensions){
    if (!(dimensions && "width" in dimensions && "height" in dimensions)) { return; }
    player = players.get(socket.id);
    if (!player) return;
    player.setWindowDimensions(dimensions);
  })

  socket.on('fire', function(vector){
    if (!(vector && "x" in vector && "y" in vector)) { return; }
    if (vector.x == 0 && vector.y == 0) { return; }
    player = players.get(socket.id);
    if (!player) return;
    if (player.canFireNow() && player.ammo > 0) {
      var heading = util.normalize(vector);
      var position = util.add(player.position, util.scale(heading, config.BULLET_TO_PLAYER_SPAWN_DIST));
      var bullet = new obj.Bullet(
        nextProjectileID++,
        socket.id,
        position,
        heading
      )
      projectiles.set(bullet.id, bullet);
      player.refreshFireTimestamp();
      player.ammo--;
    }
  })

  socket.on('continuousFire', function(tryFire){
    player = players.get(socket.id);
    if(!player) return;
    player.tryingContinuousFire = tryFire;
    return;
  })
  socket.on('fireSniper', function(vector){
    if (!(vector && "x" in vector && "y" in vector)) { return; }
    if (vector.x == 0 && vector.y == 0) { return; }
    player = players.get(socket.id);
    if (!player) return;
    if (player.canFireNow() && player.sniperAmmo>0) {
      var heading = util.normalize(vector);
      var sniperBullet = new obj.SniperBullet(
        nextProjectileID++,
        socket.id,
        util.add(player.position, util.scale(heading, config.BULLET_TO_PLAYER_SPAWN_DIST)),
        heading
      )
      projectiles.set(sniperBullet.id, sniperBullet);
      player.refreshFireTimestamp();
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
    var r1 = 0.9*config.ARENA_RADIUS*Math.sqrt(Math.random());
    var angle2 = 2*Math.PI/5*Math.random() + angle1;
    var r2 = 0.9*config.ARENA_RADIUS*Math.sqrt(Math.random());
    var x1 = r1*Math.cos(angle1);
    var y1 = r1*Math.sin(angle1);
    var x2 = r2 * Math.cos(angle2);
    var y2 = r2 * Math.sin(angle2);
    var segment = {point1:{x:x1, y: y1}, point2: {x:x2,y:y2}};
    if(util.distance(segment.point1,segment.point2)<config.ARENA_RADIUS && util.distance(segment.point1,segment.point2)>10*config.PLAYER_RADIUS)
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
            var minAngle = 1.58;
            angle1 = Math.atan2(obstacles[i-1].point1.y-obstacles[i-1].point2.y, obstacles[i-1].point1.x-obstacles[i-1].point2.x);
            angle2 = Math.atan2(segment.point2.y-obstacles[i-1].point2.y, segment.point2.x-obstacles[i-1].point2.x);
            if(Math.abs(angle1-angle2) < minAngle || 2*Math.PI - Math.abs(angle1 - angle2) < minAngle)
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
      var player1 = players.get(key1);
      var player2 = players.get(key2);
      var posDiff = util.diff(player1.position, player2.position);

      if (util.magnitude(posDiff) < 2*config.PLAYER_RADIUS && key1<key2) {
        var velDiff = util.diff(player1.velocity, player2.velocity);
        var impulse = - util.dotProduct(posDiff, velDiff) / util.dotProduct(posDiff, posDiff)
        if (Math.abs(impulse)<.05) {
          impulse = .05;
        }
        player1.velocity = util.add(player1.velocity, util.scale(posDiff, impulse));
        player2.velocity = util.add(player2.velocity, util.scale(posDiff, -impulse));

        if (player2.isSpiky()) {
          player1.health -= config.SPIKE_COLLISION_DAMAGE;
        } else {
          player1.health -= config.BODY_COLLISION_DAMAGE;
        }
        if (player1.isSpiky()) {
          player2.health -= config.SPIKE_COLLISION_DAMAGE;
        } else {
          player2.health -= config.BODY_COLLISION_DAMAGE;
        }
        if (player1.health <= 0 && player2.health > 0){
          player2.kills++;
        }
        if (player2.health <=0 && player1.health > 0){
          player1.kills++;
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

  for(var key of players.keys()){
      var player = players.get(key);
      var count = 0;
      for(var i=0; i<numObstacles; i++){
        if (player && util.pointLineDistance(player.position, obstacles[i]).trueDist < config.PLAYER_RADIUS + 2){
          registerPlayerWallHit(player,obstacles[i]);
          count++;
        }
      }
  }



}


function registerPlayerWallHit(player, wall){


  var hitType = util.pointLineDistance(player.position, wall);
  if(hitType.endpoint){
    var wallVector;
    if(hitType.index ==1){
      wallVector = {x: wall.point2.x - wall.point1.x, y:wall.point2.y - wall.point1.y };
    }
    else{
        wallVector = {x: wall.point1.x - wall.point2.x, y:wall.point1.y - wall.point2.y };
    }

    if(util.dotProduct(wallVector, player.velocity) > 0.25*util.magnitude(wallVector)*util.magnitude(player.velocity) ||
      (hitType.dist<0.25*config.PLAYER_RADIUS && util.dotProduct(wallVector, player.velocity) > 0))
    {
      var newVelocity = util.reflect(
        player.velocity,
        {x: wall.point2.y - wall.point1.y, y: wall.point1.x - wall.point2.x}
      );
      newVelocity.x -= wallVector.x/util.magnitude(wallVector);
      newVelocity.y -= wallVector.y/util.magnitude(wallVector);

    }
    else{

      if(util.intoWall(player.position, player.velocity, wall)){
        var newVelocity = util.reflect(
          player.velocity,
          {x: wall.point2.x - wall.point1.x, y: wall.point2.y - wall.point1.y}
        );
      }
      else{
        var newVelocity = {x:player.velocity.x, y:player.velocity.y};
      }

    }

    player.velocity.x = newVelocity.x;
    player.velocity.y = newVelocity.y;

    }
  else{
    if(util.intoWall(player.position, player.velocity, wall) ){
      var newVelocity = util.reflect(
        player.velocity,
        {x: wall.point2.x - wall.point1.x, y: wall.point2.y - wall.point1.y}
      );
      player.velocity.x = newVelocity.x;
      player.velocity.y = newVelocity.y;
    }
  }
  player.refreshLastCollision();
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
  powerup.effectOnPlayer(player);
  powerups.delete(powerup.id);
  spawnPowerup();
  return;
}

function findSpawnLocation(){
  var numPlayers = players.size;
  var nextCoords;
  while(true){
    nextCoords = util.uniformCircleGenerate(config.ARENA_RADIUS,players);
    var failed = false;
    for(var i=0; i<numObstacles; i++)
    {
      if(util.pointLineDistance(nextCoords,obstacles[i]).trueDist<config.PLAYER_RADIUS){
        failed = true;
        break;
      }
    }
    if(!failed) break;
  }
  console.log("Found player spawn location: " + JSON.stringify(nextCoords));
  return nextCoords;
}
function spawnPowerup(){
  if (powerups.size >= config.MAX_POWERUPS) {return; }
  var r = config.ARENA_RADIUS;
  var pos = util.gaussianCircleGenerate(r,0.1,0.00001);
  var type = util.multinomialSelect(config.POWERUP_TYPES,config.POWERUP_WEIGHTS);

  var nextPowerup = obj.makePowerUp(type, nextPowerupID++, pos)

  powerups.set(nextPowerup.id, nextPowerup);
}
function spawnMovingPowerupFromPoint(type, position) {
  var angle = Math.random() * 2 * Math.PI;
  var heading = {x: Math.cos(angle), y: Math.sin(angle)}
  var speed = Math.random() * 4 + 16; // uniformly random between 16 and 20
  var nextPowerup = obj.makePowerUp(type, nextPowerupID++, position, heading, speed)
  powerups.set(nextPowerup.id,nextPowerup);
}

function spawnPowerupsOnPlayerDeath(player) {
  // currently just spawns five random powerups.
  // TODO spawn according to a player-dependent distribution?
  for (var i=0; i<5; i++) {
    var type = util.multinomialSelect(config.POWERUP_TYPES,config.POWERUP_WEIGHTS);
    spawnMovingPowerupFromPoint(type, player.position);
  }
}

function movePlayer(player){
  // update position
  player.position = util.add(player.position, player.velocity);

  // update velocity
  player.velocity = util.add(player.velocity, player.acceleration);
  var speedBeforeFricton = util.magnitude(player.velocity);
  if (speedBeforeFricton > 0) {
    player.velocity = util.scale(player.velocity, 1 - config.FRICTION / speedBeforeFricton);
  }
  var speed = util.magnitude(player.velocity);
  var speedLimit = player.speedLimit();
  if (speed > speedLimit) {
    player.velocity = util.scale(player.velocity, speedLimit/speed);
  }

  // do physics if player hits map boundary
  var distFromCenter = util.magnitude(player.position);
  if (distFromCenter > config.ARENA_RADIUS-config.PLAYER_RADIUS) {
    player.position = util.scale(
      player.position,
      (config.ARENA_RADIUS-config.PLAYER_RADIUS)/distFromCenter
    )
    player.velocity = util.reflect(
      player.velocity, {x: -player.position.y, y: player.position.x}
    );
    player.position = util.add(player.position, player.velocity);
  }

}

function moveProjectile(projectile){
  // moves a projectile, and returns whether the projectile is still alive
  // (i.e. has not run out of time or escaped the arena)

  var isAlive = (
    projectile.timeLeft > 0 && util.magnitude(projectile.position) <= config.ARENA_RADIUS
  );
  for (var i=0; i<numObstacles; i++) {
    if(util.pointLineDistance(projectile.position, obstacles[i]).trueDist < 2*config.BULLET_RADIUS){
      isAlive = false;
    }
  }
  if (isAlive) {
    projectile.timeStep();
  }
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
function moveAllPowerups() {
  for (var key of powerups.keys()) {
    powerup = powerups.get(key);
    powerup.timeStep();
  }
}

function expelDeadPlayer(player) {
  players.delete(player.socket.id);
  player.socket.emit('death');
  player.socket.disconnect();
}

function sendView(player) {
  var allPlayers = [];
  for (var key of players.keys()) {
    var otherPlayer = players.get(key);
    var relPosition = util.intify(util.diff(otherPlayer.position, player.position));
    if (player.isVectorOnScreen(relPosition)) {
      var current = {
        name: otherPlayer.name,
        position: relPosition,
        health: otherPlayer.health,
        mouseCoords: otherPlayer.mouseCoords,
        isSpiky : otherPlayer.isSpiky()
      };
      allPlayers.push(current);
    }
  }
  var allPowerups = [];
  for (var key of powerups.keys()) {
    var powerup = powerups.get(key);
    var relPosition = util.intify(util.diff(powerup.position, player.position));
    if (player.isVectorOnScreen(relPosition)) {
      var current = {type: powerup.type, position: relPosition};
      allPowerups.push(current);
    }
  }
  var nearbyProjectiles = [];
  for (var key of projectiles.keys()) {
    var projectile = projectiles.get(key);
    var relPosition = util.intify(util.diff(projectile.position, player.position));
    if (player.isVectorOnScreen(relPosition)) {
      var current = {type: projectile.type, position: relPosition};
      nearbyProjectiles.push(current);
    }
  }

  var nearbyObstacles = [];
  for(var i=0; i<obstacles.length; i++) {
    var pt1diff = util.intify(util.diff(obstacles[i].point1, player.position));
    var pt2diff = util.intify(util.diff(obstacles[i].point2, player.position));
    var segment = {point1: pt1diff, point2: pt2diff};
    nearbyObstacles.push(segment);
  }


  player.socket.emit(
    'gameState',
    bson.serialize({
      myAbsoluteCoord: player.position,
      nearbyPowerups: allPowerups,
      nearbyPlayers: allPlayers,
      nearbyObstacles: nearbyObstacles,
      nearbyProjectiles: nearbyProjectiles,
      globalLeaderboard : leaderboard,
      yourStats: {name:player.name, score:player.kills, id:player.id},
      ammo: player.ammo,
      sniperAmmo: player.sniperAmmo
    }, Long)
  );
}
function updateLeaderboard(){
  leaderboard = [];
  for(var [key,player] of players){
    leaderboard.push({name:player.name, score:player.kills, id:player.id,});
  }
  leaderboard.sort(function(a,b){return b.score-a.score});
  leaderboard = leaderboard.slice(0,Math.min(config.LEADERBOARD_SIZE,leaderboard.length));
}
function updateContinuousFire(){
  for(var [key,player] of players){
    if(!player) return;
    if(player.tryingContinuousFire){
      if(player.canFireNow() && player.ammo>0){
        var vector = player.mouseCoords;
        var heading = util.normalize(vector);
        var position = util.add(player.position, util.scale(heading, config.BULLET_TO_PLAYER_SPAWN_DIST));
        var bullet = new obj.Bullet(
          nextProjectileID++,
          player.socket.id,
          position,
          heading
          )
        projectiles.set(bullet.id,bullet);
        player.refreshFireTimestamp();
        player.ammo--;
      }
      //same code as single bullet, refactor this
    }
  }
}
function moveLoops(){
  moveAllProjectiles();
  moveAllPowerups();
  collisionDetect();
  updateContinuousFire();
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
      spawnPowerupsOnPlayerDeath(player);
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
  for(var i = 0 ;i<config.STARTING_POWERUPS; i ++) spawnPowerup();
});

setInterval(moveLoops, 1000 / config.FRAME_RATE);
