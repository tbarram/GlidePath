

// glide_path namespace
(function glide_path() { 

"use strict";

/*---------------------------------------------------------------------------*/
function ASSERT(cond, str)
{
	if (!cond)
		alert(str || "assert");
}

/*---------------------------------------------------------------------------*/
// Create the canvas
let canvas = document.createElement("canvas");
let ctx = canvas.getContext("2d");

// using the window values causes glitches, so hardcode
canvas.width = 1200; //window.innerWidth;
canvas.height = 680; //window.innerHeight;
document.body.appendChild(canvas);

let vertPos = 40;
let rightPos = 160;
let rightPosValue = 50;
let valueVertOffset = 14;
let sGravitySettings = {};

// get query params
const urlParams = new URLSearchParams(window.location.search);
let gNumGravityObjects = 7; //urlParams.get('num');
const gGravityGameActive = (gNumGravityObjects && gNumGravityObjects > 0);
const kShipGravityV = 180; //140; // 100

/*---------------------------------------------------------------------------*/
let addSlider = function(sliderID, sliderName, setValFunc, bottomMargin)
{
	// slider element
	var s = document.getElementById(sliderID);
	s.style.position = "absolute";
	s.style.right = rightPos + 'px';
	s.style.top = vertPos + 'px';

	// label for the slider
	var s_val = document.getElementById(sliderID + "_value");
	s_val.style.position = "absolute";
	s_val.style.right = rightPosValue + 'px';
	s_val.style.top = (vertPos - valueVertOffset) + 'px';
	s_val.innerHTML = sliderName + ": " + s.value;

	s.oninput = function() {
	  setValFunc(this.value);
	  s_val.innerHTML = sliderName + ": " + this.value;
	}

	vertPos += bottomMargin;
}

/*---------------------------------------------------------------------------*/
// add the sliders
addSlider("gravity", "Gravity", 	(v) => { sGravitySettings.g = v }, 		20);
addSlider("maxG", "MaxG", 			(v) => { sGravitySettings.maxG = v }, 	20);
addSlider("minG", "MinG", 			(v) => { sGravitySettings.minG = v }, 	20);
addSlider("maxV", "MaxV", 			(v) => { sGravitySettings.maxV = v }, 	20);
addSlider("numObjects", "Objects", 	(v) => { gNumGravityObjects = v }, 		30);

/*---------------------------------------------------------------------------*/
// add the button
var button = document.getElementById("button");
button.style.position = "absolute";
button.style.right = rightPosValue + 'px';
button.style.top = vertPos + 'px';
button.onclick = function() {
	gResetGravityObjects = true;
}

/*---------------------------------------------------------------------------*/
// utilities
let rnd = function(min,max) { return (min + Math.floor(Math.random() * (max - min))); }
let RandomWidth = function (padL,padR) { return rnd(padL, canvas.width - (padR || padL)); }
let RandomHeight = function (padT,padB) { return rnd(padT, canvas.height - (padB || padT)); }
let RGB = function(r,g,b) { return 'rgb(' + r + ',' + g + ',' + b +')'; }
let RandomColor = function() { return RGB(rnd(0,255), rnd(0,255), rnd(0,255)); }

/*---------------------------------------------------------------------------*/
const kMaxNumObjects = 512;
const kRotateSpeed = 8;
const kThrustSpeed = 647;
const kGroundMidpoint = 300;
const kDistanceGameScoreCutoff = 48;
const kGroundCollisionBuffer = 1;
const kGroundSpeedBottom = 160;
const kGroundSpeedTop = 190;
const kBottom = true;
const kTop = false;

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
const eInactive = 'eInactive';

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
let gRandomIntsArray = [];
let gGroundObjects = [];
let gShipObject = {};
let gShipDistanceFromGround = 0;
let gShipAngle = 0;
let gShipAngleCos = 0;
let gShipAngleSin = 0;
let gThrusting = false;
let gAngleStart = 0;
let gTotalRotateTimeMS = 0;
let gShipBlinkEndMS_RotateMS = 0;
let gLastShipResetMS = 0;
let gWasRotating = false;
let gNumRotations = 0;
let gNextBlinkMS = 0;
let gBlink = false;
let gNumActiveObjects = 0;
let gLastShootMS = 0;
let gGameStartTimeMS = 0;
let gGameState = eInactive;
let gScore = 0;
let gScoreBestAllTime = 0;
let gScoreEventCounter = new Map();
let gScoreEventCounterBest = new Map();
let gScoreEventCounterBestAllTime = new Map();
let gPointsByKeepingLowIndex = 1;
let gPointsByKeepingLow = 0;
let gSwitch = false;
let gResetGravityObjects = false;

let gScoreBest = localStorage.getItem('highScore') | 0;

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
    TEXT_BUBBLE: 	1 << 8,
    MINIMAP: 		1 << 9
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
class Object 
{
    constructor(type, x, y, velX, velY, accX, accY, color, size) 
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
		this.isGravityObject = false;

		AddObject(this);
	}

	// utility methods
	isActive() { return (this.ready && this.alive); }
	setLifetime(ms) { this.expireTimeMS = (gNowMS + ms); }
	setKilledBy(types) { this.killedByBitmask |= types; }
	collidesWith(obj) { return this.killedByBitmask & obj.type; }
	hasGravity() { return this.mass; }
	isGravityObject() { return this.isGravityObject; }

	/*---------------------------------------------------------------------------*/
	draw() 
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
			case types.MINIMAP:
				DrawCircle(TranslateForMinimap(this.parent), 1, "yellow");
				break;
		}
	}

	/*---------------------------------------------------------------------------*/
	updateAliveState() 
	{
		if (gResetGravityObjects )
		{
			if (this.isGravityObject || (this.parent && this.parent.isGravityObject))
			{
				this.alive = false;
				return
			}
		}

				// gravity objects never die - maybe they should?
		if (this.isGravityObject)
			return;

		// check expireTimeMS
		const expired = (this.expireTimeMS && 
						 this.expireTimeMS < gNowMS);
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
	applyPhysics(delta) 
	{
		if (!this.isFixed)
		{	
			// apply acceleration to velocity
			this.velX += (this.accX * delta);
			this.velY += (this.accY * delta);

			if (sGravitySettings.maxV > 0)
			{
				if (sGravitySettings.maxV < 400)
					sGravitySettings.maxV = 400;

				this.velX = Bound(this.velX, sGravitySettings.maxV);
				this.velY = Bound(this.velY, sGravitySettings.maxV);
			}

			// apply velocity to position
			this.x += (this.velX * delta);
			this.y += (this.velY * delta);
		}

		// if this object has gravity, reset its acceleration -
		// it will get accumulated in ApplyGravity by the other objects
		if (this.hasGravity())
			this.accX = this.accY = 0;
	}

	/*---------------------------------------------------------------------------*/
	adjustBounds() 
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
		// (it also avoids the JS garbage collection)
		let foundOpenSlot = false;
		for (let i = 0; i < gObjects.length; i++) 
		{
			if (!gObjects[i].alive)
			{
				// found a free slot
				gObjects[i] = obj;
				foundOpenSlot = true;
				break;
			}
		}

		// if we hit this assert it means we've exceeded kMaxNumObjects
		// (it's OK to increase kMaxNumObjects but it will impact performance)
		ASSERT(foundOpenSlot, "Exceeded kMaxNumObjects");
	}
}

/*---------------------------------------------------------------------------*/
function CalcSinCosForShip()
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
	p.x = (c.x + h);
	p.y = (c.y + v);

	return p;
}

/*---------------------------------------------------------------------------*/
let DrawPolygon = function (vs, color) 
{
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.shadowBlur = DoShipShadow() ? 20 : 0; 
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
let DoShipShadow = function()
{
	return (gShipDistanceFromGround < kDistanceGameScoreCutoff) || gThrusting;
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
	gShipObject.isFixed = true;

	gShipAngle = 0;
	CalcSinCosForShip();

	gShipObject.x = (canvas.width / 2);
	if (gGravityGameActive)
		gShipObject.y = (canvas.height / 2);
	else
		gShipObject.y = 400; // kGroundMidpoint;

	gShipObject.velX = 0;
	gShipObject.velY = 0;
	gShipObject.accX = 0;
	gShipObject.accY = kShipGravityV;
	
	gShipBlinkEndMS_RotateMS = (gNowMS + 800);
	gTotalRotateTimeMS = 0;
	gLastShipResetMS = gNowMS;

	//gGameState = eEnded;
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
let NewTextBubble = function(text, pos, color, first)
{
	const x = pos.x - 150;
	const y = pos.y - 150;
	const p = {x: pos.x + (gSwitch ? 80 : -80), y: pos.y - 80};
	const v = {x: rnd(-30,30), y: rnd(-50,-20)};
	const a = {x:0,y:0}; //{x: rnd(-30,30), y: rnd(-30,-10)};
	let obj = new Object(types.TEXT_BUBBLE, p.x, p.y, v.x, v.y, a.x, a.y, color, 0);
	obj.text = text;
	obj.setLifetime(first ? 3000 : 1000);
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
	
	// if it's the first time add extra text
	const firstTime = !!(gScoreEventCounter.get(ev) === 1);
	if (firstTime)
	{
		scoreText = (TextForScoreEvent(ev) + " (" + scoreText + ")");
		scoreText += "!";
	}
	
	const color = TextColorForScoreEvent(ev);
	NewTextBubble(scoreText, gShipObject, color, firstTime);
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
	if (GravityEnabled())
		return;

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
		
		// send each of the fragments at an angle equally spaced  
		// around the unit circle, with some randomness
		const angleRand = rnd(-M_PI_8, M_PI_8);
		const v = Velocity(speed, (j * kAngleInc) + angleRand);
		
		// give each frag a random x/y acceleration
		const accX = rnd(0, kNumFrags); // minimal friction
		const accY = rnd(0, kNumFrags) * 16; // some gravity
		
		let obj = new Object(types.FRAGMENT, x, y, v.x, v.y, accX, accY, 0, 0);
		obj.setLifetime(rnd(2600, 6000));
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
	obj.shadowBlur = rnd(6,16);
	obj.lightGradient = rnd(1,3) > 1 ? true : false;
	obj.gradient = !obj.lightGradient;

	// schedule the next one
	if (gGameState === eStarted)
	{
		const elapsedGameTimeMS = (gNowMS - gGameStartTimeMS);
		const avgNextMS = 400 + 4000 * (1 - ( 1 / elapsedGameTimeMS));
		//const nextObjectMS = rnd(600, 1000);
		setTimeout(function(){ NewFallingObject(); }, 3500);
	}
}

/*---------------------------------------------------------------------------*/
let NewImageObject = function(x, y, velX, velY, accX, accY, src, minimap)
{
	let obj = new Object(types.IMAGE, x, y, velX, velY, accX, accY, 0, 0);
	obj.image = new Image();
	obj.image.src = src; 
	obj.width = obj.image.width;
	obj.height = obj.image.height;

	// start out as not ready until the img is loaded
	obj.ready = false;
	obj.image.onload = function () { obj.ready = true; };

	// could move this into Object constructor
	//if (minimap)
	{
		let minimapObj = new Object(types.MINIMAP);
		minimapObj.parent = obj;
	}

	return obj;
}

/*---------------------------------------------------------------------------*/
let NewGravityObject = function(x, y, mass)
{
	let obj = NewImageObject(x, y, 0, 0, 0, 0, 'images/icons8-bang-16.png',true/*minmimap*/);
	obj.mass = mass;
	obj.isGravityObject = true;
}

/*---------------------------------------------------------------------------*/
let Distance = function(o1, o2) 
{
	const dx = (o2.x - o1.x);
	const dy = (o2.y - o1.y);
	return Math.sqrt((dx * dx) + (dy * dy));
}

/*---------------------------------------------------------------------------*/
let Bound = function(val, min, max) 
{
	if (!min || min === 0)
		return val;

	if (!max)
	{
		ASSERT(min > 0);
		max = min;
		min = -max;
	}

	return (val < min) ? min : (val > max) ? max : val;
}

// gravity settings:
const s2 =  {min: 0,  max: 160,  g: 1000, shipG: 0};
const s3 =  {min: 0,  max: 100,  g: 400,  shipG: 300};
const s5 =  {min: 20, max: 60, 	 g: 600,  shipG: 300};
const s8 =  {min: 20, max: 20, 	 g: 70,   shipG: 300};
const s9 =  {min: 0,  max: 70, 	 g: 200,  shipG: 100};
const s10 = {min: 0,  max: 40, 	 g: 600,  shipG: 1000};
const s11 = {min: 0,  max: 40,	 g: 600,  shipG: 60};
const s12 = {min: 0,  max: 100,	 g: 600,  shipG: 60};
const s13 = {min: 0,  max: 100,	 g: 1000, shipG: 30};
const s14 = {min: 0,  max: 1500, g: 200,  shipG: 100, rnd: 1};
const s15 = {min: 20, max: 1000, g: 500,  shipG: 100};
const s16 = {min: 20,  max: 1500, g: 200,  shipG: 100};
const s17 = {min: 20,  max: 1500, g: 100,  shipG: 100};
const s18 = {min: 20, max: 1000, g: 500,  shipG: 0};
const s19 = {min: 20, max: 1000, g: 500,  shipG: 60, maxV: 500}; // good one with 11 objects 
const s191 = {min: 20, max: 1000, g: 500,  shipG: 30, maxV: 450}; 
const s20 = {min: 20, max: 1000, g: 100,  shipG: 60, rnd: 1};
const s21 = {min: 4, max: 200, g: 80,  shipG: 60};
const s141 = {min: 20,  max: 1500, g: 200,  shipG: 300, rnd: 1};
const s141_copy_its_a_good_one_w_17_objects = {min: 20,  max: 1500, g: 200,  shipG: 300, rnd: 1};
const s22 = {min: 20, max: 1000, g: 500,  shipG: 0, maxV: 450}; 

sGravitySettings = s141_copy_its_a_good_one_w_17_objects; 

/*---------------------------------------------------------------------------*/
// ApplyGravity
// applies the gravity acceleration vector in both directions
// each object interacts with every other object exactly once in each frame
let ApplyGravity = function(o1, o2)
{
	if (!(sGravitySettings && o1.hasGravity() && o2.hasGravity()))
		return;

	const kMinG = 	sGravitySettings.min;
	const kMaxG = 	sGravitySettings.max;
	const kG = 		sGravitySettings.g;
	
	// distance between the 2 objects
	const d = Distance(o1, o2);

	// gravity
	// g = (G * m1 * m2) / (d ^ 2)
	let g = (kG * o1.mass * o2.mass) / (d * d);

	// bound it (these bounds have a huge affect on the systen)
	g = Bound(g, kMinG, kMaxG);
	
	// get angle between the objects
	const dx = (o2.x - o1.x);
	const dy = (o2.y - o1.y);
	const angle = Math.atan2(dx, dy);

	// create the acceleration vector
	const a = {	x: (g * Math.sin(angle)), 
				y: (g * Math.cos(angle)) };
	
	// apply it on each object in opposite directions

	// object 1
	o1.accX += a.x;
	o1.accY += a.y;

	// object 2 
	o2.accX -= a.x;
	o2.accY -= a.y;
}

/*---------------------------------------------------------------------------*/
const kMinimapHeight = 40;
const kMinimapOuterRatio = 4;
const kMiniMapTopLeftCorner = {mX: 130, mY: 80};

/*---------------------------------------------------------------------------*/
const kMinimapWidth = canvas.width * kMinimapHeight / canvas.height;
const kMinimapOuterHeight = kMinimapOuterRatio * kMinimapHeight;
const kMinimapOuterWidth = kMinimapOuterRatio * kMinimapWidth;
const kMiniMapCenter = {mX: kMiniMapTopLeftCorner.mX + (kMinimapWidth/2),
						mY: kMiniMapTopLeftCorner.mY + (kMinimapHeight/2)};
const kMiniMapOuterTopLeftCorner = {mX: kMiniMapCenter.mX - (kMinimapOuterWidth/2),
									mY: kMiniMapCenter.mY - (kMinimapOuterHeight/2)};

/*---------------------------------------------------------------------------*/
let DrawMiniMap = function () 
{
	if (GravityEnabled())
	{
		ctx.strokeStyle = kLineColor;

		// inner rect
		ctx.beginPath();
		ctx.rect(kMiniMapTopLeftCorner.mX, kMiniMapTopLeftCorner.mY, kMinimapWidth, kMinimapHeight);
		ctx.stroke();

		// outer rect
		ctx.beginPath();
		ctx.rect(kMiniMapOuterTopLeftCorner.mX, kMiniMapOuterTopLeftCorner.mY, kMinimapOuterWidth, kMinimapOuterHeight);
		ctx.stroke();
	}
}

/*---------------------------------------------------------------------------*/
let Interpolate = function(a1, a2, a, b1, b2)
{
	return b1 + (((a - a1) * (b2 - b1)) / (a2 - a1));
}

/*---------------------------------------------------------------------------*/
let TranslateForMinimap = function(p)
{
	const x = Interpolate(0, canvas.width, p.x, kMiniMapTopLeftCorner.mX, kMiniMapTopLeftCorner.mX + kMinimapWidth);
	const y = Interpolate(canvas.height, 0, p.y, kMiniMapTopLeftCorner.mY + kMinimapHeight, kMiniMapTopLeftCorner.mY);
	return {x:x, y:y};
}

/*---------------------------------------------------------------------------*/
let DoGame = function()
{
	if (gGravityGameActive)
		return;

	ctx.fillStyle = "white";
	ctx.font = "20px Chalkboard";
	ctx.textAlign = "center";
	ctx.textBaseline = "bottom";

	switch (gGameState)
	{
		case eInactive:
			return;

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
			gTotalRotateTimeMS = 0;
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
				localStorage.setItem('highScore', gScoreBest);
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
	const y = ((m * ship.x) + b);
	
	// now the distance is just the distance between the y coordinates
	const d = (y - ship.y);
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
let InitGround = function(obj, isBottom, increasing) 
{
	obj.isBottom = isBottom;
	obj.increasing = increasing;
	obj.hasTriggeredNext = false;

	// how close are the tight corridors
	const kMinClosenessMax = 64; //32; //100;
	const kMinClosenessMin = 32; //16;
	
	// how far are the widest parts
	const kMaxDiffMax = 400;
	const kMaxDiffMin = 30; //240; //200;
	
	// fix this - we're applying max to constants
	const minCloseness = Math.max(kMinClosenessMax, kMinClosenessMin);
	const maxDiff = Math.max(kMaxDiffMax, kMaxDiffMin);
	
	const kUpperLineMin = (kGroundMidpoint + (maxDiff/2));
	const kUpperLineMax = (kGroundMidpoint + (minCloseness/2));
	const kLowerLineMin = (kGroundMidpoint - (minCloseness/2));
	const kLowerLineMax = (kGroundMidpoint - (maxDiff/2));
	
	// each ground object is a new line segment
	// get random values for the width and height of this line segment
	obj.width = rnd(30, 120);
	obj.height = rnd(10, 100);
	
	// make sure the line segments stay within the above ^^ range
	const minY = isBottom ? (canvas.height - kLowerLineMin) : (canvas.height - kUpperLineMin);
	const maxY = isBottom ? (canvas.height - kLowerLineMax) : (canvas.height - kUpperLineMax);
	
	const boundY = increasing ? (obj.y - minY) : (maxY - obj.y);
	obj.height = Math.min(obj.height, boundY);
	
	if (increasing)
		obj.height *= -1.0;
}

/*---------------------------------------------------------------------------*/
let NewGroundObject = function(x, y, isBottom, increasing)
{
	const velX = (isBottom ? -kGroundSpeedBottom : -kGroundSpeedTop);
	let obj = new Object(types.GROUND, x, y, velX, 0, 0, 0, 0, 0);
	InitGround(obj, isBottom, increasing);
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
	
	// then is now
	gWasRotating = isRotating;
}

/*---------------------------------------------------------------------------*/
// keyboard input
let gKeysDown = {};
addEventListener("keydown", function (e) { gKeysDown[e.keyCode] = true; }, false);
addEventListener("keyup"  , function (e) { delete gKeysDown[e.keyCode]; }, false);

const key_Z = 90;
const key_X = 88;
const key_UpArrow = 38;
const key_LeftArrow = 37;
const key_RightArrow = 39;
let KeyDown = function(key) { return key in gKeysDown; }

/*---------------------------------------------------------------------------*/
let GetUserInput = function (deltaMS) 
{
	const delta = (deltaMS / 1000);
	gThrusting = false;

	// see if we're thrusting - 'z' || up arrow
	if (KeyDown(key_Z) || KeyDown(key_UpArrow)) 
	{ 	
		gThrusting = true;
		gShipObject.isFixed = false;

		// apply thrust to velocity
		gShipObject.velY -= (gShipAngleCos * kThrustSpeed * delta);
		gShipObject.velX += (gShipAngleSin * kThrustSpeed * delta);
	}

	// some horiz friction 
	if (!gShipObject.hasGravity())
		gShipObject.accX = (gShipObject.velX > 0) ? -10 : 10;

	// check shoot key
	if (KeyDown(key_X)) 
	{
		if (gNowMS - gLastShootMS > 50)
		{
			gLastShootMS = gNowMS;
			ShootBullets(gShipObject.x, gShipObject.y);
		}
	}

	// check arrow keys for rotation
	const rotateDir = KeyDown(key_LeftArrow) ? -1 : KeyDown(key_RightArrow) ? 1 : 0;
	const isRotating = (rotateDir !== 0);

	gShipAngle += (kRotateSpeed * delta * rotateDir);

	if (isRotating)
		CalcSinCosForShip();

	CheckRotation(isRotating);
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
	if (!(o1.collidesWith(o2) || o2.collidesWith(o1)))
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
let swap = function(a,b)
{
	const tmp = a;
    a = b;
    b = tmp;
}

/*---------------------------------------------------------------------------*/
let shuffleArray = function(a) 
{
	// wow - this is very expensive - calls rnd a lot, every frame
    for (let i = (a.length - 1); i > 0; i--) 
    {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i];
    	a[i] = a[j];
    	a[j] = tmp;
    }
    return a;
}

/*---------------------------------------------------------------------------*/
let DoObjectPairInteraction = function(o1, o2)
{
	CheckCollision(o1, o2);
	ApplyGravity(o1, o2);
}

/*---------------------------------------------------------------------------*/
// act on each pair of objects exactly once 
let DoObjectPairInteractions = function()
{
	const len = gObjects.length;

	if (len <= kMaxNumObjects)
		for (var i = 0; i < len; ++i) 
			gRandomIntsArray[i] = i;

	gRandomIntsArray = shuffleArray(gRandomIntsArray);

	for (let k1 = 0; k1 < (len - 1); k1++)
	{	
		for (let k2 = (k1 + 1); k2 < len; k2++)
		{
			ASSERT(k1 !== k2);

			const i1 = gRandomIntsArray[k1];
			const i2 = gRandomIntsArray[k2];
			ASSERT(i1 !== i2);

			let o1 = gObjects[i1];
			let o2 = gObjects[i2];
			ASSERT(o1 !== o2);

			if (!o1.isActive() || !o2.isActive()) 
				continue;
			
			DoObjectPairInteraction(o1, o2);
		}
	}
}

/*---------------------------------------------------------------------------*/
let DrawText = function () 
{
	// text in lower left
  	ctx.fillStyle = kTextColor;
	ctx.font = "16px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";

	const diffMS = gGameStartTimeMS > 0 ? (gNowMS - gGameStartTimeMS) : 0;
	const percentageRotate = gTotalRotateTimeMS * 100 / diffMS;

	const d = (gShipDistanceFromGround === INT_MAX ? 0 : gShipDistanceFromGround);
	ctx.fillText("# objects: " + gNumActiveObjects + 
							", " + gObjects.length + 
							", " + d.toFixed(0) +
							//", (" + gShipObject.velX.toFixed(0) + "," + 
							//		gShipObject.velY.toFixed(0) + ")", 
							(gTotalRotateTimeMS > 0 ?
								(", rotate: " + gTotalRotateTimeMS.toFixed(0) +
								", diff: " + diffMS.toFixed() +
								", percentageRotate: " + percentageRotate.toFixed(0)) : ""),
							24, canvas.height - 24);
}

/*---------------------------------------------------------------------------*/
let AnimateAndDrawObjects = function (deltaMS) 
{
	const deltaS = (deltaMS / 1000);
	gNumActiveObjects = 0;

	// animate & draw all the active objects in the gObjects array
  	for (let i = 0; i < gObjects.length; i++) 
  	{
  		let obj = gObjects[i];
    	if (!obj.isActive()) 
    		continue;

    	// do the per-frame work
  		obj.applyPhysics(deltaS);
  		obj.adjustBounds();
  		obj.updateAliveState();
  		obj.draw();
  		gNumActiveObjects++;
  	}

  	if (gResetGravityObjects)
  	{
  		gResetGravityObjects = false;
  		CreateGravityObjects();
		ResetShip();
  	}
}

/*---------------------------------------------------------------------------*/
let ClearCanvas = function () 
{
	// fill background (and erase all objects)
	ctx.fillStyle = kBackgroundColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/*---------------------------------------------------------------------------*/
let CalcRotationTime = function(deltaMS)
{
	if (gWasRotating && gNumRotations > 0)
		gTotalRotateTimeMS += deltaMS;
}

/*---------------------------------------------------------------------------*/
let GravityEnabled = function()
{
	return (sGravitySettings && gNumGravityObjects);
}

/*---------------------------------------------------------------------------*/
let CreateGravityObjects = function()
{
	for (let i = 0; i < gNumGravityObjects; i++)
		NewGravityObject(RandomWidth(100), RandomHeight(50), sGravitySettings.rnd ? rnd(20,60) : 30);
}

/*---------------------------------------------------------------------------*/
let Exit = function () {};

/*---------------------------------------------------------------------------*/
let Init = function () 
{
	// create the ship
	gShipObject = new Object(types.SHIP, 0, 0, 0, 0, 0, 0, kShipColor, 8);
	gShipObject.setKilledBy(types.CIRCLE);
	ResetShip();

	// logo pic
	let logoPos = {x: 80, y: 10};
	if (GravityEnabled())
		logoPos = {x: canvas.width - 280, y: canvas.height - 300};

	NewImageObject(logoPos.x,logoPos.y,0,0,0,0,'images/GP.png');			

	if (GravityEnabled())
	{
		if (sGravitySettings.shipG)
			gShipObject.mass = sGravitySettings.shipG;

		CreateGravityObjects();
	}
	else
	{
		// start the lower & upper ground objects
		NewGroundObject(canvas.width, canvas.height - 20, kBottom, true);
		NewGroundObject(canvas.width, canvas.height - 400, kTop, true);
	}
}

/*---------------------------------------------------------------------------*/
let DoOneFrame = function () 
{
	// get the diff from last wakeup
	const nowMS = Date.now();
	const deltaMS = (nowMS - gNowMS);
	gNowMS = nowMS;

	// do the work
	ClearCanvas();
	DrawMiniMap();
	CalcRotationTime(deltaMS);
	GetUserInput(deltaMS);
	DoObjectPairInteractions();
	CheckShipWithinLines();
	AnimateAndDrawObjects(deltaMS);
	DoGame();
	DrawText();
	ShowScoreStats();

	gSwitch = !gSwitch;
};

/*---------------------------------------------------------------------------*/
let EventLoop = function () 
{
	// do one frame of work, then schedule us again immediately - 
	// this keeps the framerate high and keeps our updates  
	// in sync with the browser's drawing code

	DoOneFrame();
	requestAnimationFrame(EventLoop);
};

/*---------------------------------------------------------------------------*/
let main = function () 
{
	Init();
	EventLoop();
	Exit();
} (); 

})(); // glide_path namespace


/*---------------------------------------------------------------------------*/
// Cross-browser support for requestAnimationFrame
let w = window;
requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;


