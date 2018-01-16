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
}
exports.distance = function(firstPoint, secondPoint){
	return exports.magnitude({x: firstPoint.x-secondPoint.x, y: firstPoint.y-secondPoint.y});
};
exports.collided = function(firstObject, secondObject,epsilon){
	var dist = exports.distance(firstObject,secondObject);
	if(dist<=(1+epsilon)*(firstObject.radius+secondObject.radius)){
		return true;
	}
	return false;
}