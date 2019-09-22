

/*---------------------------------------------------------------------------*/
// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512; //1200; //512;
canvas.height = 600; //680;
document.body.appendChild(canvas);

/*---------------------------------------------------------------------------*/
function ASSERT(cond, str)
{
	if (!cond)
	{
		if (str)
			alert(str);
	}
}

/*---------------------------------------------------------------------------*/
function rnd(min, max) 
{
  	const r = (min + Math.floor(Math.random() * (max - min)));
  	return r;
}

/*---------------------------------------------------------------------------*/
const kMaxNumObjects = 256;
const kRotateSpeed = 7;
const kThrustSpeed = 500;

const backgroundColor = "rgb(54, 61, 69)";
const textColor = "rgb(250, 250, 250)";
const shipColor = "rgb(20, 119, 155)";
const lineColor = "rgb(124, 209, 12)";

/*---------------------------------------------------------------------------*/
var gNowMS = Date.now();
var gObjects = [];
var gGroundObjects = [];
let gShipObject = {};
let gShipDistanceFromGround = 0;
let gShipAngle = 0;
let gShipAngleCos = Math.cos(gShipAngle);
let gShipAngleSin = Math.sin(gShipAngle);
let gThrusting = false;
let gAngleStart = 0;
let gShipBlinkEndMS_RotateMS = 0;
let gWasRotating = false;
let gNumRotations = 0;
let gNextBlinkMS = 0;
let gBlink = false;
let gNumActiveObjects = 0;
let gLastShootMS = 0;

/*---------------------------------------------------------------------------*/
const M_PI = Math.PI;
const M_2PI = (2 * M_PI);
const M_PI_4 = (M_PI / 4);
const M_PI_8 = (M_PI / 8);
const M_3PI_8 = (3 * M_PI / 8);
const INT_MAX = 1000000;

/*---------------------------------------------------------------------------*/
const types = 
{
    SHIP: 'ship',
    GROUND: 'ground',
    IMAGE: 'image',
    ICON: 'icon',
    CIRCLE: 'circle',
    VECTOR: 'vector',
    BULLET: 'bullet',
    FRAGMENT: 'fragment'
}

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
	this.ready = true;
	this.alive = true;

	// add this object to the gObjects array
	if (gObjects.length < kMaxNumObjects)
	{
		gObjects.push(this);
	}
	else
	{
		// once gObjects has filled up, look for unused spots - this
		// keeps the gObjects array from growing indefinitely
		let success = false;
		for(var i = 0; i < gObjects.length; i++) 
		{
			if (!gObjects[i].alive)
			{
				// found a dead object - use it
				gObjects[i] = this;
				success = true;
				break;
			}
		}

		// if you hit this assert it means you've exceeded kMaxNumObjects
		ASSERT(success, "Exceeded kMaxNumObjects");
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.isActive = function() 
{
	return (this.ready && this.alive);
}

/*---------------------------------------------------------------------------*/
function Point(x, y)
{
	this.x = x;
	this.y = y;
}

/*---------------------------------------------------------------------------*/
// rotate point p around center point c
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
var DrawPolygon = function (verts, color) 
{
	ctx.beginPath();
	ctx.fillStyle = color;

	ctx.moveTo(verts[0].x, verts[0].y);
	for(var i = 1; i < verts.length; i++)
		ctx.lineTo(verts[i].x, verts[i].y);

	ctx.closePath();
	ctx.fill();
}

/*---------------------------------------------------------------------------*/
var RotateAndDraw = function (verts, pos, color) 
{
	// rotate the vertices and store in rv
	var rv = []; 
	for (var i = 0; i < verts.length; i++)
	{
		var pt = Rotate(verts[i], pos, gShipAngleSin, gShipAngleCos);
		rv.push(pt);
	}

	DrawPolygon(rv, color);
	return rv;
}

/*---------------------------------------------------------------------------*/
var ColorForShip = function () 
{
	let color = gShipObject.color;
	const kBlinkSpeedMS = 100;

	// handle blinking
	if (gShipBlinkEndMS_RotateMS > gNowMS)
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
var DrawShip = function (obj) 
{
	const kBaseWidth = 16;
	const kHeight = 8;
	const kHalfBaseWidth = (kBaseWidth / 2);
	const kHalfHeight = kHeight / 2;
	const kCenterIndent = 4;
	const kThrustWidth = ((kBaseWidth / 4) - 1);
	const kThrustHeight = 8;

	var ship = [];
	ship.push(new Point(obj.x - kHalfBaseWidth, obj.y + kHalfHeight)); // bottomL
	ship.push(new Point(obj.x, obj.y + kHalfHeight - kCenterIndent)); // bottomC
	ship.push(new Point(obj.x + kHalfBaseWidth, obj.y + kHalfHeight)); // bottomR
	ship.push(new Point(obj.x, obj.y - kHalfHeight));	// top

	gShipObject.vertices = RotateAndDraw(ship, obj, ColorForShip());

	if (gThrusting)
	{
		// draw thrust triangle
		var thrust = [];
		thrust.push(new Point(obj.x - kThrustWidth, obj.y + kHalfHeight)); // bottomL
		thrust.push(new Point(obj.x, obj.y + kHalfHeight + kThrustHeight)); // bottomC
		thrust.push(new Point(obj.x + kThrustWidth, obj.y + kHalfHeight)); // bottomR

		RotateAndDraw(thrust, obj, "red");
	}
}

/*---------------------------------------------------------------------------*/
var DrawCircle = function (x, y, r, color) 
{
	ASSERT(r > 0);
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.arc(x, y, r, 0, M_2PI);
	ctx.fill();
}

/*---------------------------------------------------------------------------*/
Object.prototype.draw = function() 
{
	if (this.type === types.IMAGE)
	{
		ASSERT(this.image);
		ctx.drawImage(this.image, this.x, this.y);
	}
	else if (this.type === types.CIRCLE)
	{
		DrawCircle(this.x, this.y, this.size, this.color);
  	}
  	else if (this.type === types.BULLET)
	{
		DrawCircle(this.x, this.y, 2, "red");
  	}
  	else if (this.type === types.FRAGMENT)
	{
		DrawCircle(this.x, this.y, 2, "white");
  	}
  	else if (this.type === types.SHIP)
  	{
  		DrawShip(this);
  	}
  	else if (this.type === types.GROUND)
  	{
  		DrawGroundObject(this);
  	}
};

/*---------------------------------------------------------------------------*/
Object.prototype.updateAliveState = function() 
{
	const expired = (this.expireTimeMS && this.expireTimeMS < gNowMS);
	if (expired)
		this.alive = false;

	if (this.type === types.GROUND)
	{
		if ((this.x + this.width) < 0)
			this.alive = false;

		return;
	}

	if (this.type !== types.SHIP)
	{
		if (this.x < 0 || this.x > canvas.width)
			this.alive = false;

		if (this.y > canvas.height)
			this.alive = false;
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.animate = function(delta) 
{
	// apply acceleration to velocity
	this.velX += (this.accX * delta);
	this.velY += (this.accY * delta);

	// apply velocity to position
	this.x += (this.velX * delta);
	this.y += (this.velY * delta);
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

		// some horiz friction 
		this.accX = (this.velX > 0) ? -10 : 10;
	}
}

/*---------------------------------------------------------------------------*/
var Velocity = function(speed, angle)
{
	return new Point(speed * Math.sin(angle), -(speed * Math.cos(angle)));
}

/*---------------------------------------------------------------------------*/
var ShootBullet = function(x, y)
{
	const kBulletSpeed = 400;
	const kOffset = (M_PI_4 * 0.27);

	var v = Velocity(kBulletSpeed, gShipAngle);
	var bullet = new Object(types.BULLET, x, y, v.x, v.y, 0, 0, 0, 0);
	bullet.expireTimeMS = gNowMS + 4000;

	v = Velocity(kBulletSpeed, gShipAngle + kOffset);
	bullet = new Object(types.BULLET, x, y, v.x, v.y, 0, 0, 0, 0);
	bullet.expireTimeMS = gNowMS + 4000;

	v = Velocity(kBulletSpeed, gShipAngle - kOffset);
	bullet = new Object(types.BULLET, x, y, v.x, v.y, 0, 0, 0, 0);
	bullet.expireTimeMS = gNowMS + 4000;
}

/*---------------------------------------------------------------------------*/
var Explosion = function(x, y)
{
	const kNumFrags = rnd(6, 12);
	const kAngleInc = (2 * M_PI / kNumFrags);
	
	for (var j = 0; j < kNumFrags; j++)
	{
		// give each frag a random speed
		const speed = rnd(60, 180);
		
		// send each of the fragments at an angle equally spaced around the unit
		// circle, with some randomness
		const angleRnd = rnd(-M_PI_8, M_PI_8);
		const v = Velocity(speed, (j * kAngleInc) + angleRnd);
		
		// give each frag a random x/y acceleration
		const accX = rnd(0, kNumFrags); // minimal friction
		const accY = rnd(0, kNumFrags) * 10; // some gravity
		
		var obj = new Object(types.FRAGMENT, x, y, v.x, v.y, accX, accY, 0, 0);
		obj.expireTimeMS = gNowMS + rnd(1000, 4000);
	}
}

/*---------------------------------------------------------------------------*/
var NewFallingObject = function()
{
	const x = RandomWidth(10); // random horiz start
	const accelY = rnd(40, 160);
	new Object(types.CIRCLE, x, 0, 0, 0, 0, accelY, RandomColor(), rnd(8,20));
}

/*---------------------------------------------------------------------------*/
var NewImageObject = function(x, y, velX, velY, accX, accY, src)
{
	var obj = new Object(types.IMAGE, x, y, velX, velY, accX, accY, 0, 0);
	obj.image = new Image();
	obj.image.src = src; 

	// start out as not ready until the img is loaded
	obj.ready = false;
	obj.image.onload = function () {
		//obj.size = (this.height * this.width);
		obj.ready = true;
	};
}

/*---------------------------------------------------------------------------*/
var CheckVerticalBounds = function()
{
	for (var i = 0; i < gObjects.length; i++)
	{
		let g = gObjects[i];
		if (g.type === types.GROUND && g.isActive() && IsOutOfVerticalBounds(g, gShipObject))
			gShipBlinkEndMS_RotateMS = (gNowMS + 800);
	}
}

/*---------------------------------------------------------------------------*/
var CalcShipDistanceToGround = function()
{
	let distance = INT_MAX;
	
	// not very efficient to check every ground line segment - need
	// a map or something (but this INT_MAX mechanism works fine)
	for (var i = 0; i < gGroundObjects.length; i++)
	{
		if (gGroundObjects[i].isBottom)
		{
			const d = CalcDistanceToGround(gGroundObjects[i], gShipObject);
			if (d < distance)
				distance = d;
		}
	}
	
	gShipDistanceFromGround = distance;
}

/*---------------------------------------------------------------------------*/
var VerticalDistanceToLine = function(rightX, rightY, leftX, leftY, obj)
{
	// only check the segment we're in since we're
	// checking vertical distance
	if (obj.x < leftX || obj.x > rightX)
		return INT_MAX;
	
	// avoid divide by zero
	if ((rightX - leftX) == 0)
		return INT_MAX;
	
	// slope
	const m = ((rightY - leftY) / (rightX - leftX));

	// b = y - mx, since y = mx + b
	const b = (rightY - (m * rightX));
	
	// now that we have the equation of the line, find the y value of the
	// point on the line with the x-coord of the ship (y = mx + b)
	const y = ((m * obj.x) + b);
	
	// the distance is the vertical line from the ship to the line segment
	const d = (y - obj.y);
	return d;
}

/*---------------------------------------------------------------------------*/
var CalcDistanceToGround = function (ground, obj)
{
	let distance = INT_MAX;

	for (var i = 0; i < obj.vertices.length; i++)
	{
		const d = VerticalDistanceToLine(	ground.rightEndpointX, ground.rightEndpointY,
											ground.x, ground.y,
											obj.vertices[i]);
		if (d < distance)
			distance = d;
	}
	
	return distance;
}

/*---------------------------------------------------------------------------*/
var IsUnderLine = function(rightX, rightY, leftX, leftY, obj)
{
	return (VerticalDistanceToLine(rightX, rightY, leftX, leftY, obj) < 0);
}

/*---------------------------------------------------------------------------*/
var IsAboveLine = function(rightX, rightY, leftX, leftY, obj)
{
	const d = VerticalDistanceToLine(rightX, rightY, leftX, leftY, obj);
	return (d > 0 && d < 1000);
}

/*---------------------------------------------------------------------------*/
var IsOutsideLines = function(isBottom, rightX, rightY, leftX, leftY, obj)
{
	if (isBottom)
		return IsUnderLine(rightX, rightY, leftX, leftY, obj);
	else
		return IsAboveLine(rightX, rightY, leftX, leftY, obj);
}

/*---------------------------------------------------------------------------*/
// 	METHOD:	IsOutOfVerticalBounds
//  see if any point on the object has collided with the ground or the top line
/*---------------------------------------------------------------------------*/
var IsOutOfVerticalBounds = function(ground, obj)
{	
	for (var i = 0; i < obj.vertices.length; i++)
	{
		if (IsOutsideLines(	ground.isBottom, 
							ground.rightEndpointX, ground.rightEndpointY, 
							ground.x, ground.y,
							obj.vertices[i]))
			return true;
	}
		
	return false;
}

/*---------------------------------------------------------------------------*/
var DrawGroundObject = function(obj)
{
	// the position of the line segment is defined as its left endpoint

	obj.rightEndpointX = (obj.x + obj.width);
	obj.rightEndpointY = (obj.y + obj.height);
	
	ctx.beginPath();
	ctx.strokeStyle = lineColor;
	ctx.lineWidth = 4;
	ctx.moveTo(obj.x, obj.y);
	ctx.lineTo(obj.rightEndpointX, obj.rightEndpointY);
	ctx.stroke();
	
	// when this line segment's right side hits the right edge, create the next one
	if (!obj.hasTriggeredNext && obj.rightEndpointX <= canvas.width)
	{
		obj.hasTriggeredNext = true;
		
		// start the next object - the right endpoint of the current object is
		// the left endpoint of the new one
		NewGroundObject(obj.rightEndpointX, obj.rightEndpointY, obj.isBottom, !obj.increasing);
	}
}

/*---------------------------------------------------------------------------*/
Object.prototype.initGround = function(isBottom, increasing) 
{
	this.isBottom = isBottom;
	this.increasing = increasing;
	this.hasTriggeredNext = false;

	const kGroundMidpoint = 300;
	
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
	let height = rnd(10, 100);
	
	// make sure the line segments stay within the above ^^ range
	// FIXME - these are all constants!!
	let mRangeMinY = 0;
	let mRangeMaxY = 0;
	if (isBottom)
	{
		mRangeMinY = (canvas.height - kLowerLineMin);
		mRangeMaxY = (canvas.height - kLowerLineMax);
	}
	else
	{
		mRangeMinY = (canvas.height - kUpperLineMin);
		mRangeMaxY = (canvas.height - kUpperLineMax);
	}
	
	if (increasing && (height > (this.y - mRangeMinY)))
		height = (this.y - mRangeMinY);
	else if (!increasing && (height > (mRangeMaxY - this.y)))
		height = (mRangeMaxY - this.y);
	
	// negative height if decreasing
	this.height = (height * (increasing ? -1.0 : 1.0));
	return;
}

/*---------------------------------------------------------------------------*/
var NewGroundObject = function(x, y, isBottom, increasing)
{
	const kGroundSpeedBottom = 120;
	const kGroundSpeedTop = 140;

	const velX = (isBottom ? -kGroundSpeedBottom : -kGroundSpeedTop);
	var obj = new Object(types.GROUND, x, y, velX, 0, 0, 0, 0, 0);
	obj.initGround(isBottom, increasing);
	gGroundObjects.push(obj);
}

/*---------------------------------------------------------------------------*/
var CheckRotation = function (isRotating)
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
			let angularChange = Math.abs(gAngleStart - gShipAngle);
			
			// calc the threshold for the next rotation
			// it's slightly less (3pi/8) than a full rotation to make it a little easier
			let nextRotationThreshold = (((gNumRotations + 1) * M_2PI) - M_3PI_8);
			
			// see if we have crossed the threshold
			if (angularChange > nextRotationThreshold)
			{
				gNumRotations++;
				//mShipBlinkColor = (gNumRotations > 1 ? Colours::red : Colours::blue);
				gShipBlinkEndMS_RotateMS = (gNowMS + 800);
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
var gKeysDown = {};
addEventListener("keydown", function (e) { gKeysDown[e.keyCode] = true; }, false);
addEventListener("keyup"  , function (e) { delete gKeysDown[e.keyCode]; }, false);

/*---------------------------------------------------------------------------*/
var GetUserInput = function (delta) 
{
	gThrusting = false;
	if (90 in gKeysDown) 
	{ 	
		// 'z'
		gThrusting = true;
		gShipObject.velY -= (gShipAngleCos * kThrustSpeed * delta); // vertical thrust
		gShipObject.velX += (gShipAngleSin * kThrustSpeed * delta); // horiz thrust
	}

	if (88 in gKeysDown) 
	{
		if (gNowMS - gLastShootMS > 200)
		{
			gLastShootMS = gNowMS;
			ShootBullet(gShipObject.x, gShipObject.y);
		}
	}

	var rotating = false;
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
	{
		gShipAngleCos = Math.cos(gShipAngle);
		gShipAngleSin = Math.sin(gShipAngle);
	}

	CheckRotation(rotating);
}

/*---------------------------------------------------------------------------*/
var EitherOfType = function(obj1, obj2, type)
{
	return (obj1.type === type || obj2.type === type);
}

/*---------------------------------------------------------------------------*/
var BothOfType = function(obj1, obj2, type)
{
	return (obj1.type === type && obj2.type === type);
}

/*---------------------------------------------------------------------------*/
var ExactlyOneOfType = function(obj1, obj2, type)
{
	return (obj1.type === type ^ obj2.type === type);
}
/*---------------------------------------------------------------------------*/
var Collided = function(obj1, obj2)
{
	// only bullets do damage
	if (!ExactlyOneOfType(obj1, obj2, types.BULLET))
		return false;

	if (EitherOfType(obj1, obj2, types.SHIP))
		return false;

	if (EitherOfType(obj1, obj2, types.FRAGMENT))
		return false;

	/*var dx = obj1.x - obj2.x;
	var dy = obj1.y - obj2.y;
	var distance = Math.sqrt(dx * dx + dy * dy);
	var collided = (distance < (obj1.size + obj2.size);*/

	// to-do: use actual height & width here
	const w = 6;
	const h = 6;
	const collided =  	obj1.x <= (obj2.x + h) &&
						obj2.x <= (obj1.x + h) &&
						obj1.y <= (obj2.y + w) &&
						obj2.y <= (obj1.y + w);

	if (collided)
	{
		obj1.alive = false;
		obj2.alive = false;
	}

	return collided;
}

/*---------------------------------------------------------------------------*/
// act on each pair of objects exactly once
var HandleObjectPairInteractions = function()
{
	gNumPairChecks = 0;
	for (var k = 0; k < (gObjects.length - 1); k++)
	{
		var o1 = gObjects[k];
		
		if (!o1.isActive()) 
			continue;
		
		for (var j = (k + 1); j < gObjects.length; j++)
		{
			var o2 = gObjects[j];

			ASSERT(o1 !== o2);
			
			if (!o2.isActive()) 
				continue;
			
			gNumPairChecks++;
			if (Collided(o1, o2))
				Explosion(o1.x, o1.y);
		}
	}
}

/*---------------------------------------------------------------------------*/
var DrawText = function () 
{
	  // text in upper left
  	ctx.fillStyle = textColor;
	ctx.font = "16px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";
	ctx.fillText("# objects: " + gNumActiveObjects + ", " + gObjects.length + ", " + gNumPairChecks, 
			24, canvas.height - 24);
}

/*---------------------------------------------------------------------------*/
var AnimateAndDraw = function (delta) 
{
	// animate & draw all the objects

	gNumActiveObjects = 0;
  	for(var i = 0; i < gObjects.length; i++) 
  	{
  		let obj = gObjects[i];
    	if(obj.isActive()) 
    	{
      		obj.animate(delta);
      		obj.adjustBounds();
      		obj.updateAliveState();
      		obj.draw();
      		gNumActiveObjects++;
    	}
  	}
}

/*---------------------------------------------------------------------------*/
var ClearCanvas = function (delta) 
{
	// fill background (and erase all objects)
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/*---------------------------------------------------------------------------*/
var DoSomeWork = function (delta) 
{
	ClearCanvas();
	GetUserInput(delta);
	AnimateAndDraw(delta);
	CheckVerticalBounds();
	CalcShipDistanceToGround();
  	HandleObjectPairInteractions();
	DrawText();
};

/*---------------------------------------------------------------------------*/
// do some random explosions
var DoExplosions = function () 
{
	for (var i = 0; i < 12; i++)
		Explosion(RandomWidth(20), RandomHeight(20));
}

/*---------------------------------------------------------------------------*/
var RandomColor = function () 
{
	return 'rgb(' + rnd(0,255) + ',' + rnd(0,255) + ',' + rnd(0,255) +')';
}

/*---------------------------------------------------------------------------*/
var RandomWidth = function (margin) 
{
	return rnd(margin, canvas.width - margin);
}

/*---------------------------------------------------------------------------*/
var RandomHeight = function (margin) 
{
	return rnd(margin, canvas.height - margin);
}

/*---------------------------------------------------------------------------*/
var Init = function () 
{
	gShipObject = new Object(types.SHIP,300,300,10,-10,0,100,shipColor,10);

	NewGroundObject(canvas.width, canvas.height - 20, true, true);
	NewGroundObject(canvas.width, canvas.height - 400, false, true);

	for (var i = 0; i < 10; i++)
	{
		const img = (i % 2) ? "images/monster.png" : "images/hero.png";
		NewImageObject(RandomWidth(20), RandomHeight(20), rnd(-50,50), rnd(-50,50), 0, 0, img);
	}

	setInterval(function() { NewFallingObject(); }, 1500);

	DoExplosions();
}

/*---------------------------------------------------------------------------*/
var EventLoop = function () 
{
	const nowMS = Date.now();
	const delta = (nowMS - gNowMS);
	gNowMS = nowMS;

	DoSomeWork(delta / 1000);
	
	// schedule us again immediately - 
	// this keeps the framerate as high as possible
	requestAnimationFrame(EventLoop);
};

/*---------------------------------------------------------------------------*/
var main = function () 
{
	Init();
	EventLoop();
} (); 


/*---------------------------------------------------------------------------*/
// Cross-browser support for requestAnimationFrame
var w = window;
requestAnimationFrame = w.requestAnimationFrame || w.webkitRequestAnimationFrame || w.msRequestAnimationFrame || w.mozRequestAnimationFrame;


