exports.magnitude = function(point) {
  return Math.sqrt(point.x * point.x + point.y * point.y);
};

exports.diff = function(vec1, vec2) {
  return {x: vec1.x-vec2.x, y: vec1.y-vec2.y};
}
exports.add = function(vec1, vec2) {
  return {x: vec1.x+vec2.x, y: vec1.y+vec2.y};
}
exports.scale = function(vector, scalar) {
  return {x: vector.x*scalar, y: vector.y*scalar};
}
exports.normalize = function(vector) {
  var magnitude = exports.magnitude(vector);
  if (magnitude > 0) {
    return exports.scale(vector, 1/magnitude);
  } else {
    return vector;
  }
}
exports.scaleToLength = function(vector, length) {
  return exports.scale(exports.normalize(vector), length);
}
exports.intify = function(vector) {
  return {x: vector.x|0, y: vector.y|0};
}

exports.distance = function(vec1, vec2){
  return exports.magnitude(exports.diff(vec1, vec2));
};

exports.dotProduct = function(vector1, vector2){
  return vector1.x * vector2.x + vector1.y * vector2.y;
};

exports.slope = function(segment) {
  return (segment.point2.y - segment.point1.y) / (segment.point2.x - segment.point1.x);
};

exports.metropolisHastings = function(pdf){
  var curX = 0;
  var curY = 0;
  var numSteps = 50;
  var count = 0;
  while (count < numSteps) {
    count++;
    var proposeX = curX + (2 * Math.random() - 1) / 10;
    var proposeY = curY + (2 * Math.random() - 1 ) / 10;
    var curPower = pdf(curX, curY);
    var nextPower = 0;
    if (exports.magnitude({x: proposeX, y: proposeY}) <= 1) {
      nextPower = pdf(proposeX, proposeY);
    }
    if (Math.random() * curPower < nextPower){
      curX = proposeX;
      curY = proposeY;
    }
  }
  return {x: curX, y: curY};
};

exports.quad = function(x,y) {
  return x * x + y * y <= 0.1 ? 8 : 4;
};

exports.gaussianCircleGenerate = function(radius, flattenFactor, epsilon){
  smallGen = exports.metropolisHastings(exports.quad);
  return {x: radius * smallGen.x, y: radius * smallGen.y};
};

exports.uniformCircleGenerate  = function(radius, otherPoints){
  var genX = 0;
  var genY = 0;
  var count = 0;
  var bestDistance = 0;
  while (count < 15) {
    count++;
    while (true) {
      var curX = 2 * Math.random() - 1;
      var curY = 2 * Math.random() - 1;
      if (exports.magnitude({x: curX, y: curY}) < 1) {
        break;
      }
    }
    curX *= radius;
    curY *= radius;
    if (count == 1){
      genX = curX;
      genY = curY;
    }
    if (otherPoints.size==0) break;
    var minDistance = Infinity;
    for (var [key, point] of otherPoints){
      potentialDistance = exports.distance({x: curX, y: curY}, point);
      minDistance = Math.min(minDistance, potentialDistance);
    }
    if (minDistance > bestDistance) {
      genX = curX;
      genY = curY;
      bestDistance = minDistance;
    }
  }
  return {x: genX, y: genY};
};

exports.collided = function(firstObject, secondObject, epsilon) {
  var dist = exports.distance(firstObject.position, secondObject);
  return dist <= (1 + epsilon) * (firstObject.radius + secondObject.radius);
};

exports.pointLineDistance = function(point, segment) {
  var slope = exports.slope(segment);
	var intercept = segment.point1.y - segment.point1.x * slope;
	var footX = (slope * point.y + point.x - slope * intercept) / (1 + slope * slope);
	var footY = slope * footX + intercept;
	var foot = {x: footX, y: footY};
	if ((footX - segment.point1.x) * (footX - segment.point2.x) < 0) {
		return {
      dist: exports.distance(foot, point),
      trueDist: exports.distance(foot, point),
      endpoint: false
    };
	}
	else {
		var d1 = exports.distance(point, segment.point1);
		var d2 = exports.distance(point, segment.point2);
    ret = {
      dist: exports.distance(foot, point),
      endpoint: true
    };
    if (d1 < d2) {
      ret.trueDist = d1;
      ret.index = 1;
    } else {
      ret.trueDist = d2;
      ret.index = 2;
    }
	}
  return ret;
};

exports.segmentIntersect = function(segment1, segment2){
	if (exports.pointLineDistance(segment1.point1, segment2).dist > 100 &&
      exports.pointLineDistance(segment1.point2, segment2).dist > 100 &&
		  exports.pointLineDistance(segment2.point1, segment1).dist > 100 &&
      exports.pointLineDistance(segment2.point2, segment1).dist > 100) {
    var slope1 = exports.slope(segment1);
    var slope2 = exports.slope(segment2);
  	var intersectX = (segment2.point1.y - segment1.point1.y - slope2 * segment2.point1.x + slope1 * segment1.point1.x) / (slope1 - slope2);
  	var intersectY = slope1 * (intersectX - segment1.point1.x) + segment1.point1.y;
  	if ((intersectX - segment1.point1.x) * (intersectX - segment1.point2.x) >= 0 ||
        (intersectX - segment2.point1.x) * (intersectX - segment2.point2.x) >= 0) {
      return false;
    }
  }
  return true;
};

exports.multinomialSelect = function(choices, weights){
  // Weights and choices are equal length arrays.
  // Weights should add to 1. The probability of choosing choice[i] is weight[i].
  var alpha = Math.random();
  var boundary = 0;
  if (choices.length != weights.length) {
    console.error("SOMETHING WENT REALLY WRONG IN MULTINOMIAL SELECT YOU MIGHT WANT TO CHECK THIS OUT");
    return choices[0];
  }
  for (var i = 0; i < weights.length; i++) {
    boundary += weights[i];
    if (boundary >= alpha) {
      return choices[i];
    }
  }
  if (boundary < 0.9999) {
    console.error("SOMETHING WENT REALLY WRONG IN MULTINOMIAL SELECT YOU MIGHT WANT TO CHECK THIS OUT");
    return choices[0];
  }
  else {
    return choices[Math.floor(alpha * choices.length)];
  }
};

exports.hash = function(input, mod){
  var a = 33;
  var b = 47;
  input = input % mod;
  for (var i = 0; i < 5; i++) {
    input = (a * input + b) % mod;
  }
};

exports.intoWall = function(point, vector, segment){
  var slope = exports.slope(segment);
	var intercept = segment.point1.y - slope * segment.point1.x;
	var above = point.y > slope * point.x + intercept;
	if (vector.x < 0) {
		above = !above;
  }
	if (above) {
		return vector.y / vector.x < slope;
  } else {
		return vector.y / vector.x > slope;
  }
};

