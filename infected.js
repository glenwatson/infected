// ==polyfills==
// Array.some()
if (!Array.prototype.some) {
	Array.prototype.some = function(fun /*, thisArg*/) {
		'use strict';
		if (this == null) {
			throw new TypeError('Array.prototype.some called on null or undefined');
		}
		if (typeof fun !== 'function') {
			throw new TypeError();
		}
		var t = Object(this);
		var len = t.length >>> 0;
		var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
		for (var i = 0; i < len; i++) {
			if (i in t && fun.call(thisArg, t[i], i, t)) {
				return true;
			}
		}
		return false;
	};
}
// Array.shuffle()
if (!Array.prototype.shuffle) {
	Array.prototype.shuffle = function() {
		var counter = this.length, temp, index;

		// While there are elements in the array
		while (counter > 0) {
			// Pick a random index
			index = Math.floor(Math.random() * counter);

			// Decrease counter by 1
			counter--;

			// And swap the last element with it
			temp = this[counter];
			this[counter] = this[index];
			this[index] = temp;
		}

		return this;
	}
}
// Object.create()
if (typeof Object.create != 'function') {
	Object.create = (function() {
		var Object = function() {};
		return function (prototype) {
			if (arguments.length > 1) {
				throw Error('Second argument not supported');
			}
			if (typeof prototype != 'object') {
				throw TypeError('Argument must be an object');
			}
			Object.prototype = prototype;
			var result = new Object();
			Object.prototype = null;
			return result;
		};
	})();
}

var infected = function() {
	var settings = {
			width: 100,
			height: 100,
			sickDensity: .002,
			healthyDensity: .1,
			aoeSize: 100
		},
		state = {
			staticPosHash: {},
			all: [],
			sick: [],
			healthy: [],
			obstacles: []
		};
	
	
	function init(userSettings) {
		//merge settings
		for (prop in settings) {
			settings[prop] = userSettings[prop] || settings[prop];
		}
		
		state.width = settings.width;
		state.height = settings.height;
		
		// ==populate==
		//populate obstacles
		/* 3 boxes */
		state.obstacles.push({x: Math.floor(state.width * .1), y: Math.floor(state.height * .1),
				w: Math.floor(state.width * .1), h: Math.floor(state.height * .6)});
		state.obstacles.push({x: Math.floor(state.width * .3), y: Math.floor(state.height * .5),
				w: Math.floor(state.width * .4), h: Math.floor(state.height * .3)});
		state.obstacles.push({x: Math.floor(state.width * .8), y: Math.floor(state.height * .2),
				w: Math.floor(state.width * .1), h: Math.floor(state.height * .5)});
		/* fort 
		state.obstacles.push({x: Math.floor(state.width * .4), y: Math.floor(state.height * .2),
				w: Math.floor(state.height * .2), h: 5});
		state.obstacles.push({x: Math.floor(state.width * .5), y: Math.floor(state.height * .2),
				w: Math.floor(state.height * .3), h: 5});
		state.obstacles.push({x: Math.floor(state.width * .4), y: Math.floor(state.height * .2),
				w: 5, h: Math.floor(state.height * .6)});
		state.obstacles.push({x: Math.floor(state.width * .6), y: Math.floor(state.height * .2),
				w: 5, h: Math.floor(state.height * .6)});
		state.obstacles.push({x: Math.floor(state.width * .4), y: Math.floor(state.height * .8)-1,
				w: Math.floor(state.height * .5), h: 5});
		*/

		/* boarders 
		state.obstacles.push({x: 0, y: 0, w: state.width, h: 1});
		state.obstacles.push({x: 0, y: 0, w: 1, h: state.height});
		state.obstacles.push({x: 0, y: state.height-1, w: state.width, h: 1});
		state.obstacles.push({x: state.width-1, y: 0, w: 1, h: state.height});
		*/
		
		var openSpaces = state.width * state.height;
		//build the position hash that will never change
		for (var i in state.obstacles) {
			var obstacle = state.obstacles[i];
			for (x = obstacle.x; x < obstacle.x+obstacle.w; x++) {
				for (y = obstacle.y; y < obstacle.y+obstacle.h; y++) {
					state.staticPosHash[getPosHash(x, y)] = true;
					openSpaces--;
				}
			}
		}
		
		//populate sick
		for (var i=0; i<openSpaces*settings.sickDensity; i++) {
			var s = randomPos();
			//keep trying until we aren't inside an obstacle
			while (state.staticPosHash[getPosHashActor(s)]) {
				s = randomPos();
			}
			s.type = 'sick';
			state.sick.push(s);
		}
	
		//populate healthy
		for (var i=0; i<openSpaces*settings.healthyDensity; i++) {
			var h = randomPos();
			//keep trying until we aren't inside an obstacle
			while (state.staticPosHash[getPosHashActor(h)]) {
				h = randomPos();
			}
			h.type = 'healthy';
			h.fear = 0;
			state.healthy.push(h);
		}
		return settings;
	}

	function aoe(point) {
		//remove sick
		state.sick = state.sick.filter(function(x){ return !inRange(point, x, settings.aoeSize);});
		//remove healthy
		state.healthy = state.healthy.filter(function(x){ return !inRange(point, x, settings.aoeSize);});
	}

	function dist(pos1, pos2) {
		return Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2);
	}
	function inRange(pos1, pos2, dist) {
		return Math.abs(pos1.x - pos2.x) <= dist && Math.abs(pos1.y - pos2.y) <= dist;
		//return dist(pos1, pos2) < 4;
	}
	function getPosHashActor(a) {
		return getPosHash(a.x, a.y);
	}
	function getPosHash(x, y) {
		return x * state.height + y;
	}


	// ==movement==
	function move() {
		var posMap = {}; //location sensitive hash map of all blockers;
		//copy existing blockers
		posMap = Object.create(state.staticPosHash);
		//move sick
		moveSick(posMap);
		//move healthy
		moveHealthy(posMap);
	}
	function moveSick(posMap) {
		var i = state.sick.length,
			sick,
			posHash;
		while(i--) {
			sick = state.sick[i];
			sick.oldX = sick.x;
			sick.oldY = sick.y;
			if (Math.random() < .1) {
				moveTowards(sick, state.healthy, posMap);
				wrap(sick);
			}
			posHash = getPosHashActor(sick);
			if (posMap[posHash]) { //collision
				sick.x = sick.oldX;
				sick.y = sick.oldY;
			} else {
				posMap[posHash] = sick;
			}
		}
	}
	function moveHealthy(posMap) {
		var i = state.healthy.length,
			healthy,
			posHash;
		while(i--) {
			healthy = state.healthy[i];
			healthy.oldX = healthy.x;
			healthy.oldY = healthy.y;
			if (healthy.fear == 0) { //calm
				if (Math.random() < .05) {
					moveRandom(healthy);
				}
			} else if (healthy.fear < 128) { //panicked
				avoid(healthy, state.sick, posMap);
			} else { //hysteric
				moveRandom(healthy);
			}
			wrap(healthy);
			posHash = getPosHashActor(healthy);
			if (posMap[posHash]) { //collision
				if (posMap[posHash].type === 'sick') { //infected
					healthy.type = 'sick';
					state.sick.push(state.healthy.splice(i, 1)[0]);
				}
				healthy.x = healthy.oldX;
				healthy.y = healthy.oldY;
			
			} else {
				posMap[posHash] = healthy;
				increaseFear(healthy, posMap);
			}
		}
	}
	function increaseFear(healthy, posMap) {
		var topLeft = posMap[getPosHash(healthy.x-1, healthy.y-1)];
		var topMid = posMap[getPosHash(healthy.x, healthy.y-1)];
		var topRight = posMap[getPosHash(healthy.x+1, healthy.y-1)];
		var midLeft = posMap[getPosHash(healthy.x-1, healthy.y)];
		var midRight = posMap[getPosHash(healthy.x+1, healthy.y)];
		var botLeft = posMap[getPosHash(healthy.x-1, healthy.y+1)];
		var botMid = posMap[getPosHash(healthy.x, healthy.y+1)];
		var botRight = posMap[getPosHash(healthy.x+1, healthy.y+1)];
		if ((topLeft && (topLeft.type == 'sick' || topLeft.fear > 0)) ||
			(topMid && (topMid.type == 'sick' || topMid.fear > 0)) ||
			(topRight && (topRight.type == 'sick' || topRight.fear > 0)) ||
			(midLeft && (midLeft.type == 'sick' || midLeft.fear > 0)) ||
			(midRight && (midRight.type == 'sick' || midRight.fear > 0)) ||
			(botLeft && (botLeft.type == 'sick' || botLeft.fear > 0)) ||
			(botMid && (botMid.type == 'sick' || botMid.fear > 0)) ||
			(botRight && (botRight.type == 'sick' || botRight.fear > 0))
			){
			//increase fear
			healthy.fear = Math.min(healthy.fear+10, 1000);
		} else {
			healthy.fear = Math.max(healthy.fear-1, 0);
		}
	}
	function moveTowards(actor, targets, posMap) {
		//find closest target
		var closestTarget = null;
		var closestDist = Infinity;
		for (var i=0; i<targets.length; i++) {
			var d = dist(targets[i], actor);
			if (d < closestDist) {
				closestDist = d;
				closestTarget = targets[i];
			}
		}
		// if no target, move random
		if (closestTarget === null) {
			moveRandom(actor);
			return;
		}
		//move towards target
		var direction = {x:0, y:0};
		if (actor.x - closestTarget.x !== 0) {
			if (actor.x - closestTarget.x < 0) {
				direction.x = 1;
			} else {
				direction.x = -1;
			}
		}
		if (actor.y - closestTarget.y !== 0) {
			if (actor.y - closestTarget.y < 0) {
				direction.y = 1;
			} else {
				direction.y = -1;
			}
		}
		tryMove2(actor, posMap, direction);
	}
	function avoid(actor, targets, posMap) {
		var openSpace = findOpenSpaceAround(actor, posMap);

		//move into space (or not at all)
		actor.x += openSpace.x;
		actor.y += openSpace.y;
	}
	function runAwayFrom(actor, target, posMap) {
		tryMove2(actor, posMap, {x: -target.x, y: -target.y});
	}
	function tryMove(actor, posMap, direction) {
		actor.x += direction.x;
		actor.y += direction.y;
		//check for obstacle
		if (posMap[getPosHashActor(actor)]) { //blocked
			//try to move X only
			var y = actor.y;
			actor.y = actor.oldY;
			if (posMap[getPosHashActor(actor)]) { //still blocked
				//try to move Y only
				actor.y = y;
				actor.x = actor.oldX;
			}
		}
	}
	function tryMove2(actor, posMap, direction) {
		//check for obstacle
		if (!posMap[getPosHash(actor.x+direction.x, actor.y+direction.y)]) { //not blocked
			actor.x += direction.x;
			actor.y += direction.y;
			return;
		}
		//try to move X only
		else if (!posMap[getPosHash(actor.x+direction.x, actor.y)]) { //not blocked
			actor.x += direction.x;
			actor.y += 0;
			return;
		}
		//try to move Y only
		else if (!posMap[getPosHash(actor.x, actor.y+direction.y)]) { //not blocked
			actor.x += 0;
			actor.y += direction.y;
			return;
		}
		else if (direction.y === 0) {
			// try to move diagonally
			if (!posMap[getPosHash(actor.x+direction.x, actor.y+1)]) { //not blocked
				actor.x += direction.x;
				actor.y += 1;
				return;
			}
			// try to move diagonally
			else if (!posMap[getPosHash(actor.x+direction.x, actor.y-1)]) { //not blocked
				actor.x += direction.x;
				actor.y += -1;
				return;
			}
			// try to move sideways
			else if (!posMap[getPosHash(actor.x, actor.y+1)]) { //not blocked
				actor.x += 0;
				actor.y += 1;
				return;
			}
			// try to move sideways
			else if (!posMap[getPosHash(actor.x, actor.y-1)]) { //not blocked
				actor.x += 0;
				actor.y += -1;
				return;
			}
		}
		else if (direction.x === 0) {
			// try to move diagonally
			if (!posMap[getPosHash(actor.x+1, actor.y+direction.y)]) { //not blocked
				actor.x += 1;
				actor.y += direction.y;
				return;
			}
			// try to move diagonally
			else if (!posMap[getPosHash(actor.x-1, actor.y+direction.y)]) { //not blocked
				actor.x += -1;
				actor.y += direction.y;
				return;
			}
			// try to move sideways
			else if (!posMap[getPosHash(actor.x+1, actor.y)]) { //not blocked
				actor.x += 1;
				actor.y += 0;
				return;
			}
			// try to move sideways
			else if (!posMap[getPosHash(actor.x-1, actor.y)]) { //not blocked
				actor.x += -1;
				actor.y += 0;
				return;
			}
		}
		//blocked
	}
	function findOpenSpaceAround(actor, posMap) {
		var x, y, 
			Xdirections = [-1, 0, 1].shuffle(), 
			Ydirections = [-1, 0, 1].shuffle();
		//find unoccupied space
		for (var x=0; x<Xdirections.length; x++) {
			for (var y=0; y<Ydirections.length; y++) {
				if (!posMap[getPosHash(actor.x+Xdirections[x], actor.y+Ydirections[y])]) {
					return {x: Xdirections[x], y: Ydirections[y]};
				}
			}
		}
		return {x: 0, y: 0};
	}
	function moveRandom(actor) {
		var entropy = Math.random();
		if (entropy > .7) {
			actor.x++;
		} else if (entropy < .3) {
			actor.x--;
		}
		if (entropy % 0.1 > .07) {
			actor.y++;
		} else if (entropy % 0.1 < .03) {
			actor.y--;
		}
	}
	function wrap(actor) {
		if (actor.x < 0) {
			actor.x = state.width;
		}
		if (actor.x > state.width) {
			actor.x = 0;
		}
		if (actor.y < 0) {
			actor.y = state.height;
		}
		if (actor.y > state.height) {
			actor.y = 0;
		}
	}
	function randomPos() {
		return {
			x: Math.floor(Math.random() * state.width),
			y: Math.floor(Math.random() * state.height)
		};
	}
	
	return {
		init: init,
		move: move,
		aoe: aoe,
		state: state
	};
};
