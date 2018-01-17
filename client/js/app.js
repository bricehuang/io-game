var mouseCoords={x:0,y:0};

var playerName;
var playerNameInput = document.getElementById('playerNameInput');
var socket;

var screenWidth = window.innerWidth;
var screenHeight = window.innerHeight;

var c = document.getElementById('cvs');
var canvas = c.getContext('2d');
c.width = screenWidth; c.height = screenHeight;

var KEY_ENTER = 13;

var game = new Game();

var bulletImg = new Image();
bulletImg.src = 'js/images/bullet.jpg';
var sniperImg = new Image();
sniperImg.src = 'js/images/gun.jpg';
var healthpackImg = new Image();
healthpackImg.src = 'js/images/healthpack.ico';

function startGame() {
  playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');
  document.getElementById('gameAreaWrapper').style.display = 'block';
  document.getElementById('startMenuWrapper').style.display = 'none';
  socket = io();
  SetupSocket(socket);
  socket.emit('playerInformation',{
    name: playerName,
    windowWidth: screenWidth,
    windowHeight: screenHeight,
  });
  animloop();
}

// check if nick is valid alphanumeric characters (and underscores)
function validNick() {
  var regex = /^\w*$/;
  console.log('Regex Test', regex.exec(playerNameInput.value));
  return regex.exec(playerNameInput.value) !== null;
}

window.onload = function() {
  'use strict';

  var btn = document.getElementById('startButton'),
      nickErrorText = document.querySelector('#startMenu .input-error');

  btn.onclick = function () {
    // check if the nick is valid
    if (validNick()) {
      startGame();
    } else {
      nickErrorText.style.display = 'inline';
    }
  };

  playerNameInput.addEventListener('keypress', function (e) {
    var key = e.which || e.keyCode;
    if (key === KEY_ENTER) {
      if (validNick()) {
        startGame();
      } else {
        nickErrorText.style.display = 'inline';
      }
    }
  });
};

function SetupSocket(socket) {
  game.handleNetwork(socket);
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
              window.setTimeout(callback, 1000 / 60);
          };
})();

function animloop(){
  requestAnimFrame(animloop);
  gameLoop();
}

function gameLoop() {
  game.handleLogic();
  game.handleGraphics(canvas);
}

window.addEventListener('resize', function() {
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;
  c.width = screenWidth;
  c.height = screenHeight;
}, true);

function setMouseCoords(mouse){
  mouseCoords = {x: mouse.clientX-screenWidth/2, y: mouse.clientY-screenHeight/2};
  socket.emit('mouseCoords', mouseCoords);
}
c.addEventListener('mousemove', setMouseCoords, false);



var map = {}; // You could also use an array
onkeydown = onkeyup = function(e){
  e = e || event; // to deal with IE
  if(e.type == 'keydown')
      map[e.keyCode] = true;
  if(e.type=='keyup')
      map[e.keyCode] = false;
}
var lastmove = [false, false, false, false];
function move(){
  if (!socket) return;
  //w = 87
  //a = 65
  //s = 83
  //d = 68
  var thismove = [map[65], map[87], map[68], map[83]];
  if (
    thismove[0] != lastmove[0] ||
    thismove[1] != lastmove[1] ||
    thismove[2] != lastmove[2] ||
    thismove[3] != lastmove[3]
  ){
    socket.emit('move', thismove);
    lastmove = thismove;
  }
}
updateRate=10;
setInterval(move, 1000 / updateRate);

function resize() {
  if (!socket) return;
  screenWidth = window.innerWidth;
  screenHeight = window.innerHeight;

  var newDimensions = {windowWidth: screenWidth, windowHeight: screenHeight};
  socket.emit('windowResized', newDimensions);
}
window.addEventListener('resize', resize);

function sendClick(mouse) {
  if (!socket) return;
  var mouseCoords = {x: mouse.clientX-screenWidth/2, y: mouse.clientY-screenHeight/2};
  socket.emit('fire', mouseCoords);
}
c.addEventListener('click', sendClick, false);

function shootSniper() {
  if (!socket) return;
  socket.emit('fireSniper', mouseCoords);
}
c.addEventListener('keypress', function(event){
  if (event.keyCode == 69 || event.keyCode == 101){ // e or E
    shootSniper();
  }
}, false);

function checkLatency() {
  startPingTime = Date.now();
  this.socket.emit('pingcheck');
}
