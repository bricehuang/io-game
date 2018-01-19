var config  = require('../config.json');
var util  = require('./util.js');

exports.Projectile = function(
  type,
  id,
  shooter,
  position,
  heading,
  speed,
  timeLeft,
  radius
){
  this.type = type;
  this.id = id;
  this.shooter = shooter;
  this.position = position;
  this.heading = heading;
  this.speed = speed;
  this.timeLeft = timeLeft;
  this.radius = radius;
}

exports.Projectile.prototype.timeStep = function() {
  this.position = util.add(this.position, util.scale(this.heading, this.speed));
  this.timeLeft -= 1;
}

exports.Bullet = function(id, shooter, position, heading) {
  exports.Projectile.call(
    this,
    "bullet",
    id,
    shooter,
    position,
    heading,
    config.BULLET_SPEED,
    config.BULLET_AGE,
    config.BULLET_RADIUS
  )
}
exports.Bullet.prototype = new exports.Projectile();

exports.SniperBullet = function(id, shooter, position, heading) {
   exports.Projectile.call(
    this,
    "sniperBullet",
    id,
    shooter,
    position,
    heading,
    config.SNIPER_BULLET_SPEED,
    config.SNIPER_BULLET_AGE,
    config.BULLET_RADIUS
  )
}
exports.SniperBullet.prototype = new exports.Projectile();

exports.makeProjectile = function(type, id, shooter, position, heading) {
  switch (type){
    case "bullet": return new exports.Bullet(id, shooter, position, heading);
    case "sniperBullet": return new exports.SniperBullet(id, shooter, position, heading);
    default: console.assert(false, 'invalid projectile type');
  }
}

exports.Powerup = function(
  id,
  type,
  position,
  effectOnPlayer,
  heading={x:1, y:0},
  speed=0,
  radius=config.POWERUP_RADIUS
) {
  this.id = id;
  this.type = type;
  this.position = position;
  this.effectOnPlayer = effectOnPlayer;
  this.heading = heading;
  this.speed = speed;
  this.radius = radius;
}
exports.Powerup.prototype.timeStep = function() {
  this.position = util.add(this.position, util.scale(this.heading, this.speed));
  this.speed -= config.FRICTION*this.speed;
  var eff_arena_radius = config.ARENA_RADIUS - this.radius;
  if (util.magnitude(this.position) > eff_arena_radius) {
    this.position = util.scaleToLength(this.position, eff_arena_radius);
    this.speed = 0;
  }
}

exports.HealthPackPowerUp = function(id, position, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "healthpack",
    position,
    function(player) {
      player.health = Math.min(player.health + config.HEALTHPACK_HP_GAIN, player.maxHealth);
    },
    heading,
    speed
  )
}
exports.HealthPackPowerUp.prototype = new exports.Powerup();

exports.AmmoPowerUp = function(id, position, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "ammo",
    position,
    function(player) {
      player.ammo = Math.min(
        player.ammo + config.AMMO_POWERUP_BULLETS,
        config.MAX_AMMO
      );
    },
    heading,
    speed
  )
}
exports.AmmoPowerUp.prototype = new exports.Powerup();

exports.SniperAmmoPowerUp = function(id, position, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "sniperAmmo",
    position,
    function(player) {
      player.sniperAmmo = Math.min(
        player.sniperAmmo + config.SNIPER_AMMO_POWERUP_BULLETS,
        config.MAX_SNIPER_AMMO
      );
    },
    heading,
    speed
  )
}
exports.SniperAmmoPowerUp.prototype = new exports.Powerup();

exports.SpikePowerUp = function(id, position, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "spike",
    position,
    function(player) {
      player.refreshSpikeTimestamp();
    },
    heading,
    speed
  )
}
exports.SpikePowerUp.prototype = new exports.Powerup();

exports.FastPowerUp = function(id, position, heading={x:1,y:0}, speed=0){
  exports.Powerup.call(
    this,
    id,
    "fast",
    position,
    function(player){
      player.refreshFastTimestamp();
    },
    heading,
    speed
    )
}
exports.FastPowerUp.prototype = new exports.Powerup();

exports.HeartPowerUp = function(id, position, heading={x:1,y:0},speed=0){
  exports.Powerup.call(
    this,
    id,
    "heart",
    position,
    function(player){
      player.incrementTier();
    },
    heading,
    speed
    )
}
exports.HeartPowerUp.prototype = new exports.Powerup();

exports.makePowerUp = function(type, id, position, heading={x:1, y:0}, speed=0) {
  switch (type) {
    case "healthpack": return new exports.HealthPackPowerUp(id, position, heading, speed);
    case "ammo": return new exports.AmmoPowerUp(id, position, heading, speed);
    case "sniperAmmo": return new exports.SniperAmmoPowerUp(id, position, heading, speed);
    case "spike": return new exports.SpikePowerUp(id, position, heading, speed);
    case "fast": return new exports.FastPowerUp(id, position, heading, speed);
    case "heart": return new exports.HeartPowerUp(id, position, heading, speed);
    default: console.assert(false, 'invalid powerup type');
  }
}

exports.Player = function(socket, spawnPosition, room) {
  this.id = socket.id;
  this.socket = socket;
  this.room = room;

  this.name = config.DEFAULT_NAME;
  this.windowDimensions = {
    width: config.DEFAULT_WINDOW_WIDTH,
    height: config.DEFAULT_WINDOW_HEIGHT
  };
  this.mouseCoords = {x:1, y:0};

  this.position = spawnPosition;
  this.velocity = {x:0,y:0};
  this.acceleration = {x:0, y:0};

  this.radius = config.PLAYER_RADIUS;
  this.health = config.PLAYER_START_HEALTH;
  this.maxHealth = config.PLAYER_MAX_HEALTH;
  this.kills = 0;
  this.ammo = config.STARTING_AMMO;
  this.sniperAmmo = 0;

  this.lastfire = 0;
  this.lastSpikePickup = 0;
  this.lastFastPickup = 0;
  this.tier = 0;

  this.timeStep = function() {
    // update position
    this.position = util.add(this.position, this.velocity);

    // update velocity
    this.velocity = util.add(this.velocity, this.acceleration);
    var speedBeforeFricton = util.magnitude(this.velocity);
    if (speedBeforeFricton > 0) {
      this.velocity = util.scale(this.velocity, 1 - config.FRICTION / speedBeforeFricton);
    }
    var speed = util.magnitude(this.velocity);
    var speedLimit = this.speedLimit();
    if (speed > speedLimit) {
      this.velocity = util.scale(this.velocity, speedLimit/speed);
    }

    // do physics if player hits map boundary
    var distFromCenter = util.magnitude(this.position);
    var eff_arena_radius = config.ARENA_RADIUS - this.radius;
    if (distFromCenter > eff_arena_radius) {
      this.position = util.scale(this.position, eff_arena_radius/distFromCenter)
      this.velocity = util.reflect(this.velocity, {x: -this.position.y, y: this.position.x});
      this.position = util.add(this.position, this.velocity);
    }
  }

  this.setName = function(name){
    this.name = name;
  }
  this.setWindowDimensions = function(windowDimensions) {
    this.windowDimensions = windowDimensions;
  }
  this.setMouseCoords = function(mouseCoords) {
    this.mouseCoords = mouseCoords;
  }
  this.canFireNow = function() {
    return (Date.now() - this.lastfire > config.FIRE_COOLDOWN_MILLIS);
  }
  this.refreshFireTimestamp = function() {
    this.lastfire = Date.now();
  }
  this.attemptFire = function(vector) {
    if (this.canFireNow() && this.ammo > 0) {
      this.room.addFiredProjectile("bullet", this, vector);
      this.refreshFireTimestamp();
      this.ammo--;
    }
  }
  this.attemptSniperFire = function(vector) {
    if (this.canFireNow() && this.sniperAmmo>0) {
      this.room.addFiredProjectile("sniperBullet", this, vector);
      this.refreshFireTimestamp();
      this.sniperAmmo--;
    }
  }

  this.refreshFastTimestamp = function() {
    return this.lastFastPickup = Date.now();
  }
  this.isFast = function() {
    return (Date.now() - this.lastFastPickup < config.FAST_DURATION_MILLIS);
  }
  this.speedLimit = function() {
    return this.isFast() ? 3/2 * config.PLAYER_SPEED_LIMIT : config.PLAYER_SPEED_LIMIT;
  }
  this.accelerationMagnitude = function() {
    return this.isFast() ? 3/2 * config.ACCELERATION_MAGNITUDE : config.ACCELERATION_MAGNITUDE;
  }

  this.refreshSpikeTimestamp = function() {
    return this.lastSpikePickup = Date.now();
  }
  this.isSpiky = function() {
    return (Date.now() - this.lastSpikePickup < config.SPIKE_DURATION_MILLIS);
  }

  this.isVectorOnScreen = function(vector, buffer=config.BUFFER) {
    return (
      Math.abs(vector.x) <= buffer+this.windowDimensions.width/2 &&
      Math.abs(vector.y) <= buffer+this.windowDimensions.height/2
    );
  }
  this.incrementTier = function(){
    this.tier=this.tier+1;
    this.maxHealth =config.PLAYER_MAX_HEALTH+this.tier*config.TIER_HEALTH_BONUS;
    this.radius = config.PLAYER_RADIUS+this.tier*config.TIER_RADIUS_BONUS;
    this.health = Math.min(config.PLAYER_MAX_HEALTH,this.health + config.TIER_HEALTH_BONUS);
  }
}
