var config  = require('../config.json');

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
