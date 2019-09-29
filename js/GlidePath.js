

/*---------------------------------------------------------------------------*/
// Create the canvas
let canvas = document.createElement("canvas");
let ctx = canvas.getContext("2d");
canvas.width = 1200; //512; // window.innerWidth
canvas.height = 680; //680; // window.innerHeight
document.body.appendChild(canvas);

/*---------------------------------------------------------------------------*/
function ASSERT(cond, str)
{
	if (!cond)
		alert(str | "assert");
}

/*---------------------------------------------------------------------------*/
// utilities
let rnd = function(min, max) { return (min + Math.floor(Math.random() * (max - min))); }
let RandomWidth = function (padL,padR) { return rnd(padL, canvas.width - (padR || padL)); }
let RandomHeight = function (padT,padB) { return rnd(padT, canvas.height - (padB || padT)); }
let RGB = function(r, g ,b) { return 'rgb(' + r + ',' + g + ',' + b +')'; }
let RandomColor = function() { return RGB(rnd(0,255), rnd(0,255), rnd(0,255)); }

/*---------------------------------------------------------------------------*/
const kMaxNumObjects = 256;
const kRotateSpeed = 8; // below 8 gets cheesy and too fast
const kThrustSpeed = 647; //650; //620;
const kGroundMidpoint = 300;
const kDistanceGameScoreCutoff = 48; //32;
const kGroundCollisionBuffer = 1;
const kGroundSpeedBottom = 160;
const kGroundSpeedTop = 190;

/*---------------------------------------------------------------------------*/
const kBackgroundColor = RGB(54,61,69);
const kTextColor = RGB(250,250,250); 
const kShipColor = RGB(20,119,155); 
const kLineColor = RGB(124,209,12); 

/*---------------------------------------------------------------------------*/
const eWaitingForStart = 'eWaitingForStart';
const eStarting = 'eStarting';
const eStarted = 'eStarted';
const eEnded = 'eEnded';

/*---------------------------------------------------------------------------*/
const M_PI = Math.PI;
const M_2PI = (2 * M_PI);
const M_PI_4 = (M_PI / 4);
const M_PI_8 = (M_PI / 8);
const M_3PI_8 = (3 * M_PI / 8);
const INT_MAX = 1000000;

/*---------------------------------------------------------------------------*/
let gNowMS = Date.now();
let gObjects = [];
let gGroundObjects = [];
let gShipObject = {};
let gShipDistanceFromGround = 0;
let gShipAngle = 0;
let gThrusting = false;
let gAngleStart = 0;
let gShipBlinkEndMS_RotateMS = 0;
let gWasRotating = false;
let gNumRotations = 0;
let gNextBlinkMS = 0;
let gBlink = false;
let gNumActiveObjects = 0;
let gLastShootMS = 0;
let gGameStartTimeMS = 0;
let gGameState = eWaitingForStart;
let gScore = 0;
let gScoreBest = 0;
let gScoreBestAllTime = 0;
let gScoreEventCounter = new Map();
let gScoreEventCounterBest = new Map();
let gScoreEventCounterBestAllTime = new Map();
let gPointsByKeepingLowIndex = 1;
let gPointsByKeepingLow = 0;
let gSwitch = false;

/*---------------------------------------------------------------------------*/
const types = 
{
    SHIP: 			1 << 0,
    GROUND: 		1 << 1,
    IMAGE: 			1 << 2,
    ICON: 			1 << 3,
    CIRCLE: 		1 << 4,
    VECTOR: 		1 << 5,
    BULLET: 		1 << 6,
    FRAGMENT: 		1 << 7,
    TEXT_BUBBLE: 	1 << 8
}

/*---------------------------------------------------------------------------*/
const scores = 
{
	eNullEvent : 				'eNullEvent',
	eStayedLow : 				'eStayedLow',
	eRescuedHostage : 			'eRescuedHostage',
	eRescuedHostage2 : 			'eRescuedHostage2',
	eRescuedHostage3 : 			'eRescuedHostage3',
	eSingleRotate : 			'eSingleRotate',
	eDoubleRotate : 			'eDoubleRotate',
	eTripleRotate : 			'eTripleRotate',
	eQuadrupleRotate : 			'eQuadrupleRotate',
	eQuintupleRotate : 			'eQuintupleRotate',
	eSingleRotateWithRescue : 	'eSingleRotateWithRescue',
	eDoubleRotateWithRescue : 	'eDoubleRotateWithRescue',
	eTripleRotateWithRescue : 	'eTripleRotateWithRescue'
};

/*---------------------------------------------------------------------------*/
function Object(type, x, y, velX, velY, accX, accY, color, size) 
{
	this.type = type;
	this.x = x;
	this.y = y;
	this.velX = velX;
	this.velY = velY;
	this.accX = accX;
	this.accY = accY;
	this.color = color;
	this.size = size;
	this.width = size;
	this.height = size;
	this.ready = true;
	this.alive = true;
	this.isFixed = false;
	this.killedByBitmask = 0;

	AddObject(this);
}

/*---------------------------------------------------------------------------*/
function AddObject(obj)
{
	// add to the gObjects array
	if (gObjects.length < kMaxNumObjects)
	{
		gObjects.push(obj);
	}
	else
	{
		// once gObjects has filled up, look for an unused slot - this keeps
		// the gObjects array from growing indefinitely - this is important
		// since we iterate through the entire gObjects array on every frame
		// also, by re-using these slots, we avoid the JS garbage collection
		let foundOpenSlot = false;
		for(let i = 0; i < gObjects.length; i++) 
		{
			if (!gObjects[i].alive)
			{
				// found a free slot
				gObjects[i] = obj;
				foundOpenSlot = true;
				break;
			}
		}

		// if you hit this assert it means you've exceeded kMaxNumObjects
		// (it's OK to increase kMaxNumObjects but it will impact performance)
		ASSERT(foundOpenSlot, "Exceeded kMaxNumObjects");
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.isActive = function() { return (this.ready && this.alive); }
Object.prototype.setLifetime = function(ms) { this.expireTimeMS = (gNowMS + ms); }
Object.prototype.setKilledBy = function(types) { this.killedByBitmask |= types; }
Object.prototype.isKilledBy = function(obj) { return this.killedByBitmask & obj.type; }

/*---------------------------------------------------------------------------*/
function CalcSinCosForShip(a)
{
	gShipAngleCos = Math.cos(gShipAngle);
	gShipAngleSin = Math.sin(gShipAngle);
}

/*---------------------------------------------------------------------------*/
// rotate point p around center point c, and return rotated point
function Rotate(p, c, sin, cos)
{
	// normalize
	p.x -= c.x;
	p.y -= c.y;

	// rotate
	const h = (p.x * cos - p.y * sin);
	const v = (p.x * sin + p.y * cos);

	// un-normalize
	p.x = (h + c.x);
	p.y = (v + c.y);

	return p;
}

/*---------------------------------------------------------------------------*/
let DrawPolygon = function (vs, color) 
{
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.shadowBlur = DoShadow() ? 20 : 0; 
	ctx.shadowColor = "white";
	ctx.moveTo(vs[0].x, vs[0].y);
	for(let i = 1; i < vs.length; i++)
		ctx.lineTo(vs[i].x, vs[i].y);
	ctx.closePath();
	ctx.fill();

	ctx.shadowBlur = 0; // reset
}

/*---------------------------------------------------------------------------*/
let RotateAndDraw = function (vs, pos, color) 
{
	// rotate the vertices and store in rv
	let rv = []; 
	for (let i = 0; i < vs.length; i++)
	{
		let pt = Rotate(vs[i], pos, gShipAngleSin, gShipAngleCos);
		rv.push(pt);
	}

	DrawPolygon(rv, color);

	// return rotated vertices (only used for shipObject)
	return rv; 	
}

/*---------------------------------------------------------------------------*/
let DoBlink = function()
{
	return (gShipBlinkEndMS_RotateMS > gNowMS);
}

/*---------------------------------------------------------------------------*/
let DoShadow = function()
{
	return (gShipDistanceFromGround < kDistanceGameScoreCutoff);
}

/*---------------------------------------------------------------------------*/
let ColorForShip = function () 
{
	let color = gShipObject.color;
	const kBlinkSpeedMS = 100;

	// handle blinking
	if (DoBlink())
	{
		if (gNextBlinkMS === 0 || (gNextBlinkMS < gNowMS))
		{
			gBlink = (gNextBlinkMS === 0) ? true : !gBlink;
			gNextBlinkMS = (gNowMS + kBlinkSpeedMS);
		}

		color = gBlink ? gShipObject.color : "white";
	}
	else
		gNextBlinkMS = 0;

	return color;
}

/*---------------------------------------------------------------------------*/
let ResetShip = function () 
{
	//Explosion(gShipObject.x, gShipObject.y);
	gShipObject.isFixed = true;
	gShipAngle = 0;
	CalcSinCosForShip();
	gShipObject.x = (canvas.width / 2);
	gShipObject.y = 400; // kGroundMidpoint;
	gShipObject.velX = 0;
	gShipObject.velY = 0;
	gShipObject.accX = 0;
	gShipObject.accY = 100;
	gShipBlinkEndMS_RotateMS = (gNowMS + 800);

	gGameState = eEnded;
}

/*---------------------------------------------------------------------------*/
let DrawShip = function (obj) 
{
	const kBaseWidth = 16;
	const kHeight = 8;
	const kHalfBaseWidth = (kBaseWidth / 2);
	const kHalfHeight = kHeight / 2;
	const kCenterIndent = 4;
	const kThrustWidth = ((kBaseWidth / 4) - 1);
	const kThrustHeight = 8;

	let ship = [];
	ship.push({x: (obj.x - kHalfBaseWidth), y: (obj.y + kHalfHeight)}); // bottomL
	ship.push({x: (obj.x), y: (obj.y + kHalfHeight - kCenterIndent)}); // bottomC
	ship.push({x: (obj.x + kHalfBaseWidth), y: (obj.y + kHalfHeight)}); // bottomR
	ship.push({x: (obj.x), y: (obj.y - kHalfHeight)});	// top

	gShipObject.vertices = RotateAndDraw(ship, obj, ColorForShip());

	if (gThrusting)
	{
		// draw thrust triangle
		let thrust = [];
		thrust.push({x: (obj.x - kThrustWidth), y: (obj.y + kHalfHeight)}); // bottomL
		thrust.push({x: (obj.x), y: (obj.y + kHalfHeight + kThrustHeight)}); // bottomC
		thrust.push({x: (obj.x + kThrustWidth), y: (obj.y + kHalfHeight)}); // bottomR

		RotateAndDraw(thrust, obj, "red");
	}
}

/*---------------------------------------------------------------------------*/
let DrawCircle = function (obj, r, color) 
{
	// use args if provided, else use object state
	r = r || obj.size;
	color = color || obj.color;

	ctx.beginPath();
	ctx.fillStyle = color;

	// handle gradients
	if (obj.gradient || obj.lightGradient)
	{
		var gradient = ctx.createLinearGradient(obj.x,obj.y,obj.x+r,obj.y+r);

		if (obj.lightGradient)
		{
			gradient.addColorStop(0, color);
			gradient.addColorStop(1, "white");
		}
		else
		{
			gradient.addColorStop(0, "black");
			gradient.addColorStop(0.5, color);
			gradient.addColorStop(1, color);
			ctx.shadowBlur = obj.shadowBlur;
			ctx.shadowColor = "white";
		}

		ctx.fillStyle = gradient;
	}

	ctx.arc(obj.x, obj.y, r, 0, M_2PI);
	ctx.fill();

	ctx.shadowBlur = 0; // reset
}

/*---------------------------------------------------------------------------*/
Object.prototype.draw = function() 
{
	switch (this.type)
	{
		case types.IMAGE:
			ctx.drawImage(this.image, this.x, this.y);
			break;
		case types.CIRCLE:
			DrawCircle(this);
			break;
		case types.BULLET:
			DrawCircle(this, 3, "red");
			break
		case types.FRAGMENT:
			DrawCircle(this, 2, "white");
			break;
		case types.SHIP:
			DrawShip(this);
			break;
		case types.GROUND:
			DrawGroundObject(this);
			break;
		case types.TEXT_BUBBLE:
			DrawTextObject(this);
			break;
	}
};

/*---------------------------------------------------------------------------*/
Object.prototype.updateAliveState = function() 
{
	// check expireTimeMS
	const expired = (this.expireTimeMS && this.expireTimeMS < gNowMS);
	if (expired)
	{
		this.alive = false;
		return;
	}

	// ground objects die when their right endpoint hits the left edge
	if (this.type === types.GROUND)
	{
		if (this.rightX < 0)
			this.alive = false;
		return;
	}

	// objects die when they go off the right or left side of the screen
	if (this.type !== types.SHIP)
	{
		if (this.x < 0 || this.x > canvas.width)
			this.alive = false;

		if (this.y > canvas.height)
			this.alive = false;
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.applyPhysics = function(delta) 
{
	if (!this.isFixed)
	{	
		// apply acceleration to velocity
		this.velX += (this.accX * delta);
		this.velY += (this.accY * delta);

		// apply velocity to position
		this.x += (this.velX * delta);
		this.y += (this.velY * delta);
	}

	// if this object has gravity, reset its acceleration
	if (this.mass)
	{
		this.accX = 0;
		this.accY = 0;
	}
};

/*---------------------------------------------------------------------------*/
Object.prototype.adjustBounds = function() 
{
	if (this.type === types.SHIP)
	{
		// bound ship at the bottom
		const lowBound = (canvas.height - 20);
		if (this.y > lowBound)
		{
			this.y = lowBound;
			this.velY = 0;
		}

		// ship wraps horizontally
		if (this.x > canvas.width)
			this.x = 0;
		else if (this.x < 0)
			this.x = canvas.width;
	}
}

/*---------------------------------------------------------------------------*/
let NewTextBubble = function(text, pos, color)
{
	const x = pos.x - 50;
	const y = pos.y - 50;
	let obj = new Object(types.TEXT_BUBBLE, x, y, -20, -50, 20, -20, color, 0);
	obj.text = text;
	obj.setLifetime(3000);
}

/*---------------------------------------------------------------------------*/
let TextColorForScoreEvent = function(ev)
{
	switch (ev)
	{
		case scores.eRescuedHostage:
		case scores.eRescuedHostage2:
		case scores.eRescuedHostage3:
			return "white";
		case scores.eSingleRotate:
			return "yellow";
		case scores.eDoubleRotate:
			return "orange";
		case scores.eTripleRotate:
			return "red";
		case scores.eQuadrupleRotate:
			return "blue";
		case scores.eQuintupleRotate:
			return "purple";
		case scores.eSingleRotateWithRescue:
		case scores.eDoubleRotateWithRescue:
		case scores.eTripleRotateWithRescue:
			return "yellow";
		case scores.eStayedLow:
			return "white"
		default:
			return "green"
	}
}

/*---------------------------------------------------------------------------*/
let LabelForScoreEvent = function(ev)
{
	switch (ev)
	{
		case scores.eRescuedHostage: 			return "Rescued soldiers";
		case scores.eRescuedHostage2: 			return "Rescued spies";
		case scores.eRescuedHostage3: 			return "Rescued captains";
		case scores.eSingleRotate: 				return "Single rotations";
		case scores.eDoubleRotate: 				return "Double rotations";
		case scores.eTripleRotate: 				return "Triple rotations";
		case scores.eQuadrupleRotate:			return "Quadruple rotations";
		case scores.eQuintupleRotate:			return "Quintuple rotations";
		case scores.eSingleRotateWithRescue: 	return "Single rotations with hostage";
		case scores.eDoubleRotateWithRescue: 	return "Double rotations with hostage";
		case scores.eTripleRotateWithRescue: 	return "Triple rotations with hostage";
		case scores.eStayedLow:					return "Stayed low";
		default: return "";
	}
}

/*---------------------------------------------------------------------------*/
let TextForScoreEvent = function(ev)
{
	switch (ev)
	{
		case scores.eRescuedHostage: 			return "Rescued soldier";
		case scores.eRescuedHostage2: 			return "Rescued spy";
		case scores.eRescuedHostage3: 			return "Rescued captain";
		case scores.eSingleRotate: 				return "Single rotate";
		case scores.eDoubleRotate: 				return "Double rotate";
		case scores.eTripleRotate: 				return "TRIPLE rotate";
		case scores.eQuadrupleRotate: 			return "QUADRUPLE rotate";
		case scores.eQuintupleRotate: 			return "QUINTUPLE rotate";
		case scores.eSingleRotateWithRescue: 	return "Single rotate with rescue";
		case scores.eDoubleRotateWithRescue: 	return "Double rotate with rescue";
		case scores.eTripleRotateWithRescue: 	return "TRIPLE rotate with rescue";
		case scores.eStayedLow:					return "Stayed Low!";
		default: return "";
	}
}

/*---------------------------------------------------------------------------*/
let ScoreForEvent = function(ev)
{
	switch (ev)
	{
		case scores.eRescuedHostage: 			return 2000;
		case scores.eSingleRotate: 				return 500;
		case scores.eDoubleRotate: 				return 1200;
		case scores.eTripleRotate: 				return 2000;
		case scores.eQuadrupleRotate: 			return 5000;
		case scores.eQuintupleRotate: 			return 12000;
		case scores.eSingleRotateWithRescue: 	return 4000;
		case scores.eDoubleRotateWithRescue: 	return 30;
		case scores.eTripleRotateWithRescue: 	return 50;
		case scores.eStayedLow:					return 1000;
		default: return 0;
	}
}

/*---------------------------------------------------------------------------*/
let ScoreEvent = function(ev)
{
	// we use isFixed as an "is game active" check
	// should probably add a new mIsScoringActive let
	if (gShipObject.isFixed)
		return;
	
	const score = ScoreForEvent(ev);
	gScore += score;

	// update the score event counter
	const prev = gScoreEventCounter.get(ev);
	gScoreEventCounter.set(ev, prev ? prev + 1 : 1);
	
	let scoreText = ((score > 0 ? "+" : "") + score);
	
	// if it's the first time then add the !
	if (gScoreEventCounter.get(ev) === 1)
	{
		scoreText = (TextForScoreEvent(ev) + " (" + scoreText + ")");
		scoreText += "!";
	}
	
	const color = TextColorForScoreEvent(ev);
	NewTextBubble(scoreText, gShipObject, color);
}

/*---------------------------------------------------------------------------*/
let ScoreStatsUI = function(list, x, y)
{
	list.forEach((value, key) => 
	{
		const score = ScoreForEvent(key);
		const text = LabelForScoreEvent(key) + " (+" + score + ") : " + value;

		ctx.font = "12px Helvetica";
		ctx.fillStyle = TextColorForScoreEvent(key);
    	ctx.fillText(text, x, y);
		y += 16;
	});

	return y;
}

/*---------------------------------------------------------------------------*/
let ShowScoreStats = function()
{
	const kScoreColor2 = "white";
	const kScoreText2 = "16px Helvetica";
	const x = canvas.width - 80;
	let y = 50;

  	ctx.fillStyle = kScoreColor2;
	ctx.font = kScoreText2;
	ctx.textAlign = "right";
	
	const stage = "Current"; //(mDistanceGameStatus == eWaitingForStart ? "Last" : "Current");
	ctx.fillText("--- " + stage + " score: " + gScore + " ---", x, y);
	y += 16;
	
	y = ScoreStatsUI(gScoreEventCounter, x, y);
	
	/*if (mNewDistanceGameScoreBest > 0 &&
		(!mNewDistanceGameScoreBestAllTime ||
		 mNewDistanceGameScoreBest < mNewDistanceGameScoreBestAllTime))*/
	{
		if (gScoreEventCounterBest.size > 0)
		{
			y += 10;
			ctx.fillStyle = kScoreColor2;
			ctx.font = kScoreText2;
			ctx.fillText("--- Best score: " + gScoreBest + " ---", x, y);
			
			y += 16;
			y = ScoreStatsUI(gScoreEventCounterBest, x, y);
		}
	}
	
	if (gScoreEventCounterBestAllTime.size > 0)
	{
		y += 10;
		ctx.fillStyle = kScoreColor2;
		ctx.font = kScoreText2;
		ctx.fillText("--- Best all-time score: " + gScoreBestAllTime + " ---", x, y);
		
		y += 16;
		ScoreStatsUI(gScoreEventCounterBestAllTime, x, y);
	}
}

/*---------------------------------------------------------------------------*/
// calc a velocity vector from speed & angle
let Velocity = function(speed, angle)
{
	return {x: (speed * Math.sin(angle)), y: (-(speed * Math.cos(angle)))};
}

/*---------------------------------------------------------------------------*/
let ShootBullet = function(x, y, a)
{
	const kBulletSpeed = 400;
	const v = Velocity(kBulletSpeed, a);
	let bullet = new Object(types.BULLET, x, y, v.x, v.y, 0, 0, 0, 4);
	bullet.setLifetime(4000);
}

/*---------------------------------------------------------------------------*/
let ShootBullets = function(x, y)
{
	const kOffset = (M_PI_4 * 0.27);

	ShootBullet(x, y, gShipAngle - kOffset);
	ShootBullet(x, y, gShipAngle);
	ShootBullet(x, y, gShipAngle + kOffset);
}

/*---------------------------------------------------------------------------*/
// do some random explosions
let DoExplosions = function () 
{
	for (let i = 0; i < 12; i++)
		Explosion(RandomWidth(20), RandomHeight(20));
}

/*---------------------------------------------------------------------------*/
let Explosion = function(x, y)
{
	const kNumFrags = rnd(6, 12);
	const kAngleInc = (2 * M_PI / kNumFrags);
	
	for (let j = 0; j < kNumFrags; j++)
	{
		// give each frag a random speed
		const speed = rnd(60, 180);
		
		// send each of the fragments at an angle equally spaced around 
		// the unit circle, with some randomness
		const angleRnd = rnd(-M_PI_8, M_PI_8);
		const v = Velocity(speed, (j * kAngleInc) + angleRnd);
		
		// give each frag a random x/y acceleration
		const accX = rnd(0, kNumFrags); // minimal friction
		const accY = rnd(0, kNumFrags) * 16; // some gravity
		
		let obj = new Object(types.FRAGMENT, x, y, v.x, v.y, accX, accY, 0, 0);
		obj.setLifetime(rnd(2600, 5000));
	}
}

/*---------------------------------------------------------------------------*/
let NewFallingObject = function()
{
	const x = RandomWidth(10, 240); // random horiz start
	const accelY = rnd(40, 160);	// random vertical (falling) acceleration
	const size = rnd(8,20);			// random size for the circle
	let obj = new Object(types.CIRCLE, x, 0, 0, 0, 0, accelY, RandomColor(), size);
	obj.setKilledBy(types.BULLET);
	obj.shadowBlur = rnd(10,40);
	obj.lightGradient = rnd(1,3) > 1 ? true : false;
	obj.gradient = !obj.lightGradient;

	// schedule the next one
	if (gGameState === eStarted)
	{
		const elapsedGameTimeMS = (gNowMS - gGameStartTimeMS);
		const avgNextMS = 400 + 4000 * (1 - ( 1 / elapsedGameTimeMS));
		//const nextObjectMS = rnd(600, 1000);
		setTimeout(function(){ NewFallingObject(); }, avgNextMS);
	}
}

/*---------------------------------------------------------------------------*/
let NewImageObject = function(x, y, velX, velY, accX, accY, src)
{
	let obj = new Object(types.IMAGE, x, y, velX, velY, accX, accY, 0, 0);
	obj.image = new Image();
	obj.image.src = src; 
	obj.width = obj.image.width;
	obj.height = obj.image.height;

	// start out as not ready until the img is loaded
	obj.ready = false;
	obj.image.onload = function () {
		//obj.size = (this.height * this.width);
		obj.ready = true;
	};

	return obj;
}

/*---------------------------------------------------------------------------*/
let NewGravityObject = function(x, y, mass)
{
	let obj = NewImageObject(x, y, 0, 0, 0, 0, 'images/monster.png');
	obj.mass = mass;
}

/*---------------------------------------------------------------------------*/
let Distance = function(o1, o2) 
{
	var dx = o2.x - o1.x;
	var dy = o2.y - o1.y;
	return Math.sqrt((dx * dx) + (dy * dy));
}

/*---------------------------------------------------------------------------*/
let Bound = function(val, min, max) 
{
	if (val < min) return min;
	else if (val > max) return max;
	else return val;
}

// good setting
let s1 = {min: 0, max: 120, g: 7, s: false}

let s2 = {min: 0, max: 100, g: 100, s: true}

/*---------------------------------------------------------------------------*/
// ApplyGravity
// this applies the gravity acceleration vectors in both directions
let ApplyGravity = function(o1, o2)
{
	if (!(o1.mass && o2.mass))
		return;

	// choose the setting
	let s = s2;

	const kMinG = s.min;
	const kMaxG = s.max;
	const kG = s.g;
	const kSquareD = s.s;
	
	// calc gravity
	const d = Distance(o1, o2);
	const denom = kSquareD ? (d * d) : d;
	let g = 100 * (kG * o1.mass * o2.mass) / denom;
	g = Bound(g, kMinG, kMaxG);
	
	// calc angle between objects
	const angleRad = Math.atan2(o2.x - o1.x, o2.y - o1.y);
	
	// create the acceleration vector
	const a = {x: (g * Math.sin(angleRad)), y: (g * Math.cos(angleRad))};
	
	// apply them in opposite directions
	o1.accX += a.x;
	o1.accY += a.y;
	o2.accX -= a.x;
	o2.accY -= a.y;
}

/*---------------------------------------------------------------------------*/
let DoGame = function()
{
	ctx.fillStyle = "white";
	ctx.font = "20px Chalkboard";
	ctx.textAlign = "center";
	ctx.textBaseline = "bottom";

	switch (gGameState)
	{
		case eWaitingForStart:
		{
			ctx.fillText("Waiting For Start", canvas.width/2, 80);
			ctx.fillText("Last Score: " + gScore, canvas.width/2, 108);
			ctx.fillText("Best Score: " + gScoreBest, canvas.width/2, 136);
			if (gScoreBestAllTime)
				ctx.fillText("Best All-time Score: " + gScoreBestAllTime, canvas.width/2, 164);

			if (gThrusting)
				gGameState = eStarting;

			break;
		}

		case eStarting:
		{
			gGameState = eStarted;
			gGameStartTimeMS = gNowMS;
			setTimeout(function(){ NewFallingObject(); }, 800);
			break;
		}

		case eStarted:
		{
			ctx.fillText("Score: " + gScore, canvas.width/2, 100);

			const d = (kDistanceGameScoreCutoff - gShipDistanceFromGround);
			if (d > 0)
			{
				const nextTextBubblePoints = (gPointsByKeepingLowIndex * 1000);
				
				gPointsByKeepingLow += d;
				if (gPointsByKeepingLow > nextTextBubblePoints)
				{
					gPointsByKeepingLowIndex++;
					ScoreEvent(scores.eStayedLow);
				}
			}
			break;
		}

		case eEnded:
		{
			gGameState = eWaitingForStart;

			gPointsByKeepingLowIndex = 1;
			gPointsByKeepingLow = 0;

			if (gScore > gScoreBest)
			{
				gScoreBest = gScore;
				gScoreEventCounterBest = new Map(gScoreEventCounter);
			}

			gScore = 0;
			gScoreEventCounter.clear();
			break;
		}
	}
}

/*---------------------------------------------------------------------------*/
let CheckShipWithinLines = function()
{
	if (gShipObject.isFixed)
		return;

	// reset each frame
	gShipDistanceFromGround = INT_MAX;

	// go through all the ground objects and check the ship for each
	// TODO: create separate array for ground objects?
	for (let i = 0; i < gObjects.length; i++)
	{
		let g = gObjects[i];
		if (g.type !== types.GROUND || !g.isActive())
			continue;

		if (CheckShipWithSingleGroundObject(g))
		{
			Explosion(gShipObject.x, gShipObject.y);
			ResetShip();
			break;
		}
	}
}

/*---------------------------------------------------------------------------*/
let VerticalDistanceToLine = function(rightX, rightY, leftX, leftY, obj)
{
	// since this is only ever called with a ship vertex as the obj,
	// call it ship for clarity
	let ship = obj;

	// only check the segment we're in since we're checking vertical distance
	// TODO: can we optimize this so we don't have to iterate over all ground objects?
	if (ship.x < leftX || ship.x > rightX)
		return INT_MAX;
	
	// avoid divide by zero
	if ((rightX - leftX) === 0)
		return INT_MAX;
	
	// slope
	const m = ((rightY - leftY) / (rightX - leftX));

	// b = y - mx (since y = mx + b)
	const b = (rightY - (m * rightX));
	
	// now that we have the equation of the line (y = mx + b), find the 
	// y value of the point on the line with the x-coord of the ship 
	const lineY = ((m * ship.x) + b);
	
	// now the distance is just the distance between the y coordinates
	const d = (lineY - ship.y);
	return d;
}

/*---------------------------------------------------------------------------*/
let IsUnderLine = function(rightX, rightY, leftX, leftY, obj)
{ 
	const d = VerticalDistanceToLine(rightX, rightY, leftX, leftY, obj);

	// since we only ever call this with the SHIP object, we can set this here
	if (d > 0 && d < INT_MAX)
		gShipDistanceFromGround = Math.min(d, gShipDistanceFromGround);

	return (d < (-kGroundCollisionBuffer));
}

/*---------------------------------------------------------------------------*/
let IsAboveLine = function(rightX, rightY, leftX, leftY, obj)
{
	const d = VerticalDistanceToLine(rightX, rightY, leftX, leftY, obj);
	return (d > kGroundCollisionBuffer && d < INT_MAX);
}

/*---------------------------------------------------------------------------*/
let IsOutsideLine = function(isBottom, rightX, rightY, leftX, leftY, obj)
{
	if (isBottom)
		return IsUnderLine(rightX, rightY, leftX, leftY, obj);
	else
		return IsAboveLine(rightX, rightY, leftX, leftY, obj);
}

/*---------------------------------------------------------------------------*/
// 	METHOD:	CheckShipWithSingleGroundObject
//  see if we've gone below the lower line or above the upper line
//  this checks a single ground object (i.e. a single line segment)
/*---------------------------------------------------------------------------*/
let CheckShipWithSingleGroundObject = function(g)
{	
	// check each pt of the ship
	for (let i = 0; i < gShipObject.vertices.length; i++)
	{
		if (IsOutsideLine(	g.isBottom, 
							g.rightX, g.rightY, 
							g.x, g.y, 
							gShipObject.vertices[i]))
			return true;
	}
		
	return false;
}

/*---------------------------------------------------------------------------*/
let DrawGroundObject = function(obj)
{
	// the position of the line segment is defined as its left endpoint

	// calc the right endpoint of the line segment
	obj.rightX = (obj.x + obj.width); 	
	obj.rightY = (obj.y + obj.height);
	
	ctx.beginPath();
	ctx.strokeStyle = kLineColor;
	ctx.lineWidth = 4;
	ctx.moveTo(obj.x, obj.y);
	ctx.lineTo(obj.rightX, obj.rightY);
	ctx.stroke();
	
	// when this line segment's right side hits the right edge, create the next one
	// TODO: this should be moved outside of this Draw() method
	if (!obj.hasTriggeredNext && (obj.rightX <= canvas.width))
	{
		obj.hasTriggeredNext = true;
		
		// start the next object - the right endpoint of the current object is
		// the left endpoint of the new one
		NewGroundObject(obj.rightX, obj.rightY, obj.isBottom, !obj.increasing);
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.initGround = function(isBottom, increasing) 
{
	this.isBottom = isBottom;
	this.increasing = increasing;
	this.hasTriggeredNext = false;

	// how close are the tight corridors
	const kMinClosenessMax = 32; //100;
	const kMinClosenessMin = 16;
	
	// how far are the widest parts
	const kMaxDiffMax = 400;
	const kMaxDiffMin = 240; //200;
	
	let dec = 0;
	const minCloseness = Math.max((kMinClosenessMax - dec), kMinClosenessMin);
	const maxDiff = Math.max((kMaxDiffMax - (dec * 8)), kMaxDiffMin);
	
	const kUpperLineMin = (kGroundMidpoint + (maxDiff/2));
	const kUpperLineMax = (kGroundMidpoint + (minCloseness/2));
	const kLowerLineMin = (kGroundMidpoint - (minCloseness/2));
	const kLowerLineMax = (kGroundMidpoint - (maxDiff/2));
	
	// each ground object is a new line segment
	// get random values for the width and height of this line segment
	this.width = rnd(30, 120);
	this.height = rnd(10, 100);
	
	// make sure the line segments stay within the above ^^ range
	// FIXME - these are all constants!!
	const minY = isBottom ? (canvas.height - kLowerLineMin) : (canvas.height - kUpperLineMin);
	const maxY = isBottom ? (canvas.height - kLowerLineMax) : (canvas.height - kUpperLineMax);
	
	const boundY = increasing ? (this.y - minY) : (maxY - this.y);
	this.height = Math.min(this.height, boundY);
	
	// negative height if decreasing
	if (increasing)
		this.height *= -1.0;
}

/*---------------------------------------------------------------------------*/
let NewGroundObject = function(x, y, isBottom, increasing)
{
	const velX = (isBottom ? -kGroundSpeedBottom : -kGroundSpeedTop);
	let obj = new Object(types.GROUND, x, y, velX, 0, 0, 0, 0, 0);
	obj.initGround(isBottom, increasing);
	gGroundObjects.push(obj);
}

/*---------------------------------------------------------------------------*/
let DrawTextObject = function(obj)
{
	ctx.fillStyle = obj.color;
	ctx.font = "16px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";
	ctx.fillText(obj.text, obj.x, obj.y);
}

/*---------------------------------------------------------------------------*/
let RotationScore = function (numRotations)
{
	let ev = 0;
	switch (numRotations)
	{
		case 1:  ev = scores.eSingleRotate; 	break;
		case 2:  ev = scores.eDoubleRotate; 	break;
		case 3:  ev = scores.eTripleRotate; 	break;
		case 4:  ev = scores.eQuadrupleRotate; 	break;
		default: ev = scores.eQuintupleRotate;
	}

	ScoreEvent(ev);
}

/*---------------------------------------------------------------------------*/
let CheckRotation = function (isRotating)
{
	if (isRotating)
	{
		if (!gWasRotating)
		{
			// the ship just started rotating - snapshot the start angle
			gAngleStart = gShipAngle;
		}
		else
		{
			// the ship is continuing its rotation - calc the angular change (in radians)
			const angularChange = Math.abs(gAngleStart - gShipAngle);
			
			// calc the threshold for the next rotation
			// it's slightly less (3pi/8) than a full rotation to make it a little easier
			const nextRotationThreshold = (((gNumRotations + 1) * M_2PI) - M_3PI_8);
			
			// see if we have crossed the threshold
			if (angularChange > nextRotationThreshold)
			{
				gNumRotations++;
				gShipBlinkEndMS_RotateMS = (gNowMS + 800);
				RotationScore(gNumRotations);
			}
		}
	}
	else
	{
		gNumRotations = 0;
	}
	
	// what was is what is
	gWasRotating = isRotating;
}

/*---------------------------------------------------------------------------*/
// keyboard input
let gKeysDown = {};
addEventListener("keydown", function (e) { gKeysDown[e.keyCode] = true; }, false);
addEventListener("keyup"  , function (e) { delete gKeysDown[e.keyCode]; }, false);

/*---------------------------------------------------------------------------*/
let GetUserInput = function (delta) 
{
	gThrusting = false;
	if (90 in gKeysDown || 38 in gKeysDown) // 'z' || up arrow
	{ 	
		gThrusting = true;
		gShipObject.isFixed = false;

		// TODO: tune the responsiveness
		let thrustSpeed = kThrustSpeed;

		// apply thrust to velocity
		gShipObject.velY -= (gShipAngleCos * thrustSpeed * delta); // vertical thrust
		gShipObject.velX += (gShipAngleSin * thrustSpeed * delta); // horiz thrust
	}

	// some horiz friction 
	if (!gShipObject.mass)
		gShipObject.accX = (gShipObject.velX > 0) ? -10 : 10;

	if (88 in gKeysDown) 
	{
		if (gNowMS - gLastShootMS > 50)
		{
			gLastShootMS = gNowMS;
			ShootBullets(gShipObject.x, gShipObject.y);
		}
	}

	let rotating = false;
	if (37 in gKeysDown) // left arrow
	{ 	
		gShipAngle -= (kRotateSpeed * delta);
		rotating = true;
	}
	if (39 in gKeysDown) // right arrow
	{ 	
		gShipAngle += (kRotateSpeed * delta);
		rotating = true;
	}

	if (rotating)
		CalcSinCosForShip();

	CheckRotation(rotating);
}

/*---------------------------------------------------------------------------*/
let EitherOfType = function(o1, o2, type) { return (o1.type === type || o2.type === type); }
let BothOfType = function(o1, o2, type) { return (o1.type === type && o2.type === type); }
let ExactlyOneOfType = function(o1, o2, type) { return (o1.type === type ^ o2.type === type); }
let ExactlyOneOfEachType = function(o1, o2, type1, type2) 
{ 	
	return 	(o1.type === type1 && o2.type === type2) ||
			(o1.type === type2 && o2.type === type1); 
}

/*---------------------------------------------------------------------------*/
let ShipCollidedWithFallingObject = function()
{
	//ScoreEvent(scores.eRescuedHostage3);
	ResetShip();
}

/*---------------------------------------------------------------------------*/
let Collided = function(o1, o2)
{
	return 	o1.x <= (o2.x + o2.width) &&
			o2.x <= (o1.x + o1.height) &&
			o1.y <= (o2.y + o2.height) &&
			o2.y <= (o1.y + o1.height);
}

/*---------------------------------------------------------------------------*/
let CheckCollision = function(o1, o2)
{
	if (!(o1.isKilledBy(o2) || o2.isKilledBy(o1)))
		return;

	const collided = Collided(o1, o2);

	if (collided)
	{
		let shipInvolved = false;
		let otherObj = {};
		
		if (o1 === gShipObject)
		{
			shipInvolved = true;
			otherObj = o2;
		}
		else if (o2 === gShipObject)
		{
			shipInvolved = true;
			otherObj = o1;
		}

		if (shipInvolved)
		{
			if (otherObj.type === types.CIRCLE)
			{	
				ShipCollidedWithFallingObject();

				// kill the other obj
				Explosion(otherObj.x, otherObj.y);
				otherObj.alive = false;
			}
		}
		else
		{
			o1.alive = false;
			o2.alive = false;
			Explosion(o1.x, o1.y);
		}
	}

	return collided;
}

/*---------------------------------------------------------------------------*/
// act on each pair of objects exactly once
let HandleObjectPairInteractions = function()
{
	for (let k = 0; k < (gObjects.length - 1); k++)
	{
		if (gSwitch)
			k = (gObjects.length - k - 1);

		let o1 = gObjects[k];
		if (!o1.isActive()) 
			continue;
		
		for (let j = (k + 1); j < gObjects.length; j++)
		{
			if (gSwitch)
				j = (gObjects.length - j - 1);

			let o2 = gObjects[j];
			if (!o2.isActive()) 
				continue;

			ASSERT(o1 !== o2);
			
			CheckCollision(o1, o2);
			ApplyGravity(o1, o2);
		}
	}
	gSwitch = !gSwitch;
}

/*---------------------------------------------------------------------------*/
let DrawText = function () 
{
	// text in lower left
  	ctx.fillStyle = kTextColor;
	ctx.font = "16px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";

	gShipObject.velY

	const d = (gShipDistanceFromGround === INT_MAX ? 0 : gShipDistanceFromGround);
	ctx.fillText("# objects: " + gNumActiveObjects + 
							", " + gObjects.length + 
							", " + d.toFixed(0) +
							", (" + gShipObject.velX.toFixed(0) + "," + 
									gShipObject.velY.toFixed(0) + ")", 
							24, canvas.height - 24);
}

/*---------------------------------------------------------------------------*/
let AnimateAndDraw = function (delta) 
{
	// animate & draw all the objects in the gObjects array

	gNumActiveObjects = 0;
  	for(let i = 0; i < gObjects.length; i++) 
  	{
  		let obj = gObjects[i];
    	if(obj.isActive()) 
    	{
      		obj.applyPhysics(delta);
      		obj.adjustBounds();
      		obj.updateAliveState();
      		obj.draw();
      		gNumActiveObjects++;
    	}
  	}
}

/*---------------------------------------------------------------------------*/
let ClearCanvas = function (delta) 
{
	// fill background (and erase all objects)
	ctx.fillStyle = kBackgroundColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/*---------------------------------------------------------------------------*/
let Exit = function () {};

/*---------------------------------------------------------------------------*/
let Init = function () 
{
	gShipObject = new Object(types.SHIP, 0, 0, 0, 0, 0, 0, kShipColor, 8);
	gShipObject.setKilledBy(types.CIRCLE);
	ResetShip();

	NewImageObject(80,10,0,0,0,0,'images/GP.png');

	const kDoGravity = false;
	if (kDoGravity)
	{
		gShipObject.mass = 100;
		NewGravityObject(RandomWidth(100),RandomHeight(50),30);
		NewGravityObject(RandomWidth(100),RandomHeight(50),60);
		NewGravityObject(RandomWidth(100),RandomHeight(50),90);
	}
	else
	{
		// start the lower & upper ground objects
		NewGroundObject(canvas.width, canvas.height - 20, true/*bottom*/, true);
		NewGroundObject(canvas.width, canvas.height - 400, false/*top*/, true);
	}

	DoExplosions();
}

/*---------------------------------------------------------------------------*/
let DoSomeWork = function (delta) 
{
	ClearCanvas();
	GetUserInput(delta);
	HandleObjectPairInteractions();
	CheckShipWithinLines();
	AnimateAndDraw(delta);
	DoGame();
	DrawText();
	ShowScoreStats();
};

/*---------------------------------------------------------------------------*/
let EventLoop = function () 
{
	const nowMS = Date.now();
	const delta = (nowMS - gNowMS);
	gNowMS = nowMS;

	DoSomeWork(delta / 1000);
	
	// schedule us again immediately - this keeps the framerate high
	requestAnimationFrame(EventLoop);
};

/*---------------------------------------------------------------------------*/
let main = function () 
{
	Init();
	EventLoop();
	Exit();
} (); 


/*---------------------------------------------------------------------------*/
// Cross-browser support for requestAnimationFrame
let w = window;
requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;


