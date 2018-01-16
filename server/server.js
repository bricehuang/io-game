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
  // nextId = players.size;
  currentPlayer = {
    name:config.DEFAULT_NAME,
    x:0,
    y:0,
    socket:socket,
    windowHeight : config.DEFAULT_WINDOW_HEIGHT,
    windowWidth  : config.DEFAULT_WINDOW_WIDTH,
    // id : nextId,
    target  : {x:0,y:0},
    velocity: {x:0,y:0},
    acceleration: {x:0, y:0},
    radius: config.PLAYER_RADIUS,
    health: config.PLAYER_START_HEALTH,
    maxHealth: config.PLAYER_MAX_HEALTH,
    kills: 0,
    lastfire: -1
  }
  spawnPlayer(currentPlayer);
  spawnPowerup();
  players.set(socket.id,currentPlayer);

  socket.on('player_information', function(data){
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
    var magnitude = Math.sqrt(acceleration.x*acceleration.x+acceleration.y*acceleration.y);
    if (magnitude > 0) {
      acceleration.x *= config.ACCELERATION_MAGNITUDE/magnitude;
      acceleration.y *= config.ACCELERATION_MAGNITUDE/magnitude;
    }
    player.acceleration = acceleration;
  });
  socket.on('window_resized', function(dimensions){
    player = players.get(socket.id);
    if (!player) return;
    player.windowWidth = dimensions.windowWidth;
    player.windowHeight = dimensions.windowHeight;
  })
  socket.on('fire', function(vector){
    player = players.get(socket.id);
    if (!player) return;

    else if(Date.now() - player.lastfire > config.FIRE_COOLDOWN_MILLIS)
    {
      var length = Math.sqrt(vector.x*vector.x + vector.y*vector.y);
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
    }
  })

  socket.on('pingcheck', function() {
    console.log('I was pinged!');
    socket.emit('pongcheck');
  })

  socket.on('disconnect', function(){
    console.log('user disconnected');
    if(players.has(socket.id))
      {
      players.delete(socket.id);
    }
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
        var impulse = ( dx*(v2_x-v1_x)+dy*(v2_y-v1_y))/(dx*dx+dy*dy);
        if(Math.abs(impulse)<.05)
          impulse = .05;

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
  if(player.health<=0){
    players.get(bullet.corrPlayerID).kills++;
  }
  bullets.delete(bullet.id);
  return;
}
function registerPlayerPowerupHit(player, powerup){
  console.log("Player Powerup Collision!");
  player.health += config.HEALTHPACK_HP_GAIN;
  if (player.health > player.maxHealth) {
    player.health = player.maxHealth;
  }
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
  var vx = player.velocity.x + player.acceleration.x;
  var vy = player.velocity.y + player.acceleration.y;

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
      my_score: player.kills
    }
  );
}
function moveLoops(){
  moveAllBullets();
  for(var key of players.keys()){
    movePlayer(players.get(key));
    sendView(players.get(key));
  }
  collisionDetect();
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
var spawnRate = 0.5;
setInterval(spawnPowerup, 1000 / spawnRate);

