
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

function startGame() {
    playerName = playerNameInput.value.replace(/(<([^>]+)>)/ig, '');
    document.getElementById('gameAreaWrapper').style.display = 'block';
    document.getElementById('startMenuWrapper').style.display = 'none';
    socket = io();
    SetupSocket(socket);
    socket.emit('player_information',{
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

function sendNewMouseLocation(mouse){
    mouseCoords = {x: mouse.clientX-screenWidth/2, y: mouse.clientY-screenHeight/2};
}

c.addEventListener('mousemove', sendNewMouseLocation, false);




//w=87
//a=65
//s = 83
//d = 68

var map = {}; // You could also use an array
onkeydown = onkeyup = function(e){
    e = e || event; // to deal with IE
    if(e.type == 'keydown')
        map[e.keyCode] = true;
    if(e.type=='keyup')
        map[e.keyCode] = false;

}
var movespeed = 0.1;
function move(){
var vector = {x:0, y:0};
    if (!socket) return;
/*
    console.log(vector);
    vector.x -= movespeed*map[37];
    vector.y -= movespeed*map[38];
    vector.x += movespeed*map[39];
    vector.y += movespeed*map[40];
    console.log(vector);
    map[37] = 0;
    map[38] = 0;
    map[39] = 0;
    map[40] = 0;
    */

    if(map[65]==true){
        vector.x -=movespeed;
    }
    if(map[87]==true){
        vector.y-=movespeed;
    }
    if (map[68]==true){
        vector.x+=movespeed;
    }
    if(map[83]==true){
        vector.y+=movespeed;
    }
    console.log("moving: " + JSON.stringify(vector));
    socket.emit('move',vector);


}
updateRate=100;
setInterval(move, 1000 / updateRate);


function resize() {
    if (!socket) return;
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;

    var newDimensions = { windowWidth: screenWidth, windowHeight: screenHeight };
    socket.emit('window_resized', newDimensions);
}
window.addEventListener('resize', resize);

function sendClick(mouse) {
    if (!socket) return;
    var mouseCoords = {x: mouse.clientX-screenWidth/2, y: mouse.clientY-screenHeight/2};
    socket.emit('fire', mouseCoords);
}
c.addEventListener('click', sendClick, false);
