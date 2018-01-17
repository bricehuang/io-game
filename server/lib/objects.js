var config  = require('../config.json');
var util  = require('./util.js');

exports.Projectile = function(
  type,
  id,
  corrPlayerID,
  x,
  y,
  xHeading,
  yHeading,
  speed,
  timeLeft,
  radius
){
  this.type = type;
  this.id = id;
  this.corrPlayerID = corrPlayerID;
  this.x = x;
  this.y = y;
  this.xHeading = xHeading;
  this.yHeading = yHeading;
  this.speed = speed;
  this.timeLeft = timeLeft;
  this.radius = radius;
}

exports.Projectile.prototype.timeStep = function() {
  this.x += this.xHeading*this.speed;
  this.y += this.yHeading*this.speed;

  this.timeLeft -= 1;
}

exports.Bullet = function(id, corrPlayerID, x, y, xHeading, yHeading) {
  exports.Projectile.call(
    this,
    "bullet",
    id,
    corrPlayerID,
    x,
    y,
    xHeading,
    yHeading,
    config.BULLET_SPEED,
    config.BULLET_AGE,
    config.BULLET_RADIUS
  )
}
exports.Bullet.prototype = new exports.Projectile();

exports.SniperBullet = function(id, corrPlayerID, x, y, xHeading, yHeading) {
   exports.Projectile.call(
    this,
    "sniperBullet",
    id,
    corrPlayerID,
    x,
    y,
    xHeading,
    yHeading,
    config.SNIPER_BULLET_SPEED,
    config.SNIPER_BULLET_AGE,
    config.BULLET_RADIUS
  )
}
exports.SniperBullet.prototype = new exports.Projectile();

exports.Powerup = function(
  id,
  type,
  x,
  y,
  effectOnPlayer,
  heading={x:1, y:0},
  speed=0,
  radius=config.POWERUP_RADIUS
) {
  this.id = id;
  this.type = type;
  this.x = x;
  this.y = y;
  this.effectOnPlayer = effectOnPlayer;
  this.heading = heading;
  this.speed = speed;
  this.radius = radius;
}
exports.Powerup.prototype.timeStep = function() {
  this.x += this.heading.x*this.speed;
  this.y += this.heading.y*this.speed;
  this.speed -= config.FRICTION*this.speed;
  var mag = util.magnitude({x: this.x, y:this.y});
  var eff_arena_radius = config.ARENA_RADIUS - this.radius;
  if (mag > eff_arena_radius) {
    this.x *= eff_arena_radius / mag;
    this.y *= eff_arena_radius / mag;
    this.speed = 0;
  }
}

exports.HealthPackPowerUp = function(id, x, y, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "healthpack",
    x,
    y,
    function(player) {
      player.health = Math.min(player.health + config.HEALTHPACK_HP_GAIN, player.maxHealth);
    },
    heading,
    speed
  )
}
exports.HealthPackPowerUp.prototype = new exports.Powerup();

exports.AmmoPowerUp = function(id, x, y, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "ammo",
    x,
    y,
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

exports.SniperAmmoPowerUp = function(id, x, y, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "sniperAmmo",
    x,
    y,
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

exports.SpikePowerUp = function(id, x, y, heading={x:1, y:0}, speed=0) {
  exports.Powerup.call(
    this,
    id,
    "spike",
    x,
    y,
    function(player) {
      player.isSpiky = true;
    },
    heading,
    speed
  )
}
exports.SpikePowerUp.prototype = new exports.Powerup();

exports.FastPowerUp = function(id, x, y, heading={x:1,y:0}, speed=0){
  exports.Powerup.call(
    this,
    id,
    "fast",
    x,
    y,
    function(player){
      player.isFast = true;
    },
    heading,
    speed
    )
}
exports.FastPowerup.prototype = new exports.Powerup();

exports.makePowerUp = function(type, id, x, y, heading={x:1, y:0}, speed=0) {
  switch (type) {
    case "healthpack": return new exports.HealthPackPowerUp(id, x, y, heading, speed);
    case "ammo": return new exports.AmmoPowerUp(id, x, y, heading, speed);
    case "sniperAmmo": return new exports.SniperAmmoPowerUp(id, x, y, heading, speed);
    case "spike": return new exports.SpikePowerUp(id, x, y, heading, speed);
    case "fast": return new exports.FastPowerUp(id, x, y, heading, speed);
    default: console.assert('invalid powerup type');
  }
}
