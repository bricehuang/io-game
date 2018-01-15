exports.gaussianCircleGenerate = function(radius, flattenFactor, epsilon){
	var genX=0;
	var genY=0;
	var flattenFactor = 1.0;
	var count = 0;
	while(count<50){
	    count++;
	    console.log("trying");
	    var x = Math.random()*2-1;
	    var y = Math.random()*2-1;
	    var s = x*x+y*y;
	    if(s>=1) continue;
	    if(s<epsilon) continue;
	    console.log("mag " + (-2*Math.log(s)));
	    if(-2*flattenFactor*Math.log(s)>=1) continue;
	    var f = Math.sqrt(-2*Math.log(s)/s);
	    genX = x*f;
	    genY = y*f;
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
		if(otherPoints.length==0) break;
		var minDistance = Infinity;
		for (var pnt of otherPoints){
			minDistance = Math.min(minDistance,exports.distance({x:curX,y:curY,},pnt));
		}
		if(minDistance>bestDistance){
			genX = curX;
			genY = curY;
		}
	}
	return {x:genX*radius,y:genY*radius};
};
exports.distance = function(firstPoint, secondPoint){
	return Math.sqrt((firstPoint.x-secondPoint.x)*(firstPoint.x-secondPoint.x)+(firstPoint.y-secondPoint.y)*(firstPoint.y-secondPoint.y));
};
exports.fake = function(){
	return {x:35,y:45,};
};