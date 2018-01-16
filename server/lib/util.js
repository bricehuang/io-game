exports.gaussianCircleGenerate = function(radius, flattenFactor, epsilon){
  var genX=0;
  var genY=0;
  var flattenFactor = 1.0;
  var count = 0;
  while(count<50){
    count++;
    var x = Math.random()*2-1;
    var y = Math.random()*2-1;
    var s = x*x+y*y;
    if(s>=1) continue;
    if(s<epsilon) continue;
    //console.log("mag " + (-2*Math.log(s)));
    if(-2*flattenFactor*flattenFactor*Math.log(s)>=1) continue;
    var f = Math.sqrt(-2*Math.log(s)/s);
    genX = flattenFactor*x*f;
    genY = flattenFactor*y*f;
    break;
  }
  return {x:radius*genX,y:radius*genY};
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
    genX = curX;
    genY = curY;
    if(otherPoints.size==0) break;
    var minDistance = Infinity;
    for (var key of otherPoints.keys()){
      minDistance = Math.min(minDistance,exports.distance({x:curX,y:curY,},otherPoints.get(key)));
    }
    if(minDistance>bestDistance){
      genX = curX;
      genY = curY;
    }
  }
  return {x:genX*radius,y:genY*radius};
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
		var trueDist = Math.min(exports.distance(point,segment.point1), exports.distance(point,segment.point2));
		return {dist:exports.distance(foot,point), trueDist: trueDist, endpoint: true};
	}


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
