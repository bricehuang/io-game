exports.metropolisHastings = function(pdf){
  var curX = 0;
  var curY = 0;
  var numSteps = 50;
  var count = 0;
  while(count<numSteps){
    count++;
    var proposeX = curX+(2*Math.random()-1)/10;
    var proposeY = curY+(2*Math.random()-1)/10;
    var curPower = pdf(curX,curY);
    var nextPower = 0;
    if(proposeX*proposeX+proposeY*proposeY<=1){
      nextPower = pdf(proposeX,proposeY);
    }
    if(Math.random()*curPower<nextPower){
      curX = proposeX;
      curY = proposeY;
    }
  }
  return {x:curX, y:curY};
}
exports.quad = function(x,y){
  var ans = 4;
  if(x*x+y*y<=0.1) ans+= 16;
  return ans;
  //return 1/(1+10*(x*x+y*y)*(x*x+y*y));
}

exports.gaussianCircleGenerate = function(radius, flattenFactor, epsilon){
  smallGen = exports.metropolisHastings(exports.quad);
  return {x:radius*smallGen.x,y:radius*smallGen.y};
  /*
  var genX=0;
  var genY=0;
  var flattenFactor = 1.0;
  var count = 0;

  while(count<50){
    count++;
    var cutoff = 1;
    var u1 = Math.random();
    var u2 = Math.random();
    var k = Math.sqrt(-2*Math.log(u1));
    genX = k*Math.cos(2*Math.PI*u2);
    genY = k*Math.sin(2*Math.PI*u2);
    if(genX*genX+genY*genY<=cutoff*cutoff){
      genX/=cutoff;
      genY/=cutoff;
      break;
    }*/


    /*
    var x = Math.random()*2-1;
    var y = Math.random()*2-1;
    var s = x*x+y*y;
    if(s>=1) continue;
    if(s<epsilon*epsilon) continue;
    //console.log("mag " + (-2*Math.log(s)));
    if(-2*flattenFactor*flattenFactor*Math.log(s)>=1) continue;
    var f = Math.sqrt(-2*Math.log(s)/s);
    genX = x*f;
    genY = y*f;


    break;
  }
  return {x:radius*genX,y:radius*genY};*/

};
exports.uniformCircleGenerate  = function(radius, otherPoints){
  var genX = 0;
  var genY = 0;
  var count = 0;
  var bestDistance = 0;
  while(count<15){
    count++;
    while(true){
      var curX = 2*Math.random()-1;
      var curY = 2*Math.random()-1;
      if(curX*curX+curY*curY<1) break;
    }
    curX*=radius;
    curY*=radius;
    if(count==1){
      genX = curX;
      genY = curY; 
    }
    if(otherPoints.size==0) break;
    var minDistance = Infinity;
    for (var [key,point] of otherPoints){
      potentialDistance = exports.distance({x:curX,y:curY},point);
      console.log("potential distance is " + potentialDistance);
      minDistance = Math.min(minDistance,potentialDistance);
      console.log("min is now " + minDistance);
    } 
    if(minDistance>bestDistance){
      genX = curX;
      genY = curY;
      bestDistance = minDistance;
    }
    console.log("current best distance after " + count + " tries is " + bestDistance);

  }
  return {x:genX,y:genY};
};
exports.magnitude = function(point){
  return Math.sqrt(point.x*point.x + point.y*point.y);
};
exports.distance = function(firstPoint, secondPoint){
  return exports.magnitude({x: firstPoint.x-secondPoint.x, y: firstPoint.y-secondPoint.y});
};
exports.collided = function(firstObject, secondObject,epsilon){
  var dist = exports.distance(firstObject,secondObject);
  return (dist<=(1+epsilon)*(firstObject.radius+secondObject.radius))
};
