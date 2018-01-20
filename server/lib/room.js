var config  = require('../config.json');
var util  = require('./util.js');
var obj  = require('./objects.js');
var BSON = require('bson');
var Long = BSON.Binary;
var bson = new BSON();

exports.Room = function(id) {
  this.id = id;
  this.players = new Map();
  this.powerups = new Map();
  this.projectiles = new Map();
  this.nextProjectileID = 0;
  this.nextPowerupID = 0;
  this.leaderboard = [];
  this.numObstacles = 10;
  this.obstacles = [];
  this.startTime = Date.now();

  this.addPlayer = function(socket, name, windowDimensions, securityKey) {
    for(var i = 0;i<config.POWERUPS_PER_PLAYER;i++) {
      this.spawnPowerup();
    }
    var spawnPosition = this.findSpawnLocation();
    var currentPlayer = new obj.Player(
      socket, spawnPosition, this, name, windowDimensions, securityKey
    );
    this.players.set(socket.id, currentPlayer);
    return currentPlayer;
  }

  this.addFiredProjectile = function(type, player, mouseVector) {
    if (mouseVector.x == 0 && mouseVector.y == 0) { return; }
    var heading = util.normalize(mouseVector);
    var position = util.add(
      player.position, util.scale(heading, player.radius+obj.getProjectileRadius(type)+2)
    );
    var projectile = obj.makeProjectile(
      type,
      this.nextProjectileID++,
      player,
      position,
      heading
    )
    this.projectiles.set(projectile.id, projectile);
  }

  this.emitToRoom = function(keyword, message) {
    for (var key of this.players.keys()) {
      var player = this.players.get(key);
      player.socket.emit(keyword, message);
    }
  }

  this.newObstacle = function() {
    while (true) {
      var angle1 = 2*Math.PI*Math.random();
      var angle2 = 2*Math.PI/5*Math.random() + angle1;
      var r1 = 0.9*config.ARENA_RADIUS*Math.sqrt(Math.random());
      var r2 = 0.9*config.ARENA_RADIUS*Math.sqrt(Math.random());
      var point1 = {x:r1*Math.cos(angle1), y:r1*Math.sin(angle1)};
      var point2 = {x:r2*Math.cos(angle2), y:r2*Math.sin(angle2)};
      var dist = util.distance(point1,point2)
      if (dist < config.ARENA_RADIUS && dist > 10*config.PLAYER_RADIUS){
        return {point1:point1, point2:point2};
      }
    }
  }

  this.generateObstacles = function(){
    var counter = 0;
    generatedObstacles = [];
    for(var i = 0 ; i<this.numObstacles; i++) {
      counter++;
      if (i==0) {
        var segment = this.newObstacle();
        generatedObstacles.push(segment);
      } else {
        startNew = Math.random();
        if(startNew>0.4) {
          var segment = this.newObstacle();
          segment.point1.x = generatedObstacles[i-1].point2.x;
          segment.point1.y = generatedObstacles[i-1].point2.y;
          var good = true;

          //Make sure new segment isn't too small
          if (util.distance(segment.point1,segment.point2)<10*config.PLAYER_RADIUS) {
            good = false
          } else {
            //Make sure angle isnt too small
            var minAngle = 1.58;
            angle1 = Math.atan2(generatedObstacles[i-1].point1.y-generatedObstacles[i-1].point2.y, generatedObstacles[i-1].point1.x-generatedObstacles[i-1].point2.x);
            angle2 = Math.atan2(segment.point2.y-generatedObstacles[i-1].point2.y, segment.point2.x-generatedObstacles[i-1].point2.x);
            if (Math.abs(angle1-angle2) < minAngle || 2*Math.PI - Math.abs(angle1 - angle2) < minAngle){
              good = false;
            }
            //Check all Intersections
            else {
              for(var j=0; j<i-1; j++){
                if (util.segmentIntersect(segment,generatedObstacles[j])) {
                  good = false;
                }
              }
            }
          }
          if (good) {
            generatedObstacles.push(segment);
            //console.log(segment);
          } else {
            i--;
          }
        } else {
          var segment = this.newObstacle();
          var good = true;
          for(var j=0; j<i; j++) {
            if(util.segmentIntersect(segment,generatedObstacles[j])){
              good = false;
            }
          }
          if(good){
            generatedObstacles.push(segment);
            //console.log(segment);
          } else {
            i--;
          }
        }
      }
    }
    return generatedObstacles;
  }

  this.findSpawnLocation = function(){
    var numPlayers = this.players.size;
    var nextCoords;
    while(true){
      nextCoords = util.uniformCircleGenerate(config.ARENA_RADIUS, this.players);
      var failed = false;
      for(var i=0; i<this.numObstacles; i++) {
        if (util.pointLineDistance(nextCoords, this.obstacles[i]).trueDist<config.PLAYER_RADIUS){
          failed = true;
          break;
        }
      }
      if(!failed) break;
    }
    console.log("Found player spawn location: " + JSON.stringify(nextCoords));
    return nextCoords;
  }

  this.attemptFindPowerupSpawnLocation = function() {
    /*
    Generate and return a powerup spawn location, or null spawn is on a wall.
    */
    var location = util.randomSpawn(config.ARENA_RADIUS);
    for(var obstacle of this.obstacles){
      if (util.pointLineDistance(location, obstacle).trueDist<1.5*config.POWERUP_RADIUS){
        return null;
      }
    }
    return location;
  }
  this.findPowerupSpawnLocation = function() {
    /*
    Generate and return a powerup spawn location.  Retries until gets a spawn not on a wall.
    */
    var location = this.attemptFindPowerupSpawnLocation();
    while (location == null) {
      location = this.attemptFindPowerupSpawnLocation();
    }
    return location;
  }
  this.spawnPowerup = function(){
    if (this.powerups.size >= config.MAX_POWERUPS) {return; }
    var pos = this.findPowerupSpawnLocation();
    var type = util.multinomialSelect(config.POWERUP_TYPES,config.POWERUP_WEIGHTS);
    var nextPowerup = obj.makePowerUp(type, this.nextPowerupID++, pos)
    this.powerups.set(nextPowerup.id, nextPowerup);
  }
  this.spawnMovingPowerupFromPoint = function(type, position) {
    var angle = Math.random() * 2 * Math.PI;
    var heading = {x: Math.cos(angle), y: Math.sin(angle)}
    var speed = Math.random() * 4 + 16; // uniformly random between 16 and 20
    var nextPowerup = obj.makePowerUp(type, this.nextPowerupID++, position, heading, speed)
    this.powerups.set(nextPowerup.id, nextPowerup);
  }
  this.spawnPowerupsOnPlayerDeath = function(player) {
    // currently just spawns five random powerups.
    // TODO spawn according to a player-dependent distribution?
    var pos = player.position;
    for (var i=0; i<4; i++) {
      var type = util.multinomialSelect(config.POWERUP_TYPES,config.POWERUP_WEIGHTS);
      this.spawnMovingPowerupFromPoint(type, player.position);
    }
    this.spawnMovingPowerupFromPoint("heart",player.position);
  }

  this.registerPlayerPlayerHit = function(player1, player2) {
    var posDiff = util.diff(player1.position, player2.position);
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
      this.emitToRoom('feed', player1.name + " was roadkilled by " + player2.name + "!");
    }
    if (player2.health <=0 && player1.health > 0){
      player1.kills++;
      this.emitToRoom('feed', player2.name + " was roadkilled by " + player1.name + "!");
    }
  }
  this.registerPlayerProjectileHit = function(player, projectile){
    if (!projectile.isLive) {return;}
    var wasAlive = (player.health>0);
    projectile.onPlayerHit(player);

    if (player.health <= 0 && wasAlive) {
      var shooterPlayer = projectile.shooter;
      shooterPlayer.kills++;
      if (player.id == shooterPlayer.id) {
        this.emitToRoom('feed', player.name + " decided his life was worthless!");
      } else {
        this.emitToRoom('feed', player.name + " was killed by " + shooterPlayer.name + "!");
      }
    }
  }

  this.registerPlayerPowerupHit = function(player, powerup){
    if (!powerup.isSpecialWeapon || player.canPickUpSpecialWeapon(powerup)) {
      powerup.effectOnPlayer(player);
      this.powerups.delete(powerup.id);
      this.spawnPowerup();
    }
  }

  this.registerPlayerWallHit = function(player, wall){
    var hitType = util.pointLineDistance(player.position, wall);
    if (hitType.endpoint){
      var wallVector;
      if(hitType.index ==1){
        wallVector = {x: wall.point2.x - wall.point1.x, y:wall.point2.y - wall.point1.y };
      }
      else{
          wallVector = {x: wall.point1.x - wall.point2.x, y:wall.point1.y - wall.point2.y };
      }

      if(util.dotProduct(wallVector, player.velocity) > 0.25*util.magnitude(wallVector)*util.magnitude(player.velocity) ||
        (hitType.dist<0.25*player.radius && util.dotProduct(wallVector, player.velocity) > 0))
      {
        var newVelocity = util.reflect(
          player.velocity,
          {x: wall.point2.y - wall.point1.y, y: wall.point1.x - wall.point2.x}
        );
        newVelocity.x -= wallVector.x/util.magnitude(wallVector);
        newVelocity.y -= wallVector.y/util.magnitude(wallVector);
      }
      else {
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
  }
  this.collisionDetect = function(){
    for (var key1 of this.players.keys()) {
      for (var key2 of this.players.keys()) {
        var player1 = this.players.get(key1);
        var player2 = this.players.get(key2);
        if (key1 < key2 && util.collided(player1,player2, config.EPS)) {
          this.registerPlayerPlayerHit(player1, player2)
        }
      }
    }
    for (var key1 of this.players.keys()) {
      for (var key2 of this.projectiles.keys()) {
        var player = this.players.get(key1);
        var projectile = this.projectiles.get(key2);
        if (player && projectile && util.collided(player,projectile,config.EPS)) {
          this.registerPlayerProjectileHit(player,projectile);
        }
      }
    }
    for (var key1 of this.players.keys()) {
      for (var key2 of this.powerups.keys()) {
        var player = this.players.get(key1);
        var powerup = this.powerups.get(key2);
        if (player && powerup && util.collided(player,powerup,config.EPS)) {
          this.registerPlayerPowerupHit(player,powerup);
        }
      }
    }
    for (var [key1, player] of this.players){
      for (var [key2,powerup] of this.powerups){
        if(player && powerup){
          powerup.measureGravity(player);
        }
      }
    }
    for(var key of this.players.keys()){
      var player = this.players.get(key);
      for(var i=0; i<this.numObstacles; i++){
        if (player && util.pointLineDistance(player.position, this.obstacles[i]).trueDist < player.radius + 2){
          this.registerPlayerWallHit(player, this.obstacles[i]);
        }
      }
    }
  }

  this.moveAllPlayers = function(){
    for (var key of this.players.keys()) {
      this.players.get(key).timeStep();
    }
  }

  this.checkProjectileWallCollisions = function() {
    for(var [key, projectile] of this.projectiles){
      var velocity = util.scale(projectile.heading, projectile.speed);
      var previousPosition = util.diff(projectile.position, velocity);

      // buffer to take into account size of projectile
      var hitboxBuffer = util.scaleToLength(velocity, projectile.radius);
      var hitboxStart = util.diff(previousPosition, hitboxBuffer);
      var hitboxEnd = util.add(projectile.position, hitboxBuffer);
      var hitboxSegment = {point1: hitboxStart, point2: hitboxEnd};

      if (util.magnitude(projectile.position) > config.ARENA_RADIUS) {
        var intersectionWithBoundary = util.findPointOnSegmentWithMagnitude(
          hitboxSegment, config.ARENA_RADIUS, config.EPS
        );
        projectile.onWallHit(intersectionWithBoundary);
      }
      for (var obstacle of this.obstacles) {
        var intersectionIfExists = util.computeIntersection(hitboxSegment, obstacle);
        if (intersectionIfExists != null) {
          projectile.onWallHit(intersectionIfExists);
        }
      }
    }
  }
  this.moveAllProjectiles = function() {
    for(var [key, projectile] of this.projectiles){
      projectile.timeStep();
    }
  }
  this.moveAllPowerups = function() {
    for (var key of this.powerups.keys()) {
      this.powerups.get(key).timeStep();
    }
  }
  this.updateLeaderboard = function(){
    var newLeaderboard = [];
    for(var [key,player] of this.players){
      newLeaderboard.push({name:player.name, score:player.kills, id:player.id,});
    }
    newLeaderboard.sort(function(a,b){return b.score-a.score});
    this.leaderboard = newLeaderboard.slice(0,Math.min(config.LEADERBOARD_SIZE,newLeaderboard.length));
  }

  this.updateContinuousFire = function(){
    for(var [key,player] of this.players){
      if (player.tryingContinuousFire) {
        player.attemptFire(player.mouseCoords);
      }
    }
  }

  this.respawns = function() {
    for (var key of this.players.keys()) {
      var player = this.players.get(key);
      if(player.health<=0){
        this.spawnPowerupsOnPlayerDeath(player);
        player.reset();
        player.position = this.findSpawnLocation();
      }
    }
  }


  this.expelDeadPlayers = function() {
    var deadPlayers = [];
    for (var key of this.players.keys()) {
      var player = this.players.get(key);
      if (player.health <= 0) {
        deadPlayers.push(player);
        this.spawnPowerupsOnPlayerDeath(player);
        player.socket.emit('death');
        player.socket.disconnect();
      }
    }
    for (var i=0; i<deadPlayers.length; i++) {
      var player = deadPlayers[i];
      this.players.delete(player.id);
    }
    return deadPlayers;
  }

  this.purgeDeadProjecties = function() {
    var deadProjectiles = [];
    for (var [key, projectile] of this.projectiles) {
      if (!projectile.isLive) {
        deadProjectiles.push(projectile);
      }
    }
    for (var projectile of deadProjectiles) {
      this.projectiles.delete(projectile.id);
    }
  }

  this.sendView = function(player) {
    var allPlayers = [];
    for (var [key,otherPlayer] of this.players) {
      var relPosition = util.intify(util.diff(otherPlayer.position, player.position));
      var buffer = otherPlayer.radius;
      if (player.isVectorOnScreen(relPosition,buffer)) {
        var current = {
          name: otherPlayer.name,
          pos: relPosition,
          health: otherPlayer.health,
          mCd: otherPlayer.mouseCoords,
          Spk : otherPlayer.isSpiky(),
          tier: otherPlayer.tier,
          v: otherPlayer.velocity
        };
        allPlayers.push(current);
      }
    }
    var allPowerups = [];
    for (var key of this.powerups.keys()) {
      var powerup = this.powerups.get(key);
      var relPosition = util.intify(util.diff(powerup.position, player.position));
      var buffer = powerup.radius;
      if (player.isVectorOnScreen(relPosition,buffer)) {
        var current = {type: powerup.type, pos: relPosition};
        allPowerups.push(current);
      }
    }
    var nearbyProjectiles = [];
    for (var key of this.projectiles.keys()) {
      var projectile = this.projectiles.get(key);
      var relPosition = util.intify(util.diff(projectile.position, player.position));
      var buffer = projectile.radius;
      if (player.isVectorOnScreen(relPosition,buffer)) {
        var current = {type: projectile.type, pos: relPosition};
        if (projectile.type == "rocket") {
          current.isExploded = projectile.isExploded;
        }
        nearbyProjectiles.push(current);
      }
    }

    var nearbyObstacles = [];
    for(var i=0; i<this.obstacles.length; i++) {
      var pt1diff = util.intify(util.diff(this.obstacles[i].point1, player.position));
      var pt2diff = util.intify(util.diff(this.obstacles[i].point2, player.position));
      var segment = {pt1: pt1diff, pt2: pt2diff};
      nearbyObstacles.push(segment);
    }

    player.socket.emit(
      'gameState',
      bson.serialize({
        AbCd: player.position,
        nPu: allPowerups,
        nPl: allPlayers,
        nOb: nearbyObstacles,
        nPj: nearbyProjectiles,
        Ldb : this.leaderboard,
        stats: {name:player.name, score:player.kills, id:player.id},
        am: player.ammo,
        spA: player.specialAmmo,
        spW: player.specialWeapon
      }, Long)
    );
  }
  this.sendAllViews = function() {
    for (var key of this.players.keys()) {
      this.sendView(this.players.get(key));
    }
  }

  this.moveLoop = function() {
    this.moveAllPlayers();
    this.moveAllProjectiles();
    this.moveAllPowerups();
    this.checkProjectileWallCollisions();
    this.collisionDetect();
    this.updateContinuousFire();
    this.updateLeaderboard();
    this.purgeDeadProjecties();
    this.respawns();
    this.sendAllViews();
  }

  this.obstacles = this.generateObstacles();
  for(var i=0; i<config.STARTING_POWERUPS; i++) {
    this.spawnPowerup();
  }

}