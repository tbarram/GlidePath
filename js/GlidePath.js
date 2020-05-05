
/*---------------------------------------------------------------------------

Glide Path
Ted Barram
Copyright 2020

---------------------------------------------------------------------------*/

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
canvas.width = window.innerWidth; //1200;
canvas.height = window.innerHeight; //680; 
document.body.appendChild(canvas);

let lastMouseX = 0;
let lastMouseY = 0;
let offsetX = canvas.offsetLeft;
let offsetY = canvas.offsetTop;
let mouseIsDown = false;
let draggedObject = 0;
let draggedObjectSavedMass = 0;
const kDefaultObjectGravity = 30;

let gSimulationMode = true;
let gNextSimulationMS = 0;
let gLogoImage;

let sGravitySettings = {};
let sGravitySettingsBest = {};

// get query params
const urlParams = new URLSearchParams(window.location.search);
let gNumGravityObjects = 7;
const gameOn = !urlParams.get('game');
let gGravityGameActive = !gameOn;
const kShipGravityV = 140; // 100

/*---------------------------------------------------------------------------*/
function handleMouseDown(e)
{
	const mouseX = parseInt(e.clientX - offsetX);
  	const mouseY = parseInt(e.clientY - offsetY);

  	lastMouseX = mouseX;
  	lastMouseY = mouseY;
  	mouseIsDown = true;

  	if (gLogoImage.isPointInside(mouseX, mouseY, 20))
  	{
  		gGravityGameActive = !gGravityGameActive;
  		SwitchScreens();
  	}
}

/*---------------------------------------------------------------------------*/
function handleMouseUp(e)
{
	if (draggedObject)
	{
		// reset dragged object
  		draggedObject.isBeingDragged = false;
  		draggedObject.mass = draggedObjectSavedMass;
  		draggedObject = 0;
  	}

  	canvas.style.cursor = 'default';
  	mouseIsDown = false;
}

/*---------------------------------------------------------------------------*/
function handleMouseMove(e)
{
	const mouseX = parseInt(e.clientX - offsetX);
  	const mouseY = parseInt(e.clientY - offsetY);

  	let targetObject = draggedObject;

  	// if we aren't dragging something, see if we should start
  	if (!targetObject)
  	{
  		// see if the mouse is over any of our objects
  		const kNearness = 8;
		for (let i = 0; i < gObjects.length; i++)
		{
			let obj = gObjects[i];
			if (obj.isActive() && obj.isPointInside(mouseX, mouseY, kNearness))
			{
				targetObject = obj;
				break;
			}
		}
	}

	canvas.style.cursor = targetObject ? 'pointer' : 'default';	

	// if mouse is down, handle dragging
  	if (mouseIsDown)
  	{
	  	if (targetObject && !draggedObject)
	  	{
	  		// we just started dragging
			draggedObject = targetObject;
			draggedObject.isBeingDragged = true;

			// give more mass to dragged obj (& save current val)
			draggedObjectSavedMass = draggedObject.mass;
			draggedObject.mass = (kDefaultObjectGravity * 4);
		}

		// update the dragged object position 
		if (draggedObject)
		{
			draggedObject.x += (mouseX - lastMouseX);
			draggedObject.y += (mouseY - lastMouseY);
		}
	}

	lastMouseX = mouseX;
  	lastMouseY = mouseY;
}

// slider positions
let gVertPos = 40;
const kRightPosValue = (canvas.width - 180);
const kValueVertOffset = 14;

/*---------------------------------------------------------------------------*/
let SetPosition = function(el, right, vert)
{
	el.style.position = "absolute";
	el.style.left = right + 'px';
	el.style.top = vert + 'px';
}

/*---------------------------------------------------------------------------*/
// util function for adding a slider element
let AddSlider = function(id, name, setValFunc, initialVal, bottomMargin)
{
	// label element for the slider
	const labelElementName = (id + "_value"); // convention in HTML
	let s_val = document.getElementById(labelElementName);
	SetPosition(s_val, kRightPosValue, (gVertPos - kValueVertOffset));

	gVertPos += 20;

	// slider element
	let s = document.getElementById(id);
	SetPosition(s, kRightPosValue, gVertPos);

	let update = function(val)
	{
		setValFunc(val); 						// update data model
	  	s_val.innerHTML = name + ": " + val; 	// update UI
	}

	// install the update callback as the action when slider moves
	s.oninput = function() { update(this.value); }

	// set initial val
	update(initialVal);
	s.value = initialVal;

	gVertPos += bottomMargin;
}

/*---------------------------------------------------------------------------*/
function InitShowTrailsUI() 
{
	//gVertPos += 30;
	let showTrails_Label = document.getElementById("showTrails_Label");
	SetPosition(showTrails_Label, kRightPosValue + 20, gVertPos - 14);
	showTrails_Label.innerHTML = "Trails:";

	gVertPos += 34;
	let trails_Off_Checkbox = document.getElementById("trails_Off_Checkbox");
	SetPosition(trails_Off_Checkbox, kRightPosValue, gVertPos - 14);

	let trails_Off_Label = document.getElementById("trails_Off_Label");
	SetPosition(trails_Off_Label, kRightPosValue + 22, gVertPos - 28);
	trails_Off_Label.innerHTML = "Off";

	gVertPos += 20;
	let trails_On_Checkbox = document.getElementById("trails_On_Checkbox");
	SetPosition(trails_On_Checkbox, kRightPosValue, gVertPos - 14);

	let trails_On_Label = document.getElementById("trails_On_Label");
	SetPosition(trails_On_Label, kRightPosValue + 22, gVertPos - 28);
	trails_On_Label.innerHTML = "On";

	gVertPos += 20;
	let trails_Timer_Checkbox = document.getElementById("trails_Timer_Checkbox");
	SetPosition(trails_Timer_Checkbox, kRightPosValue, gVertPos - 14);

	let trails_Timer_Label = document.getElementById("trails_Timer_Label");
	SetPosition(trails_Timer_Label, kRightPosValue + 22, gVertPos - 28);
	trails_Timer_Label.innerHTML = "Timer";

	let trailsTimerID;

	trails_Off_Checkbox.onclick = function() {
		sGravitySettings.showTrails = false;
		trails_Off_Checkbox.checked = true;
		trails_On_Checkbox.checked = false;
		trails_Timer_Checkbox.checked = false;

		clearInterval(trailsTimerID);
		trailsTimerID = false;
	}

	trails_On_Checkbox.onclick = function() {
		sGravitySettings.showTrails = true;
		trails_Off_Checkbox.checked = false;
		trails_On_Checkbox.checked = true;
		trails_Timer_Checkbox.checked = false;

		clearInterval(trailsTimerID);
		trailsTimerID = false;
	}

	let timerClickAction = function() {
		trails_On_Checkbox.checked = false;
		trails_Off_Checkbox.checked = false;
		trails_Timer_Checkbox.checked = true;

		if (!trailsTimerID)
		{
			sGravitySettings.showTrails = !sGravitySettings.showTrails; 
			trailsTimerID = setInterval(function() 
			{ 
				sGravitySettings.showTrails = !sGravitySettings.showTrails; 
			}, 7000); 
		}
	}

	trails_Timer_Checkbox.onclick = timerClickAction;
	timerClickAction();
	sGravitySettings.showTrails = true;
}

/*---------------------------------------------------------------------------*/
function ShowHideHtmlElements(show) 
{
	let htmlControls = document.getElementById("gravityControls");
	htmlControls.style.display = show ? "block" : "none";
}

/*---------------------------------------------------------------------------*/
function InitElements() 
{
	// show the controls
	ShowHideHtmlElements(GravityEnabled());

	InitShowTrailsUI();
	gVertPos += 30;

	// add the sliders
	/*
	AddSlider("gravity", "Gravity", 	(v) => { sGravitySettings.g = v; }, 	sGravitySettings.g, 20);
	AddSlider("maxG", "MaxG", 			(v) => { sGravitySettings.maxG = v; }, 	sGravitySettings.maxG, 20);
	AddSlider("minG", "MinG", 			(v) => { sGravitySettings.minG = v; }, 	sGravitySettings.minG, 20);
	AddSlider("maxV", "MaxV", 			(v) => { sGravitySettings.maxV = v; }, 	sGravitySettings.maxV, 20);
	*/
	AddSlider("numObjects", "# Objects", 	(v) => { gNumGravityObjects = v; }, 	gNumGravityObjects, 30);

	let UpdateStartButton = function()
	{
		startBtn.innerHTML = gStartGravityObjects ? "STOP" : "START";
	}

	// add the Reset button
	var resetBtn = document.getElementById("resetBtn");
	SetPosition(resetBtn, kRightPosValue, gVertPos);
	resetBtn.onclick = function() {
		gResetGravityObjects = true;
		gStartGravityObjects = false;
		UpdateStartButton();
	}

	// add the Start button
	var startBtn = document.getElementById("startBtn");
	SetPosition(startBtn, kRightPosValue + 60, gVertPos);
	startBtn.onclick = function() {
		gStartGravityObjects = !gStartGravityObjects;
		UpdateStartButton();
	}
	UpdateStartButton();
}

/*---------------------------------------------------------------------------*/
function CreateCurvePath(pts) 
{
    ctx.beginPath();

    let firstValid = 0;
    for (let i = 0; i < pts.length; i++) 
    {
    	if (pts[i])
    	{
    		firstValid = i;
    		break;
    	}
    }

    ctx.moveTo(pts[firstValid].x, pts[firstValid].y);
    for (let i = firstValid + 1; i < pts.length; i++) 
    	ctx.lineTo(pts[i].x, pts[i].y);

    //ctx.stroke();
}

/*---------------------------------------------------------------------------*/
// utilities
let rnd = function(min,max) { return (min + Math.floor(Math.random() * (max - min))); }
let RandomWidth = function (padL,padR) { return rnd(padL, canvas.width - (padR || padL)); }
let RandomHeight = function (padT,padB) { return rnd(padT, canvas.height - (padB || padT)); }
let RGB = function(r,g,b) { return 'rgb(' + r + ',' + g + ',' + b +')'; }
let RandomColor = function() { return RGB(rnd(0,255), rnd(0,255), rnd(0,255)); }

let DarkViolet = 		function() { return RGB(77,3,34); }
let LightPurple = 		function() { return RGB(190,182,229); }
let BrightYellow = 		function() { return RGB(197,243,15); }
let MellowOrange = 		function() { return RGB(234,148,34); }
let DeepRed = 			function() { return RGB(162,5,26); }
let Pink = 				function() { return RGB(243,108,141); }
let BrightPurple = 		function() { return RGB(206,114,235); }
let DarkDarkViolet = 	function() { return RGB(19,12,43); }
let DarkDarkViolet2 = 	function() { return RGB(19,12,73); }
let DarkRed = 			function() { return RGB(106,23,3); }
let BlueGray = 			function() { return RGB(163,178,177); }
let SmokeWhite = 		function() { return RGB(249,245,241); }
let Aqua = 				function() { return RGB(97,243,206); }
let WhiteViolet = 		function() { return RGB(241,211,232); }
let DarkAqua = 			function() { return RGB(70,140,240); }

let rndColorIntArray = [];
let rndColorIndex = 0;
const kNumRndColors = 13;

/*---------------------------------------------------------------------------*/
let shuffle = function(a) 
{
  	let top = a.length;
  	while(--top) 
  	{
    	let cur = Math.floor(Math.random() * (top + 1));
    	let tmp = a[cur];
    	a[cur] = a[top];
    	a[top] = tmp;
  	}
  	return a;
}

/*---------------------------------------------------------------------------*/
let GoodRandomColor = function()
{
	const i = rndColorIntArray[rndColorIndex];
	rndColorIndex = (rndColorIndex + 1) % kNumRndColors;

	switch (i)
	{
		case 0: return DarkDarkViolet();
		case 1: return DarkViolet();
		case 2: return LightPurple();
		case 3: return BrightYellow();
		case 4: return MellowOrange();
		case 5: return DeepRed();
		case 6: return Pink();
		case 7: return BrightPurple();
		case 8: return DarkRed();
		case 9: return BlueGray();
		case 10: return SmokeWhite();
		case 11: return Aqua();
		case 12: return DarkDarkViolet2();
		default: ASSERT(false, "index " + i + " out of bounds");
	}
}


/*---------------------------------------------------------------------------*/
const kMaxNumObjects = 512;
const kRotateSpeed = 8;
const kThrustSpeed = 647;
const kDistanceGameScoreCutoff = 48;
const kGroundCollisionBuffer = 3;
const kGroundSpeedBottom = 160;
const kGroundSpeedTop = 190;
const kBottom = true;
const kTop = false;

/*---------------------------------------------------------------------------*/
const kBackgroundColor = RGB(54,61,69);
const kTextColor = SmokeWhite();
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
const kTrailSize = 256;

/*---------------------------------------------------------------------------*/
let gNowMS = Date.now();
let gObjects = [];
let gGroundObjectsTop = new Array;
let gGroundObjectsBottom = new Array;
let gGravityObjects = new Array;
let gShipObject = {};
let gShipDistanceFromGround = 0;
let gShipLow = false;
let gShipAngle = 0;
let gShipAngleCos = 0;
let gShipAngleSin = 0;
let gThrusting = false;
let gAngleStart = 0;
let gTotalRotateTimeMS = 0;
let gShipBlinkEndMS_RotateMS = 0;
let gBlinkColor;
let gPauseThrustAfterShipReset = false;
let gWasRotating = false;
let gNumRotations = 0;
let gNextBlinkMS = 0;
let gBlink = false;
let gNumActiveObjects = 0;
let gLastShootMS = 0;
let gGameStartTimeMS = 0;
let gGameState = gGravityGameActive ? eInactive : eWaitingForStart;
let gScore = 0;
let gScoreBestAllTime = 0;
let gScoreEventCounter = new Map();
let gScoreEventCounterGuide = new Map();
let gScoreEventCounterBest = new Map();
let gScoreEventCounterBestAllTime = new Map();
let gPointsByKeepingLowIndex = 1;
let gPointsByKeepingLow = 0;
let gSwitch = false;
let gResetGravityObjects = false;
let gStartGravityObjects = true;
let gFallingObjectsTimer = 0;

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
		this.trail = [];

		this.width = size;
		this.height = size;
		this.ready = true;
		this.alive = true;
		this.isFixed = false;
		this.isBeingDragged = false;
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
	addMinimap(color)
	{
		let minimapObj = new Object(types.MINIMAP);
		minimapObj.parent = this;
		this.child = minimapObj;
		minimapObj.minimapColor = color;
	}

	/*---------------------------------------------------------------------------*/
	draw() 
	{
		switch (this.type)
		{
			case types.IMAGE:
				ctx.drawImage(this.image, this.x - this.width/2, this.y - this.height/2);
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
				// ground objects are now drawn in DrawGroundObjects
				CheckNextLine(this);
				break;
			case types.TEXT_BUBBLE:
				DrawTextObject(this);
				break;
			case types.MINIMAP:
				DrawCircle(GetMinimapPosition(this.parent), 1, this.minimapColor);
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

		// check expireTimeMS
		if (IsValidAndPastMS(this.expireTimeMS))
		{
			this.alive = false;
			if (this.child)
				this.child.alive = false;
			return;
		}

		// ground objects die when their right endpoint hits the left edge
		if (this.type === types.GROUND)
		{
			if (this.rightX < -100)
			{
				this.alive = false;
				RemoveGroundObject(this);
			}
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
	resetAcceleration() 
	{
		// if this object has gravity, reset its acceleration -
		// the acceleration will get accumulated in ApplyGravity by 
		// the other objects
		// acceleration is the ONLY changeable force
		
		if (this.hasGravity())
			this.accX = this.accY = 0;
	}

	/*---------------------------------------------------------------------------*/
	updateStartGravity()
	{
		if (this.isGravityObject || (this.parent && this.parent.isGravityObject))
			this.isFixed = !gStartGravityObjects;
	}

	/*---------------------------------------------------------------------------*/
	boundVelocity(delta) 
	{
		// bound velocity if maxV is set
		let maxV = sGravitySettings.maxV;
		if (maxV > 0)
		{
			if (maxV < 400)
				maxV = 400;

			this.velX = Bound(this.velX, maxV);
			this.velY = Bound(this.velY, maxV);
		}
	}

	/*---------------------------------------------------------------------------*/
	applyPhysics(delta) 
	{
		if (this.isFixed || this.isBeingDragged)
			return;

		// apply acceleration to velocity
		this.velX += (this.accX * delta);
		this.velY += (this.accY * delta);

		this.boundVelocity();

		// apply velocity to position
		this.x += (this.velX * delta);
		this.y += (this.velY * delta);

		// update right endpoints (for ground objects)
		this.rightX = (this.x + this.width); 	
		this.rightY = (this.y + this.height);
	}

	/*---------------------------------------------------------------------------*/
	isPointInside(x, y, margin) 
	{
		return (x >= (this.x - margin) && 
    			x <= (this.x + (this.width + margin)) &&
    			y >= (this.y - margin) &&
    			y <= (this.y + (this.height + margin)));
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

	/*---------------------------------------------------------------------------*/
	drawTrail()
	{
		if (!this.hasTrail || this.isFixed || 
			!sGravitySettings.showTrails || !GravityEnabled())
		{
			this.trail = [];
			return;
		}

		// add the current position to the end of the trail array
		this.trail.shift();
		this.trail[kTrailSize - 1] = {x: this.x, y: this.y};

		// style the trail lines
		ctx.strokeStyle = this.trailColor || "green";
		const prevLineWidth = ctx.lineWidth;
		ctx.lineWidth = 2;

		// create the trail path - doesn't draw it, just creates the path
		CreateCurvePath(this.trail);

		// check for closed loops
		if (this.isShip)
			HandleShipTrail();
		
		// draw it
		ctx.stroke();

		// reset 
		ctx.lineWidth = prevLineWidth;
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
function HandleShipTrail()
{
	// see if ship trail is closed path
	let closedPath = false;

	// dont check points too near each other
	const dist = 128;

	// check all pairs of points in the trail array 
	// (that are 'dist' apart) to see if 2 points
	// are equal - that indicates a loop
	for (let i1 = 0; i1 < (kTrailSize - dist); i1++)
	{
		for (let i2 = (i1 + dist); i2 < kTrailSize; i2++)
		{
			let p1 = gShipObject.trail[i1];
			let p2 = gShipObject.trail[i2];

			function pointsClose(p1, p2)
			{
				return	(Math.abs(p1.x - p2.x) < 2) &&
						(Math.abs(p1.y - p2.y) < 2);
			}

			if (p1 && p2 && p1 !== p2 && pointsClose(p1, p2))
			{
				closedPath = true;
				break;
			}
		}
	}

	// for now we make the entire trail red - 
	// better to make just the closed loop
	if (closedPath)
		ctx.strokeStyle = "red";

	if (closedPath)
	{
		const num = gObjects.length;
		for (let i = 0; i < num; i++)
		{
			const obj = gObjects[i];
			if (!obj.isActive() || obj.isShip) 
				continue;

			if (ctx.isPointInPath(obj.x, obj.y))
			{
				NewTextBubble("boom", obj, "red");
			}
		}
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
let DrawPolygon = function (verts, color) 
{
	ctx.beginPath();
	ctx.fillStyle = color;
	ctx.shadowBlur = DoShipShadow() ? 20 : 0; 
	ctx.shadowColor = "white";
	ctx.moveTo(verts[0].x, verts[0].y);
	for(let i = 1; i < verts.length; i++)
		ctx.lineTo(verts[i].x, verts[i].y);
	ctx.closePath();
	ctx.fill();

	ctx.shadowBlur = 0; // reset
}

/*---------------------------------------------------------------------------*/
let RotateAndDraw = function (verts, pos, color) 
{
	// rotate the vertices and store in rvs
	let rvs = []; 
	for (let i = 0; i < verts.length; i++)
	{
		let pt = Rotate(verts[i], pos, gShipAngleSin, gShipAngleCos);
		rvs.push(pt);
	}

	DrawPolygon(rvs, color);

	// return rotated vertices (only used for shipObject)
	return rvs; 	
}

/*---------------------------------------------------------------------------*/
let DoShipShadow = function()
{
	return (gShipDistanceFromGround < kDistanceGameScoreCutoff) || gThrusting;
}

/*---------------------------------------------------------------------------*/
let ColorForShip = function () 
{
	gShipObject.color = gShipLow ? MellowOrange() : kShipColor;
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

		color = gBlink ? "white" : gBlinkColor;
	}
	else
		gNextBlinkMS = 0;

	return color;
}

/*---------------------------------------------------------------------------*/
let ResetShip = function () 
{
	gShipObject.isFixed = true;
	gShipObject.trail = []; // clear trail

	gShipAngle = 0;
	CalcSinCosForShip();

	gShipObject.x = (canvas.width / 2);
	if (GravityEnabled())
		gShipObject.y = (canvas.height / 2);
	else
		gShipObject.y = gGroundMidpoint;

	gShipObject.velX = 0;
	gShipObject.velY = 0;
	gShipObject.accX = 0;
	gShipObject.accY = kShipGravityV;

	gShipObject.mass = GravityEnabled() ? sGravitySettings.shipG : 0;
	
	gShipBlinkEndMS_RotateMS = (gNowMS + 800);
	gTotalRotateTimeMS = 0;
	gPauseThrustAfterShipReset = true;
	ResetSimulationStart();

	if (gGameState === eStarted)
		gGameState = eEnded;
}

/*---------------------------------------------------------------------------*/
let ResetSimulationStart = function()
{
	// go into simulation mode after 12 seconds of inactivity
	gNextSimulationMS = GravityEnabled() ? 0 : (gNowMS + 12000);
}

/*---------------------------------------------------------------------------*/
const kBaseWidth = 16;
const kHeight = 8;
const kHalfBaseWidth = (kBaseWidth / 2);
const kHalfHeight = kHeight / 2;
const kCenterIndent = 4;
const kThrustWidth = ((kBaseWidth / 4) - 1);
const kThrustHeight = 8;

/*---------------------------------------------------------------------------*/
let DrawShip = function (obj) 
{
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
	const a = {x:0, y:0}; 
	let obj = new Object(types.TEXT_BUBBLE, p.x, p.y, v.x, v.y, a.x, a.y, color, 0);
	obj.text = text;
	obj.setLifetime(first ? 3000 : 1000);
	gTextBubbleList.push(obj);
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
			return SmokeWhite(); //"orange";
		case scores.eTripleRotate:
			return DarkAqua();
		case scores.eQuadrupleRotate:
			return BrightYellow(); //"blue";
		case scores.eQuintupleRotate:
			return "purple";
		case scores.eSingleRotateWithRescue:
		case scores.eDoubleRotateWithRescue:
		case scores.eTripleRotateWithRescue:
			return "yellow";
		case scores.eStayedLow:
			return MellowOrange();
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
		case scores.eSingleRotate: 				return 500;
		case scores.eDoubleRotate: 				return 1500;
		case scores.eTripleRotate: 				return 3000;
		case scores.eQuadrupleRotate: 			return 5000;
		case scores.eQuintupleRotate: 			return 12000; // has never happened

		case scores.eRescuedHostage: 			return 2000;
		case scores.eSingleRotateWithRescue: 	return 4000;
		case scores.eDoubleRotateWithRescue: 	return 30;
		case scores.eTripleRotateWithRescue: 	return 50;
		case scores.eStayedLow:					return 600;
		default: return 0;
	}
}

/*---------------------------------------------------------------------------*/
let ScoreEvent = function(ev)
{
	// we use isFixed as an "is game active" check
	// should probably add a new mIsScoringActive let
	if (gShipObject.isFixed && !gSimulationMode)
		return;

	if (gSimulationMode)
	{
		if (ev === scores.eStayedLow)
			return;
	}
	
	const score = ScoreForEvent(ev);
	let scoreText = ((score > 0 ? "+" : "") + score);

	if (!gSimulationMode)
	{
		gScore += score;

		// update the score event counter
		const prev = gScoreEventCounter.get(ev);
		gScoreEventCounter.set(ev, prev ? prev + 1 : 1);
	}
		
	// if it's the first time add extra text
	const firstTime = !!(gScoreEventCounter.get(ev) === 1);
	if (firstTime || gSimulationMode)
		scoreText = (TextForScoreEvent(ev) + " (" + scoreText + ")!");
	
	const color = TextColorForScoreEvent(ev);

	if (!gSimulationMode)
		NewTextBubble(scoreText, gShipObject, color, firstTime);
}

/*---------------------------------------------------------------------------*/
let ScoreStatsUI = function(list, x, y)
{
	list.forEach((value, key) => 
	{
		const score = ScoreForEvent(key);
		const text = LabelForScoreEvent(key) + " (+" + score + ") : " + value;

		const kScoreText3 = "14px Helvetica";
		ctx.font = kScoreText3;
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
	
	const stage = (gGameState === eWaitingForStart ? "Last" : "Current");
	ctx.fillText("--- " + stage + " score: " + gScore + " ---", x, y);
	y += 16;
	
	if (gScoreEventCounter.size > 0)
		y = ScoreStatsUI(gScoreEventCounter, x, y);
	else
		y = ScoreStatsUI(gScoreEventCounterGuide, x, y);
	
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
let ShootBullet = function(p, a)
{
	const kBulletSpeed = 400;
	const v = Velocity(kBulletSpeed, a);
	let bullet = new Object(types.BULLET, p.x, p.y, v.x, v.y, 0, 0, 0, 4);
	bullet.setLifetime(4000);
}

/*---------------------------------------------------------------------------*/
let ShootBullets = function(p)
{
	const kOffsetMult = 0.27;
	const kOffset = (M_PI_4 * kOffsetMult);

	ShootBullet(p, gShipAngle - kOffset);
	ShootBullet(p, gShipAngle);
	ShootBullet(p, gShipAngle + kOffset);
}

/*---------------------------------------------------------------------------*/
// do some random explosions
let DoExplosions = function() 
{
	for (let i = 0; i < 12; i++)
		Explosion({x: RandomWidth(20), y: RandomHeight(20)});
}

/*---------------------------------------------------------------------------*/
let Explosion = function(p)
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
		
		let obj = new Object(types.FRAGMENT, p.x, p.y, v.x, v.y, accX, accY, 0, 0);
		obj.setLifetime(rnd(2600, 6000));
	}
}

/*---------------------------------------------------------------------------*/
let NewFallingObject = function()
{
	// for now we're not dropping balls
	return;

	const x = RandomWidth(10, 240); // random horiz start
	const accelY = rnd(40, 160);	// random vertical (falling) acceleration
	const size = rnd(8,20);			// random size for the circle
	let obj = new Object(types.CIRCLE, x, 0, 0, 0, 0, accelY, RandomColor(), size);
	obj.setKilledBy(types.BULLET);
	obj.shadowBlur = rnd(6,16);
	obj.lightGradient = rnd(1,3) > 1 ? true : false;
	obj.gradient = !obj.lightGradient;

	if (gFallingObjectsTimer)
		clearTimeout(gFallingObjectsTimer);

	// schedule the next one
	if (gGameState === eStarted)
	{
		const elapsedGameTimeMS = (gNowMS - gGameStartTimeMS);
		//const avgNextMS = 400 + 4000 * (1 - ( 1 / elapsedGameTimeMS));
		const nextMS = 4000; //Math.max(10000 - elapsedGameTimeMS, 1000);
		gFallingObjectsTimer = setTimeout(() => NewFallingObject(), nextMS);
	}
}

/*---------------------------------------------------------------------------*/
let NewImageObject = function(x, y, velX, velY, accX, accY, src, minimap)
{
	let obj = new Object(types.IMAGE, x, y, velX, velY, accX, accY, 0, 0);
	obj.image = new Image();
	obj.image.src = src; 

	// start out as not ready until the img is loaded
	obj.ready = false;
	obj.image.onload = function () { 
		obj.width = obj.image.width;
		obj.height = obj.image.height;
		obj.ready = true; 
	};

	// could move this into Object constructor
	if (minimap)
		obj.addMinimap("yellow");

	return obj;
}

/*---------------------------------------------------------------------------*/
let NewGravityObject = function(x, y, mass)
{
	let obj = NewImageObject(x, y, 0, 0, 0, 0, 'images/icons8-bang-16.png',true/*minmimap*/);
	obj.mass = mass;
	obj.isGravityObject = true;
	obj.hasTrail = true;
	obj.trailColor = GoodRandomColor();
	obj.isFixed = !gStartGravityObjects;
	return obj;
}

/*---------------------------------------------------------------------------*/
let Distance = function(o1, o2) 
{
	const dx = (o2.x - o1.x);
	const dy = (o2.y - o1.y);
	return Math.hypot(dx, dy);
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
const s19 = {minG: 20, maxG: 1000, g: 500,  shipG: 60, maxV: 500}; // good one with 11 objects 
const s191 = {minG: 20, maxG: 1000, g: 500,  shipG: 30, maxV: 450}; 
const s141_copy_its_a_good_one_w_17_objects = {minG: 20,  maxG: 1500, g: 200,  shipG: 300, rnd: 1};
const s22 = {minG: 17, maxG: 1500, g: 470, shipG: 0, maxV: 450}; 

const s19_lowShipG = {minG: 20, maxG: 1000, g: 500,  shipG: 20, maxV: 500}; 

// this is the best ever don't change it
sGravitySettings = s19_lowShipG; 
sGravitySettingsBest = s19_lowShipG;

/*---------------------------------------------------------------------------*/
// ApplyGravity
// applies the gravity acceleration vector in both directions
// each object interacts with every other object exactly once in each frame
let ApplyGravity = function(o1, o2)
{
	if (!(sGravitySettings && o1.hasGravity() && o2.hasGravity()))
		return;

	const kMinG = 	sGravitySettings.minG;
	const kMaxG = 	sGravitySettings.maxG;
	const kG = 		sGravitySettings.g;
	
	// distance between the 2 objects
	const d = Distance(o1, o2);

	// gravity
	let gravity = (kG * o1.mass * o2.mass) / (d * d);

	// bound it (these bounds have a huge affect on the systen)
	gravity = Bound(gravity, kMinG, kMaxG);
	
	// get angle between the objects
	const angle = Math.atan2(o2.x - o1.x, o2.y - o1.y);

	// create the gravity acceleration vector
	const a = {	x: (gravity * Math.sin(angle)), 
				y: (gravity * Math.cos(angle))};
	
	// apply it to each object in opposite directions

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
//const kMiniMapTopLeftCorner = {mX: 130, mY: 80};
//const kMiniMapTopLeftCorner = {mX: canvas.width - 230, mY: canvas.height - 140};
const kMiniMapTopLeftCorner = {mX: 130, mY: canvas.height - 140};

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
	if (!GravityEnabled())
		return;

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

/*---------------------------------------------------------------------------*/
let Interpolate = function(a1, a2, a, b1, b2)
{
	return (b1 + (((a - a1) * (b2 - b1)) / (a2 - a1)));
}

/*---------------------------------------------------------------------------*/
let GetMinimapPosition = function(p)
{
	const x = Interpolate(0, canvas.width, p.x, kMiniMapTopLeftCorner.mX, kMiniMapTopLeftCorner.mX + kMinimapWidth);
	const y = Interpolate(canvas.height, 0, p.y, kMiniMapTopLeftCorner.mY + kMinimapHeight, kMiniMapTopLeftCorner.mY);
	return {x:x, y:y};
}

let gPressNextKeyBlinkMS = gNowMS;
let gDoPressNextKey = false;

/*---------------------------------------------------------------------------*/
let DoWaitingForStartText = function()
{
	const txt = gSimulationMode ? "SCORE POINTS BY STAYING LOW OR DOING ROTATIONS" : "Waiting For Start";
	ctx.fillText(txt, canvas.width/2, 70);

	const txt2 = "( use 'Z' to thrust, L/R arrows to rotate )"
	ctx.fillText(txt2, canvas.width/2, 107);

	//const txt3 = gSimulationMode ? "NO ONE HAS EVER PULLED OFF A QUINTUPLE ROTATION!" : "Best Score: " + gScoreBest;

	if (gScoreBestAllTime)
		ctx.fillText("Best All-time Score: " + gScoreBestAllTime, canvas.width/2, 164);

	if (gSimulationMode)
	{
		if (gDoPressNextKey)
		{
			ctx.save();
			ctx.fillStyle = "red";
			ctx.font = "28px Chalkboard";
			ctx.fillText("PRESS ANY KEY TO START", canvas.width/2, canvas.height - 100);
			ctx.restore();
		}

		if (IsValidAndPastMS(gPressNextKeyBlinkMS))
		{
			gDoPressNextKey = !gDoPressNextKey;
			gPressNextKeyBlinkMS = (gNowMS + 700);
		}
	}
}

/*---------------------------------------------------------------------------*/
let DoGame = function()
{
	if (GravityEnabled())
		return;

	ctx.fillStyle = SmokeWhite();
	ctx.font = "20px Chalkboard";
	ctx.textAlign = "center";
	ctx.textBaseline = "bottom";

	switch (gGameState)
	{
		case eInactive:
			return;

		case eWaitingForStart:
		{
			DoWaitingForStartText();

			if (gThrusting && !gSimulationMode)
				gGameState = eStarting;

			break;
		}

		case eStarting:
		{
			gScore = 0;
			gScoreEventCounter.clear();
			gGameState = eStarted;
			gGameStartTimeMS = gNowMS;
			//gGameEndTimeMS = gGameStartTimeMS + 8000; // 8 seconds
			gTotalRotateTimeMS = 0;
			gFallingObjectsTimer = setTimeout(() => NewFallingObject(), 800);
			break;
		}

		case eStarted:
		{
			//const timeRemainingMS = (gGameEndTimeMS - gNowMS);
			//if (timeRemainingMS <= 0)
			//	gGameState = eEnded;

			ctx.fillText("Score: " + gScore, canvas.width/2, 100);

			const elapsedTimeMS = (gNowMS - gGameStartTimeMS);
			ctx.fillText("Elapsed time: " + (Math.floor(elapsedTimeMS / 1000) + 1), canvas.width/2, 140);

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

			ResetShip();
			if (gFallingObjectsTimer)
				clearTimeout(gFallingObjectsTimer);
			break;
		}
	}
}

/*---------------------------------------------------------------------------*/
let CheckShipWithinLines = function()
{
	if (gShipObject.isFixed)
	{	
		gShipLow = false;
		return;
	}

	// reset each frame - we set it to max here, and then check each
	// line segment to get the min distance
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
			Explosion(gShipObject);
			ResetShip();
			break;
		}
	}

	gShipLow = (gShipDistanceFromGround < kDistanceGameScoreCutoff);
}

/*---------------------------------------------------------------------------*/
let VerticalDistanceToLine = function(rightX, rightY, leftX, leftY, p)
{
	// only check the segment we're in since we're checking vertical distance
	// TODO: can we optimize this so we don't have to iterate over all ground objects?
	if (p.x < leftX || p.x > rightX)
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
	const y = ((m * p.x) + b);
	
	// now the distance is just the distance between the y coordinates
	const d = (y - p.y);
	return d;
}

/*---------------------------------------------------------------------------*/
let IsUnderLine = function(rightX, rightY, leftX, leftY, p)
{ 
	const d = VerticalDistanceToLine(rightX, rightY, leftX, leftY, p);

	// since we only ever call this with the SHIP object, we can set this here
	if (d > 0 && d < INT_MAX)
		gShipDistanceFromGround = Math.min(d, gShipDistanceFromGround);

	return (d < (-kGroundCollisionBuffer));
}

/*---------------------------------------------------------------------------*/
let IsAboveLine = function(rightX, rightY, leftX, leftY, p)
{
	const d = VerticalDistanceToLine(rightX, rightY, leftX, leftY, p);
	return (d > kGroundCollisionBuffer && d < INT_MAX);
}

/*---------------------------------------------------------------------------*/
let IsOutsideLine = function(isBottom, rightX, rightY, leftX, leftY, p)
{
	if (isBottom)
		return IsUnderLine(rightX, rightY, leftX, leftY, p);
	else
		return IsAboveLine(rightX, rightY, leftX, leftY, p);
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
let CheckNextLine = function(obj)
{
	// the position of the line segment is defined as its left endpoint
	
	// when this line segment's right side hits the right edge, create the next one
	if (!obj.hasTriggeredNext && (obj.rightX <= canvas.width))
	{
		obj.hasTriggeredNext = true;
		
		// start the next object - the right endpoint of the current object is
		// the left endpoint of the new one
		NewGroundObject(obj.rightX, obj.rightY, obj.isBottom, !obj.increasing);
	}
}

/*---------------------------------------------------------------------------*/
let NewGroundObject = function(x, y, isBottom, increasing)
{
	const velX = (isBottom ? -kGroundSpeedBottom : -kGroundSpeedTop);
	let obj = new Object(types.GROUND, x, y, velX, 0, 0, 0, 0, 0);
	InitGround(obj, isBottom, increasing);
	if (isBottom)
		gGroundObjectsBottom.push(obj);
	else
		gGroundObjectsTop.push(obj);
}

/*---------------------------------------------------------------------------*/
let RemoveFromArray = function(obj, array)
{
	let i = array.indexOf(obj);
	if (i > -1) 
	  	array.splice(i, 1);
}

/*---------------------------------------------------------------------------*/
let RemoveGroundObject = function(obj)
{
	RemoveFromArray(obj, gGroundObjectsBottom);
	RemoveFromArray(obj, gGroundObjectsTop);
}

/*---------------------------------------------------------------------------*/
let InitGround = function(obj, isBottom, increasing) 
{
	obj.isBottom = isBottom;
	obj.increasing = increasing;
	obj.hasTriggeredNext = false;

	// each ground object is a new line segment
	if (false/*gSimulationMode*/)
	{
		let g = GetGroundCoords();
		obj.width = g.w;
		obj.height = g.h;
	}
	else
	{
		// get random values for the width and height of this line segment
		obj.width = rnd(30, 120);
		obj.height = rnd(10, 100);
	}
	
	// make sure the line segments stay within the range
	const minY = isBottom ? gLowerLineMin : gUpperLineMin;
	const maxY = isBottom ? gLowerLineMax : gUpperLineMax;
	
	const boundY = increasing ? (obj.y - minY) : (maxY - obj.y);
	//if (obj.height > boundY)
	//	console.log("bound " + (increasing ? "upper" : "lower"));
	obj.height = Math.min(obj.height, boundY);
	
	if (increasing)
		obj.height *= -1.0;
}

/*---------------------------------------------------------------------------*/
let DrawHorizLine = function(y)
{
	ctx.beginPath();
	ctx.moveTo(0, y);
	ctx.lineTo(canvas.width, y);
	ctx.stroke();
}

/*---------------------------------------------------------------------------*/
let DrawDebugGroundLines = function()
{
	ctx.save();
	ctx.strokeStyle = kLineColor;
	ctx.lineWidth = 1;
	ctx.globalAlpha = 0.2;
	ctx.setLineDash([5, 3]);/*dashes are 5px and spaces are 3px*/

	DrawHorizLine(gGroundMidpoint);
	DrawHorizLine(gUpperLineMin);
	DrawHorizLine(gUpperLineMax);
	DrawHorizLine(gLowerLineMin);
	DrawHorizLine(gLowerLineMax);
	ctx.restore();
}

let gNextMidpointMoveMS = 0;
let gGoingUp = false;

/*---------------------------------------------------------------------------*/
let gUpperLineMin = 0;
let gUpperLineMax = 0;
let gLowerLineMin = 0;
let gLowerLineMax = 0;

// the data in the gShipHistArray was recorded with gGroundMidpoint == 400,
// so we need to offset it if gGroundMidpoint changes
const kSimulationModeYOffset = 400;
const kGroundMidpointHeight = 500;
const kGroundMidpointOrig = (canvas.height - kGroundMidpointHeight);

// how far away from center we go before turning around
const kGroundMidpointRange = 250;

// how long to pause at the top and bottom of the range
const kGroundMidpointPeakPauseMS = 4000;

// how fast the lines move
const kGroundMidpointSpeed = 0.25;

// note: this can't be too small if the lines are moving fast
const kMinClosenessOrig = 50; //50; //84; //64;
const kMaxFarnessOrig = 200; //400;
const kMinClosenessMin = 30; // good min - anything smaller is too hard
const kMaxFarnessMin = 200;

let gGroundMidpoint = kGroundMidpointOrig;
let gMinCloseness = kMinClosenessOrig;
let gMaxFarness = kMaxFarnessOrig;

/*---------------------------------------------------------------------------*/
let DrawAndUpdateGround = function()
{
	DrawGroundObjects(gGroundObjectsBottom);
	DrawGroundObjects(gGroundObjectsTop);

	// update the bounds
	if (kGroundMidpointRange > 0 && (gNowMS > gNextMidpointMoveMS))
	//if (false)
	{
		const speed = (kGroundMidpointSpeed * (gGoingUp ? 1.0 : -1.0));
		gGroundMidpoint += speed;
		if (Math.abs(gGroundMidpoint - kGroundMidpointOrig) > kGroundMidpointRange)
		{
			gGoingUp = !gGoingUp;
			gNextMidpointMoveMS = (gNowMS + kGroundMidpointPeakPauseMS);
		}

		//if (gMaxFarness >= kMaxFarnessMin)
		//	gMaxFarness += 0.01;

		//if (gMinCloseness >= kMinClosenessMin)
		//	gMinCloseness += 0.01;
	}

	gUpperLineMin = gGroundMidpoint - (gMaxFarness/2); 
	gUpperLineMax = gGroundMidpoint - (gMinCloseness/2); 
	gLowerLineMin = gGroundMidpoint + (gMinCloseness/2);
	gLowerLineMax = gGroundMidpoint + (gMaxFarness/2);
	if (gLowerLineMax > (canvas.height - 20))
		gLowerLineMax = (canvas.height - 20);

	if (!GravityEnabled())
		DrawDebugGroundLines();
}

/*---------------------------------------------------------------------------*/
let DrawGroundObjects = function(groundObjects)
{
  	ctx.beginPath();
	ctx.strokeStyle = kLineColor;
	ctx.lineWidth = 2;
	ctx.lineJoin = "round";
    ctx.lineCap = "round";
	for (let i = 0; i < groundObjects.length; i++) 
  	{
  		const g = groundObjects[i];

		if (i === 0)
			ctx.moveTo(g.rightX, g.rightY);
		else
			ctx.lineTo(g.rightX, g.rightY);
  	}
  	ctx.stroke();
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
let ShipRotated = function ()
{
	gBlinkColor = gNumRotations <= 1 ? gShipObject.color : "red";
	gShipBlinkEndMS_RotateMS = (gNowMS + (gNumRotations <= 1 ? 800 : 1600));
	RotationScore(gNumRotations);
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
				ShipRotated();
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
addEventListener("keydown", (e) => 
	{ 
		gKeysDown[e.keyCode] = true; 
		e.preventDefault(); 	

		// switch out of simulation mode
		if (gSimulationMode)
		{
			gSimulationMode = false; 
			ResetShip();

			// kill any text bubbles created during simulation mode
			gTextBubbleList.forEach(obj => obj.setLifetime(0));
			gTextBubbleList.clear();
		}

		ResetSimulationStart();

	}, false);

addEventListener("keyup"  , (e) => { delete gKeysDown[e.keyCode]; e.preventDefault(); }, false);

const _Z_ = 90;
const _X_ = 88;
const _UpArrow_ = 38;
const _LeftArrow_ = 37;
const _RightArrow_ = 39;
let KeyDown = function(key) { return key in gKeysDown; }

/*---------------------------------------------------------------------------*/
let gLastKeyTime = new Array;
let gTextBubbleList = new Array;

/*---------------------------------------------------------------------------*/
// returns the key press if it has been ms since last pressed
let KeyDownThrottled = function(key, ms)
{
	if (KeyDown(key))
	{
		let lastKeyMS = gLastKeyTime[key];
		if (!lastKeyMS || (gNowMS - lastKeyMS) > ms)
		{
			gLastKeyTime[key] = gNowMS;
			return true;
		}
	}
	return false;
}

/*---------------------------------------------------------------------------*/
let IsValidAndPastMS = function (timeMS)
{
	return (timeMS !== 0 && (timeMS < gNowMS));
}


let previousAngle = 0;

/*---------------------------------------------------------------------------*/
let GetUserInput = function (deltaMS) 
{
	const delta = (deltaMS / 1000);
	let someKeyDown = false;

	// assume not
	gThrusting = false;

	// check thrusting keys
	if (KeyDown(_Z_) || KeyDown(_UpArrow_))
	{ 	
		someKeyDown = true;

		// after a ship reset, wait for the thrust key to be released before
		// using it - this way you don't start out thrusting after a reset
		if (!gPauseThrustAfterShipReset)
		{
			gThrusting = true;
			gShipObject.isFixed = false;

			// apply thrust to velocity
			gShipObject.velY -= (gShipAngleCos * kThrustSpeed * delta);
			gShipObject.velX += (gShipAngleSin * kThrustSpeed * delta);
		}
	}
	else
	{
		// clear the flag once the thrust keys are released
		gPauseThrustAfterShipReset = false;
	}

	// some horiz friction 
	// TODO: move this
	if (!gShipObject.hasGravity())
		gShipObject.accX = (gShipObject.velX > 0) ? -10 : 10;

	// check shoot key
	if (KeyDownThrottled(_X_, 500)) 
	{
		someKeyDown = true;
		ShootBullets(gShipObject);
	}

	// check arrow keys for rotation
	let rotateDir = KeyDown(_LeftArrow_) ? -1 : KeyDown(_RightArrow_) ? 1 : 0;
	let isRotating = (rotateDir !== 0);
	someKeyDown |= isRotating;

	gShipAngle += (kRotateSpeed * delta * rotateDir);

	if (IsValidAndPastMS(gNextSimulationMS))
	{
		gNextSimulationMS = 0;
		gSimulationMode = true;
		gGroundMidpoint = kGroundMidpointOrig;
	}

	// for generating data for the gShipHistArray array
	console.log("new ShipHist(" + gShipObject.x.toFixed(2) + "," + gShipObject.y.toFixed(2) + "," + 
						gShipAngle.toFixed(2) + "," + gThrusting + "), ");

	if (gSimulationMode)
	{
		let h = gShipHistArray[gShipHistArrayIndex];
		gShipHistArrayIndex = (gShipHistArrayIndex + 1) % gShipHistArray.length;

		gShipObject.x = h.x;
		gShipObject.y = (h.y + gGroundMidpoint - kSimulationModeYOffset);
		gThrusting = h.thrusting;
	
		gShipAngle = h.angle;
		isRotating = (gShipAngle !== previousAngle);
		previousAngle = gShipAngle;
	}

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
				Explosion(otherObj);
				otherObj.alive = false;
			}
		}
		else
		{
			o1.alive = false;
			o2.alive = false;
			Explosion(o1);
		}
	}

	return collided;
}

/*---------------------------------------------------------------------------*/
let DoObjectPairInteraction = function(o1, o2)
{
	ASSERT(o1 !== o2);
	CheckCollision(o1, o2);
	ApplyGravity(o1, o2);
}

/*---------------------------------------------------------------------------*/
// act on each pair of objects exactly once 
let DoObjectPairInteractions = function()
{
	const num = gObjects.length;

	for (let i1 = 0; i1 < (num - 1); i1++)
	{
		const o1 = gObjects[i1];
		if (!o1.isActive()) 
			continue;

		for (let i2 = (i1 + 1); i2 < num; i2++)
		{
			ASSERT(i1 !== i2);

			const o2 = gObjects[i2];
			if (!o2.isActive()) 
				continue;
			
			DoObjectPairInteraction(o1, o2);
		}
	}
}

/*---------------------------------------------------------------------------*/
let DrawText = function () 
{
	if (GravityEnabled())
		return;
	
  	ctx.fillStyle = kTextColor;
	ctx.font = "16px Helvetica";
	ctx.textAlign = "left";
	ctx.textBaseline = "bottom";

	// lower left
	//ctx.fillText("Sim mode: " + (gSimulationMode ? "ON":"OFF"), 40, canvas.height - 40);

	// lower right
	const leftTextStart = (canvas.width - 230);
	ctx.fillText("L / R arrows to rotate", leftTextStart, canvas.height - 60);
	ctx.fillText("Z to thrust", leftTextStart, canvas.height - 40);
	//ctx.fillText("X to shoot", leftTextStart, canvas.height - 40);

	// "Press any key to start" message

	/*if (gSimulationMode)
	{
		ctx.font = "20px Chalkboard";
		ctx.fillText("Press any key to start!", canvas.width/2, canvas.height - 80);
	}*/

	/*
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
	*/
	
}

/*---------------------------------------------------------------------------*/
let AnimateAndDrawObjects = function (deltaMS) 
{
	const deltaS = (deltaMS / 1000);
	gNumActiveObjects = 0;

	// animate & draw all the active objects in the gObjects array
  	for (let i = 0; i < gObjects.length; i++) 
  	{
  		const obj = gObjects[i];
    	if (!obj.isActive()) 
    		continue;

    	// do the per-frame work on this object
    	obj.updateStartGravity();
  		obj.applyPhysics(deltaS);
  		obj.resetAcceleration();
  		obj.adjustBounds();
  		obj.updateAliveState();
  		obj.draw();
  		obj.drawTrail();
  		gNumActiveObjects++;
  	}
}

/*---------------------------------------------------------------------------*/
let CheckResetGravity = function () 
{
	if (gResetGravityObjects)
  	{
  		gResetGravityObjects = false;
  		rndColorIntArray = shuffle(rndColorIntArray);
  		rndColorIndex = 0;
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
	return gGravityGameActive;
}

/*---------------------------------------------------------------------------*/
let CreateGravityObjects = function()
{
	for (let i = 0; i < gNumGravityObjects; i++)
	{
		const w = RandomWidth(200);
		const h = RandomHeight(200);

		const kNumSameLoc = 1;
		for (var j = 0; j < kNumSameLoc; j++)
		{
			let obj = NewGravityObject(w, h, sGravitySettings.rnd ? rnd(20,60) : kDefaultObjectGravity);
			gGravityObjects.push(obj);
		}
	}
}

/*---------------------------------------------------------------------------*/
let StopGravityObjects = function()
{
	gGravityObjects.forEach(obj => obj.setLifetime(0));
	gGravityObjects = [];
}

/*---------------------------------------------------------------------------*/
let SwitchScreens = function()
{
	if (GravityEnabled())
	{
		StopGroundObjects();
		CreateGravityObjects();

		gSimulationMode = false; 

		// kill any text bubbles created during simulation mode
		gTextBubbleList.forEach(obj => obj.setLifetime(0));
		gTextBubbleList = [];
	}
	else
	{
		StopGravityObjects();
		StartGroundObjects();
	}

	ResetShip();
	ShowHideHtmlElements(GravityEnabled());
}


/*---------------------------------------------------------------------------*/
let StartGroundObjects = function()
{
	// start the lower & upper ground objects
	NewGroundObject(canvas.width, canvas.height - 100, kBottom, true);
	NewGroundObject(canvas.width, canvas.height - 300, kTop, true);
}

/*---------------------------------------------------------------------------*/
let StopGroundObjects = function()
{
	gGroundObjectsBottom.forEach(obj => obj.setLifetime(0));
	gGroundObjectsBottom = [];
	gGroundObjectsTop.forEach(obj => obj.setLifetime(0));
	gGroundObjectsTop = [];
}

/*---------------------------------------------------------------------------*/
let Exit = function () {};

/*---------------------------------------------------------------------------*/
let Init = function () 
{
	InitElements();

	// install mouse event handlers
	canvas.addEventListener('mousedown', handleMouseDown);
	canvas.addEventListener('mousemove', handleMouseMove);
	canvas.addEventListener('mouseup', handleMouseUp);

	// init the a normal integer array
	for (let i = 0; i < kNumRndColors; ++i) 
		rndColorIntArray[i] = i;

	// create the ship
	gShipObject = new Object(types.SHIP, 0, 0, 0, 0, 0, 0, kShipColor, 8);
	gShipObject.setKilledBy(types.CIRCLE);
	gShipObject.addMinimap(kShipColor);
	gShipObject.hasTrail = true;
	gShipObject.trailColor = DarkDarkViolet();
	gShipObject.isShip = true;
	ResetShip();

	// logo pic
	let logoPos = {x: 120, y: 120};
	//if (GravityEnabled())
	//	logoPos = {x: canvas.width - 180, y: canvas.height - 160};

	gLogoImage = NewImageObject(logoPos.x,logoPos.y,0,0,0,0,'images/GP.png');

	if (GravityEnabled())
	{
		if (sGravitySettings.shipG)
			gShipObject.mass = sGravitySettings.shipG;

		gStartGravityObjects = true; // start out moving
		CreateGravityObjects();
	}
	else
	{
		StartGroundObjects();
	}

	gScoreEventCounterGuide.set(scores.eStayedLow, 0);
	gScoreEventCounterGuide.set(scores.eSingleRotate, 0);
	gScoreEventCounterGuide.set(scores.eDoubleRotate, 0);
	gScoreEventCounterGuide.set(scores.eTripleRotate, 0);
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
	DrawAndUpdateGround();
	CalcRotationTime(deltaMS);
	GetUserInput(deltaMS);
	DoObjectPairInteractions();
	CheckShipWithinLines();
	AnimateAndDrawObjects(deltaMS);
	CheckResetGravity();
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
requestAnimationFrame = window.requestAnimationFrame || 
						window.webkitRequestAnimationFrame || 
						window.msRequestAnimationFrame || 
						window.mozRequestAnimationFrame;


