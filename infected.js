/* ==polyfills== */
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

/**
 * Creates an infected game
 */
var infected = function() {
	var settings = {             // the default settings
			width: 100,          // width of the world
			height: 100,         // height of the world
			sickDensity: .002,   // the ratio of the world that is sick
			healthyDensity: .1,  // the ratio of the world that is healthy
			aoeSize: 100         // the radius of the click-kill (Area-of-effect)
		},
		state = {                // the current state of the game
			staticPosHash: {},   // A hash table containing all static (non-moving) objects
			all: [],             // every actor in the world
			sick: [],            // all sick actors
			healthy: [],         // all healthy actors
			obstacles: []        // all static, non-permeable objects
		};
	
	/**
	 * Initializes the state to the provided settings
	 * @param userSettings {Object} any overrides to the default settings
	 * @returns {Object} the settings used to initialize the game
	 */
	function init(userSettings) {
		//merge settings
		for (prop in settings) {
			settings[prop] = userSettings[prop] || settings[prop];
		}
		
		state.width = settings.width;
		state.height = settings.height;
		
		/* ==populate== */
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

	/**
	 * Performs an Area-of-Effect on the world, killing anything in the radius
	 * @param point {Point} The center of the AOE
	 */
	function aoe(point) {
		//remove sick
		state.sick = state.sick.filter(function(x){ return !inRange(point, x, settings.aoeSize);});
		//remove healthy
		state.healthy = state.healthy.filter(function(x){ return !inRange(point, x, settings.aoeSize);});
	}

	/**
	 * Calculates the distance between two points
	 * @param pos1 {Point} The starting point
	 * @param pos2 {Point} The ending point
	 * @return {number} the distance between the two points
	 */
	function dist(pos1, pos2) {
		var xDist = pos1.x - pos2.x,
			yDist = pos1.y - pos2.y;
		if (xDist > state.width / 2) {
			xDist = (state.width - pos1.x) + pos2.x;
		} else if (xDist < -state.width / 2) {
			xDist = (state.width - pos2.x) + pos1.x;
		}
		if (yDist > state.height / 2) {
			yDist = (state.height - pos1.x) + pos2.x;
		} else if (yDist < -state.height / 2) {
			yDist = (state.height - pos2.x) + pos1.x;
		}
		return Math.pow(xDist, 2) + Math.pow(yDist, 2);
	}

	/**
	 * Calculates if two points are within a given range of each other
	 * @param pos1 {Point} The starting point
	 * @param pos2 {Point} The ending point
	 * @param dist {number} The ending point
	 * @returns {boolean} true if the points are within {dist} of each other
	 */
	function inRange(pos1, pos2, dist) {
		return Math.abs(pos1.x - pos2.x) <= dist && Math.abs(pos1.y - pos2.y) <= dist;
	}

	/**
	 * Calculates an Actors hash
	 * @param a {Actor} The Actor to hash based on their position
	 * @returns {number} The hash value
	 */
	function getPosHashActor(a) {
		return getPosHash(a.x, a.y);
	}

	/**
	 * Calculates a hash
	 * @param x {number} The x position
	 * @param y {number} The y position
	 * @returns {number} The hash value
	 */
	function getPosHash(x, y) {
		return x * state.height + y;
	}

	/* ==movement== */
	/**
	 * Moves all of the actors once
	 */
	function move() {
		var posMap = {}; //location sensitive hash map of all blockers;
		//copy existing blockers
		posMap = Object.create(state.staticPosHash);
		//move sick
		moveSick(posMap);
		//move healthy
		moveHealthy(posMap);
	}

	/**
	 * Moves all of the sick actors once
	 * @param posMap {Object} A hash set of the taken positions
	 */
	function moveSick(posMap) {
		var i = state.sick.length,
			sick,
			posHash;
		while(i--) {
			sick = state.sick[i];
			sick.oldX = sick.x;
			sick.oldY = sick.y;
			if (Math.random() < .1) {  // chance of sick moving is 10%
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

	/**
	 * Moves all of the healthy actors once
	 * @param posMap {Object} A hash set of the taken positions
	 */
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

	/**
	 * Update the fear of the healthy actors
	 * @param healthy {Array} The healthy actors
	 * @param posMap {Object} A hash set of the taken positions
	 */
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

	/**
	 * Given a set of targets, moves the actor towards the closest one
	 * @param actor {Actor} The actor to move
	 * @param targets {Array} Targets to move towards
	 * @param posMap {Object} Obstacles in the way
	 */
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
			var xDist = actor.x - closestTarget.x;
			if (Math.abs(xDist) < state.width / 2) {
				if (xDist < 0) {
					direction.x = 1;
				} else {
					direction.x = -1;
				}
			} else {
				if (xDist > 0) {
					direction.x = 1;
				} else {
					direction.x = -1;
				}
			}
		}
		if (actor.y - closestTarget.y !== 0) {
			var yDist = actor.y - closestTarget.y;
			if (Math.abs(yDist) < state.height / 2) {
				if (actor.y - closestTarget.y < 0) {
					direction.y = 1;
				} else {
					direction.y = -1;
				}
			} else {
				if (actor.y - closestTarget.y > 0) {
					direction.y = 1;
				} else {
					direction.y = -1;
				}
			}
		}
		tryMove2(actor, posMap, direction);
	}

	/**
	 * Given a set of targets, moves the actor away from all of them
	 * @param actor {Actor} The actor to move
	 * @param targets {Array} Targets to move away from
	 * @param posMap {Object} Obstacles in the way
	 */
	function avoid(actor, targets, posMap) {
		var openSpace = findOpenSpaceAround(actor, posMap);

		//move into space (or not at all)
		actor.x += openSpace.x;
		actor.y += openSpace.y;
	}

	/**
	 * Given a set of targets, moves the actor away from all of them
	 * @param actor {Actor} The actor to move
	 * @param targets {Array} Targets to move away from
	 * @param posMap {Object} Obstacles in the way
	 */
	function runAwayFrom(actor, target, posMap) {
		tryMove2(actor, posMap, {x: -target.x, y: -target.y});
	}

	/**
	 * Attempts to move an {actor} in a {direction}
	 * @param actor {Actor} The actor to move
	 * @param posMap {Object} Obstacles in the way
	 * @param direction {Object} The x,y direction to move
	 */
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

	/**
	 * Attempts to move an {actor} in a {direction}
	 * @param actor {Actor} The actor to move
	 * @param posMap {Object} Obstacles in the way
	 * @param direction {Object} The x,y direction to move
	 */
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

	/**
	 * Randomly tries to find space around an actor
	 * @param actor {Actor} The actor to move
	 * @param posMap {Object} Obstacles in the way
	 * @returns {Point} A director to move as an offset of x,y
	 */
	function findOpenSpaceAround(actor, posMap) {
		var x, y, 
			xdirections = [-1, 0, 1].shuffle(),
			ydirections = [-1, 0, 1].shuffle();
		//find unoccupied space
		for (var x=0; x<xdirections.length; x++) {
			for (var y=0; y<ydirections.length; y++) {
				if (!posMap[getPosHash(actor.x+xdirections[x], actor.y+ydirections[y])]) {
					return {x: xdirections[x], y: ydirections[y]};
				}
			}
		}
		return {x: 0, y: 0};
	}

	/**
	 * Randomly moves the actor
	 * @param actor {Actor} The actor to move
	 */
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

	/**
	 * Wraps an actor if they have walked off the world
	 * @param actor {Actor} The actor to wrap
	 */
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

	/**
	 * Returns a random position in the world
	 * @returns {Point} random position
	 */
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
