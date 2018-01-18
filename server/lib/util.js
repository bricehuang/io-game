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
  if(x*x+y*y<=0.1) ans+= 4;
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
      minDistance = Math.min(minDistance,potentialDistance);
    }
    if(minDistance>bestDistance){
      genX = curX;
      genY = curY;
      bestDistance = minDistance;
    }

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

exports.pointLineDistance = function(point, segment){
	var slope = (segment.point2.y-segment.point1.y)/(segment.point2.x-segment.point1.x);
	var intercept = segment.point1.y - segment.point1.x * slope;
	var footX = (slope*point.y + point.x - slope *intercept)/(1+slope*slope);
	var footY = slope * footX + intercept;
	var foot = {x:footX,y:footY};
	if((footX-segment.point1.x)*(footX-segment.point2.x)<0) {
		return {dist:exports.distance(foot,point), trueDist:exports.distance(foot,point), endpoint: false};
	}
	else{
		var d1 = exports.distance(point,segment.point1);
		var d2 = exports.distance(point,segment.point2);
		if(d1<d2)
			return {dist:exports.distance(foot,point), trueDist: d1, endpoint: true, index:1};
		else
			return {dist:exports.distance(foot,point), trueDist: d2, endpoint: true, index:2};
	}


}


exports.dotProduct = function(vector1, vector2){
	return vector1.x*vector2.x + vector1.y * vector2.y;
}

exports.segmentIntersect = function(segment1,segment2){
	var slope1 = (segment1.point2.y-segment1.point1.y)/(segment1.point2.x-segment1.point1.x);
	var slope2 = (segment2.point2.y-segment2.point1.y)/(segment2.point2.x-segment2.point1.x);
	var check = true;

	if(exports.pointLineDistance(segment1.point1,segment2).dist>100 && exports.pointLineDistance(segment1.point2,segment2).dist>100
		&& exports.pointLineDistance(segment2.point1,segment1).dist>100 && exports.pointLineDistance(segment2.point2,segment1).dist>100)
	{
	var intersectX = (segment2.point1.y - segment1.point1.y - slope2 * segment2.point1.x + slope1 * segment1.point1.x)/(slope1-slope2);
	var intersectY = slope1*(intersectX-segment1.point1.x)+segment1.point1.y;
	if( (intersectX-segment1.point1.x)*(intersectX-segment1.point2.x) >= 0)
		check = false;
	if( (intersectX-segment2.point1.x)*(intersectX-segment2.point2.x) >= 0)
		check = false;

	}

	return check;
}

exports.multinomialSelect = function(choices, weights){
  //weights and choices are equal length arrays. weights should add to 1. the probability of choosing choice[i] is weight[i].
  var alpha = Math.random();
  var boundary = 0;
  if(choices.length!=weights.length){
    console.log("SOMETHING WENT REALLY WRONG IN MULTINOMIAL SELECT YOU MIGHT WANT TO CHECK THIS OUT");
    return choices[0];
  }
  for(var i = 0;i<weights.length;i++){
    boundary+=weights[i];
    if(boundary>=alpha){
      return choices[i];
    }
  }
  if(boundary<0.9999){
    console.log("SOMETHING WENT REALLY WRONG IN MULTINOMIAL SELECT YOU MIGHT WANT TO CHECK THIS OUT");
    return choices[0];
  }
  else{
    return choices[Math.floor(alpha*choices.length)];
  }
}
/*
exports.hash = function(input, mod){
  var a = 33;
  for(var i = 0;)
}
exports.gcd = function(a,b){

}*/


exports.intoWall = function(point, vector, segment){
	var slope = (segment.point2.y - segment.point1.y)/(segment.point2.x - segment.point1.x);
	var intercept = segment.point1.y - slope * segment.point1.x;
	var above = (point.y > slope*point.x + intercept);
	if(vector.x<0)
		above = !above;
	if(above)
		return(vector.y/vector.x<slope);
	else
		return(vector.y/vector.x>slope);
	
}

exports.isPrime = function(number){
	var isPrime = true;
	for(var i=2; i< Math.sqrt(number); i++){
		if(number%i==0){
			isPrime = false;
		}
	}
	return isPrime;
}
