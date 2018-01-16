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
var leaderboard = [];

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
    ammo: 0
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
      newBullet = {
        corrPlayerID: socket.id,
        x: player.x + normalizedVector.x*40,
        y: player.y + normalizedVector.y*40,
        xHeading: normalizedVector.x,
        yHeading: normalizedVector.y,
        timeLeft: config.BULLET_AGE,
        radius: config.BULLET_RADIUS,
        id: nextBulletID++,
      }
      bullets.set(newBullet.id,newBullet);
      player.lastfire = Date.now();
      player.ammo--;
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
        players.get(key1).health -= config.BODY_COLLISION_DAMAGE;
        players.get(key2).health -= config.BODY_COLLISION_DAMAGE;
      }
    }
  }
  for (var key1 of players.keys()) {
    for (var key2 of bullets.keys()) {
      var player = players.get(key1);
      var bullet = bullets.get(key2);
      if (util.collided(player,bullet,config.EPS)) {
        registerPlayerBulletHit(player,bullet);
      }
    }
  }
  for (var key1 of players.keys()) {
    for (var key2 of powerups.keys()) {
      var player = players.get(key1);
      var powerup = powerups.get(key2);
      if (util.collided(player,powerup,config.EPS)) {
        registerPlayerPowerupHit(player,powerup);
      }
    }
  }
}

function registerPlayerBulletHit(player, bullet){
  console.log("Player Bullet Collision!");
  player.health-=config.BULLET_COLLISION_DAMAGE;
  if (player.health <= 0) {
    players.get(bullet.corrPlayerID).kills++;
  }
  bullets.delete(bullet.id);
  return;
}
function registerPlayerPowerupHit(player, powerup){
  console.log("Player Powerup Collision!");
  if (powerup.type == "healthpack") {
    player.health = Math.min(
      player.health + config.HEALTHPACK_HP_GAIN, player.maxHealth
    );
  }
  if(powerup.type=="gun"){
    player.ammo+=5;
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
  var nearbyBullets = [];
  for (var key of bullets.keys()) {
    var bullet = bullets.get(key);
    var relX = bullet.x - player.x;
    var relY = bullet.y - player.y;
    if( Math.abs(relX) <= player.windowWidth/2 && Math.abs(relY) <= player.windowHeight/2) {
      var current = {x:relX, y: relY};
      nearbyBullets.push(current);
    }
  }

  player.socket.emit(
    'gameState',
    {
      myAbsoluteCoord: {x: player.x, y:player.y},
      nearbyPowerups: allPowerups,
      nearbyPlayers: allPlayers,
      nearbyBullets: nearbyBullets,
      myScore: player.kills,
      globalLeaderboard : leaderboard,
      yourID: player.id,
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
  moveAllBullets();
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
  // console.log(players);
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

