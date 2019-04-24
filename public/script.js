//Canvas
var canvas = document.getElementById('mainCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var c = canvas.getContext('2d');

var FindCanvas = function(id, compositeOp, returnContext, _zIndex)
{

    if(_zIndex == null)
        _zIndex = -1;

    var tempCanvas;

    if(canvases[id])
    {
        tempCanvas = canvases[id];
    }
    else{
        tempCanvas = document.createElement('canvas');

        tempCanvas.id = id;
        tempCanvas.width = window.innerWidth;
        tempCanvas.height = window.innerHeight;
        tempCanvas.style.zIndex = _zIndex;
        tempCanvas.style.position = "absolute";
        tempCanvas.style.left = "0";
        tempCanvas.style.top = "0";
    
        document.getElementById("content").appendChild(tempCanvas);
        canvases[id] = document.getElementById(id);
    }

    if(returnContext)
    {
        var context = tempCanvas.getContext('2d');
        context.globalCompositeOperation = compositeOp;
        return context;
    }
    else
        return tempCanvas;
}

var canvases = {mainCanvas: canvas};

var mouse = {
    x :undefined,
    y: undefined,
    clicked: false,
    clickDown: false
}

String.prototype.trunc = 
      function(n){
          return (this.length > n) ? this.substr(0, n-1) + '&hellip;' : this;
      };

//Vector Stuff
var Vector = function(x, y) {
    this.x = x || 0;
    this.y = y || 0;

    this.add = function(v){
        this.x += v.x;
        this.y += v.y;
    }

    this.sub = function(v){
        this.x -= v.x;
        this.y -= v.y;
    }
};
Vector.prototype.getDirection = function() {
	return Math.atan2(this.y, this.x);
};
Vector.prototype.setDirection = function(direction) {
	var magnitude = this.getMagnitude();
  this.x = Math.cos(direction) * magnitude;
  this.y = Math.sin(direction) * magnitude;
};
Vector.prototype.addition = function(v1, v2) {
    return new Vector(v1.x + v2.x, v1.y + v2.y);
};
Vector.prototype.subtract = function(v1, v2) {
    return new Vector(v1.x - v2.x, v1.y - v2.y);
};
Vector.prototype.getMagnitude = function() {
	return Math.sqrt(this.x * this.x + this.y * this.y);
};
Vector.prototype.setMagnitude = function(magnitude) {
	var direction = this.getDirection(); 
	this.x = Math.cos(direction) * magnitude;
	this.y = Math.sin(direction) * magnitude;
};
Vector.prototype.random = function(min, max) {

	return new Vector(getRndInteger(min, max),getRndInteger(min, max));
};

Array.prototype.contains = function(thing){
    for (var i = 0; i < this.length; i++) {
        if(this[i] == thing)
            return true;
    }
    return false;
};

//Sockets
var socket;
var clientId;
var otherPlayers = {};
var worldObjects = {};
var worldItems = {};
var hittableObjects = {};
var gridSize;
var gridBoxScale;
var gridPos;
var worldId;

function getAllWorldObjects(){
    var objects = [];

    objects = Object.assign({}, worldObjects.planets, worldObjects.spaceMatter, worldObjects.shops);

    if(spaceShip)
        objects[spaceShip.id] = spaceShip;

    return objects;
}

function getAllStructures(){
    var structures = {};
    var planets = worldObjects.planets;

    for (var planetId in planets) {
        if (planets.hasOwnProperty(planetId)) {
            var planet = planets[planetId];

            if(worldObjects.planets[planet.id].health >= 0)
            {
                var planetStructures = planet.structures;
    
                for(var x = 0; x < planetStructures.length; x++){
                    structures[planetStructures[x].id] = planetStructures[x];
                }
            }
        }
    }

    for (var id in otherPlayers) {
        if (otherPlayers.hasOwnProperty(id)) {

            var player = otherPlayers[id];

            if(player && player.turret)
                structures[player.turret.id] = player.turret;
        }
    }

    if(spaceShip && spaceShip.turret)
        structures[spaceShip.turret.id] = spaceShip.turret;
    
    return structures;
}

//Variables
var centerX;
var centerY;
var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var spaceShip;

var allWorldObjects = [];
var allStructures = {};
var allPlayers = {};

var UPDATE_RATE = 20;

var BLCAKHOLE_GRAVITY = .01;
var BLCAKHOLE_GRAVITY_EXPONENT = 2.5;
var MAX_GRAVITATIONAL_DISTACNE = 600;
var planetDist;

var LANDING_DISTANCE = 200;
var SPACESHIP_DECELERATION_TIME = 20;

var mousePullx = 0;
var mousePully = 0;

var spaceshipVelocity = new Vector();

var playerReloadTimer = 0;
var shootCooldownTimer = 0;
var shootCooldownTime = 10;
var isHoldingShoot = false;

var projectiles = [];
var otherProjectiles = [];

var currentPlanet;
var closestAvailablePlanet;

var healthDict = {};
var dropDict = {};
var playerItems = {};

var numStatUpgrades;
var usedUpgrades = 0;

var images = {};
var imageArray = ["NF", "hive", "asteroidBits", "backX", "boost0", "boost1", "boost2", "boost3", "bulletPenetration0", "bulletPenetration1", "bulletPenetration2", "bulletPenetration3", "circuit", "charge", "cloakTime0", "cloakTime1", "cloakTime2", "cloakTime3", "cloakTime4", "crystal", "E", "earth", "enemyscout0", "enemyscout1", "enemydefender0", "enemydefender1", "enemyguard0", "enemyguard1", "spawnerScoutGray", "spawnerScout0", "spawnerScout1", "spawnerDefender0", "spawnerDefender1", "spawnerDefenderGray", "spawnerGuard0", "spawnerGuard1", "spawnerGuardGray", "gem", "iron", "landingPad0", "mine0", "mine1", "mine2", "mine3", "mine4", "mine5", "mine6", "mine7", "mine8", "mine9", "mine10", "mineGray", "S", "satellite0", "satellite1", "satellite2", "satellite3", "satelliteGray", "shieldGenerator0", "shieldGenerator1", "shieldGenerator2", "shieldGenerator3", "shieldGenerator4", "shieldGenerator5", "shieldGenerator6", "shipTurret0", "shipTurret1", "shipTurret2", "shipTurret3", "shipTurret4", "shipTurretBase0", "shipTurretBase1", "shipTurretBase2", "shipTurretBase3", "shipTurretBase4", "spaceShip0", "spaceShip1", "spaceShip2", "spaceShip3", "spaceShip4", "spaceShip5", "spaceShip6", "spaceShip7", "spaceShip8", "spaceShip9", "spaceShip10", "spaceShip11", "spaceShip12", "spaceShip13", "spaceShip14", "spaceShip15", "spaceShipGray", "stardust", "startGameButton", "spaceShipGray", "turret0", "turret1", "turret2", "turret3", "turret4", "turret5", "turret6", "turret7", "turretGray", "water", "warningSign"];

function getImage(item){
    for (var image in images) {
        if (images.hasOwnProperty(image)) {
            if(image == item)
             return images[image];
        }
    }

    //No saved image
    var img = new Image();
    img.src = 'images/' + item + '.png';

    img.onerror = function(){ 
        img.src = "images/NF.png";
    };

    images[item] = img;
    return img;
}

var structureUpgrades;
var playerUpgrades;
var shopUpgrades;

var showUpgradesPannel = false;
var clickedUpgrade = false;

var playerDisplayMessage = "";
var playerMessageTimer;
var playerMessageAlpha = 1;
var playerMessageFadeSpeed = 0;

var producingMines = [];
var friendlyObjectIds = [];
var statsView = false;
var requestAnimationFrameId;
var scale = 1;
var sunTint = {amount: 0, color: "#fffff"};

var ownedPlanets = {};
var hiveObj = {};

var windowWidth;
var windowHeight;

var flashingPlanetArrows = {};
var attackedPlanets = {};
var planetArrowFlashColor = "#ff6068";
var planetArrowFlashInterval = 20;
var planetArrowFlashTimes = 2;

var startScale = 1;
var targetScale = startScale;
var scaleTime = 50;
var scaleSpeed = 3;

var shopUpgradeButtonClicked = false;
var shopOpen = {shopRef: null, type: null, open: false};

var cloaked = false;
var cloakTime = 0;
var cloakCoolDown = 1000;
var cloakCoolDownTime = cloakCoolDown;

var boost = false;
var boostAmount = 0;
var boostReady = false;

var lastPlayerPos = {x: 0, y: 0};
var lastPlayerRot;

var landed = false;

var turretManualMode = false;
var turretRotSendTimer = {time: 0, delay: 20};

var propertiesTimer = {};
var propertiesHoldTime = 80;
var username = "unnamed";

var colorChangedHitObjects = {};

var caughtInBlackHole = false;

var aquiredItems = {};
var aquireItemsFadeTime = 50;

var DISPLAY_NEWS = false;
var newsDisplayed = DISPLAY_NEWS;

var POSITION_SEND_DELAY = 6;
var positionSendTime = 0;

var planetShopSelection = null;
var selectedStructure = null;
var lastSelectedStructue = null;
var boughtStructure = null;
var electricityTimer = {time: 0, duration: 50, on: false};

var boostLength;
var boostRechargeLegnth;

var structureSpawnPosition = null;
var structureSpawnRotation = null;

var miniMapSize;
var minimapPadding;

var master = {id: null, obj: null};

function infoPosY()
{
    return $(window).height() - $(window).height() / 6;
}

var checklist = {
    fly:{
        isActive: false
    },
    shoot:{
        isActive: false
    },
    landingPadDesc:{
        isActive: false
    },
    aquiredCrown:{
        isActive: false
    }
}

checklistFadeTime = 20;

function setup(){
    //socket = io.connect('http://localhost:8080');
    socket = io.connect('http://space-base.io/');
    socket.on('setupLocalWorld', setupLocalWorld);
    socket.on('showWorld', showWorld);
    socket.on('newPlayerStart', startLocalPlayer);
    socket.on('playerPos', updatePlayerPosition);
    socket.on('newPlayer', newPlayer);
    socket.on('playerExited', playerExited);
    socket.on('damageSync', receiveDamageSync);
    socket.on('spawnProj', spawnNetworkedProjectile);
    socket.on('spawnStructure', spawnNetworkedStructure);
    socket.on('destroyProjectiles', destroyNetworkedProjectiles);
    socket.on("items", onAquiredItems);
    socket.on("updateItems", updateItems);
    socket.on("upgradeSync", upgradeSync);
    socket.on("returnMsg", returnMsg);
    socket.on("serverDisconect", forceDisconnect);
    socket.on("planetOccupancy", updatePlanetOccupier);
    socket.on("ejectPlayer", ejectPlayer);
    socket.on("mineProduce", mineProduce);
    socket.on("respawn", respawn);
    socket.on("respawnPlanet", respawnPlanet);
    socket.on("newWorldObjectSync", newWorldObjectSync);
    socket.on("syncItem", syncItem);
    socket.on('shopUpgrade', shopUpgrade);
    socket.on('turretRot', turretRot);
    socket.on('cloak', cloak);
    socket.on('master', setMaster);

    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);
}

//Receive Data Functions
function setupLocalWorld(data){
    worldId = data.worldId;
    clientId = socket.io.engine.id;
    master.id = data.master;
    gridSize = data.gridSize;
    gridBoxScale = data.gridBoxScale;

    //Upgrade Info
    structureUpgrades = data.upgrades.structureUpgrades;
    playerUpgrades = data.upgrades.playerUpgrades;
    shopUpgrades = data.upgrades.shopUpgrades;

    playerStatUpgrades = JSON.parse(data.upgrades.playerStatUpgrades);
    playerStatUpgrades.speed = eval(playerStatUpgrades.speed);
    playerStatUpgrades.maxHealth = eval(playerStatUpgrades.maxHealth);
    playerStatUpgrades.damage = eval(playerStatUpgrades.damage);
    playerStatUpgrades.fireRate = eval(playerStatUpgrades.fireRate);
    playerStatUpgrades.roundToPlace = eval(playerStatUpgrades.roundToPlace);

    //Set Temporary GridPosition for spectating while not in game
    gridPos = new Vector(data.x + gridSize / -2, data.y + gridSize / -2);

    numStatUpgrades = data.numStats;

    //Spawn other players
    otherPlayers = {};

    var existingPlayers = data.worldObjects.existingPlayers;

    for (var playerId in existingPlayers) {
        if (existingPlayers.hasOwnProperty(shopsId)) {
            var client = existingPlayers[playerId];
            
            if(client.id != clientId){
                var player = new NetworkSpaceShip(client.x, client.y, client.maxHealth, client.health, 0, client.level, client.radius, client.username, client.id);

                if(client.id == master.id)
                master.obj = player;

                if(client.shipTurret){
                    var isFacade = player.id != clientId;

                    player.turret = new Turret(player, client.x, client.y, 0, client.shipTurret.level - 1, isFacade, player.id, client.shipTurret.id);
                    player.turret.distanceFromPlanet = 0;
                    player.turret.headDistanceFromBase = 0;
                    player.turret.type = "shipTurretBase";
                }        

                otherPlayers[player.id] = player;
            }
        }
    }

    //Spawn World Objects
    worldObjects = {spaceMatter: {}, planets: {}, shops: {}};// = data.worldObjects;

    //Shops
    var shops = data.worldObjects.shops;

    for (var shopsId in shops) {
        if (shops.hasOwnProperty(shopsId)) {
            var shop = shops[shopsId];

            var shopObject = new Shop(shop.x, shop.y, shop.radius, shop.upgradeType);
            worldObjects.shops[shop.id] = shopObject;
        }
    }

    //Space Matter
    var spaceMatterObjs = data.worldObjects.spaceMatter;

    for (var matterId in spaceMatterObjs) {
        if (spaceMatterObjs.hasOwnProperty(matterId)) {
            var spaceMatter = spaceMatterObjs[matterId];

            if(!spaceMatter || spaceMatter.health <= 0)
                continue;

            var spaceMatterObj = new SpaceMatter(spaceMatter.x, spaceMatter.y, spaceMatter.radius, spaceMatter.color, spaceMatter.maxHealth, spaceMatter.health, spaceMatter.type, spaceMatter.id);
            worldObjects.spaceMatter[spaceMatterObj.id] = spaceMatterObj;
            dropDict[spaceMatter.id] = spaceMatter.drops;

            if(spaceMatterObj.id == "hiveObj")
                hiveObj = spaceMatterObj;
        }
    }

    //Planets
    var planets = data.worldObjects.planets;

    for (var planetId in planets) {
        if (planets.hasOwnProperty(planetId)) {
            var planet = planets[planetId];

            if(!planet || planet.health <= 0)
                continue;

            var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, planet.id);
            planetObject.occupiedBy = planet.occupiedBy;
            planetObject.owner = planet.owner; 

            worldObjects.planets[planetObject.id] = planetObject;

            //Add all existing structures
            for (var s = 0; s < planet.structures.length; s++) {
                var structure = planet.structures[s];
                var isFacade = structure.ownerId != clientId;

                if(structure.type == "spawner")
                {
                    var uppercasedType = structure.enemyType.charAt(0).toUpperCase() + structure.enemyType.slice(1);
                    structure.type = "spawner" + uppercasedType;
                }

                planetObject.addStructure(planetObject, structure.x, structure.y, structure.rotation, structure.type, structure.level, isFacade, structure.ownerId, structure.id);
            }

            dropDict[planetObject.id] = planet.drops;
        }
    }

    allWorldObjects = getAllWorldObjects();
}
function syncItem(data){
    playerItems[data.item] = data.amount;
}
function newWorldObjectSync(data){
    
    if(data.newObject.type == "planet"){

        var changedPlanet = worldObjects.planets[data.id];
        var ownedPlanet = ownedPlanets[data.id];

        if(currentPlanet && data.id == currentPlanet.id){
            currentPlanet = null;
            landed = false;
        }

        if(ownedPlanet){
            ownedPlanet.structures = [];
            allStructures = getAllStructures();
            delete ownedPlanets[data.id];
        }

        if(data.dead && changedPlanet){

            delete worldObjects.planets[changedPlanet.id]
            delete hittableObjects[data.id];
        }
        else{
            var planet = data.newObject;
            var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, data.id);
              
            planetObject.owner = planet.owner;

            if(changedPlanet)
                worldObjects.planets[changedPlanet.id] = planetObject;
            else
                worldObjects.planets[planetObject.id] = planetObject;
        }
    }
    else{

        var changedSpaceMatter = worldObjects.spaceMatter[data.id];

        if(data.dead && changedSpaceMatter)
        {
            delete worldObjects.spaceMatter[changedSpaceMatter.id]
            delete hittableObjects[data.id];
        }
        else{
            var newSpaceMatter = new SpaceMatter(data.newObject.x, data.newObject.y, data.newObject.radius, data.newObject.color, data.newObject.maxHealth, data.newObject.health, data.newObject.type, data.id);

            if(changedSpaceMatter)
                worldObjects.spaceMatter[changedSpaceMatter.id] = newSpaceMatter;
            else
                worldObjects.spaceMatter[newSpaceMatter.id] = newSpaceMatter;
        }

    }

    allWorldObjects = getAllWorldObjects();
}
function receiveDamageSync(data){

    for (var i = 0; i < data.deadObjects.length; i++) {
        var localObj = hittableObjects[data.deadObjects[i]];

        if(localObj)
        {
            delete hittableObjects[data.deadObjects[i]];

            var id = data.deadObjects[i].id;
            var structure = allStructures[id];

            if(structure)
            {
                var planetStructure = findObjectWithId(structure.planet.structures, data.deadObjects[i]);
                structure.planet.structures.splice(planetStructure.index, 1);

                if(selectedStructure!= null && selectedStructure.id == structure.id)
                {
                    selectedStructure = null;
                    planetShopSelection = null;
                }

            }
        }
    }

    for (var id in data.hittableObjects) {
        if (data.hittableObjects.hasOwnProperty(id)) {
        
            var hittableObject = data.hittableObjects[id];

            if(hittableObject.health < healthDict[hittableObject.id]){            
                var ownPlanetAttacked = false;
    
                for (var id in ownedPlanets) {
                    if (ownedPlanets.hasOwnProperty(id)) {
                        var ownedPlanet = ownedPlanets[id];

                        if(ownedPlanet.shield && ownedPlanet.shield.id == hittableObject.id)
                            damagedOwnPlanet(true, hittableObject.health, ownedPlanet.shield.id);
                        else if(ownedPlanet.id == hittableObject.id)
                            damagedOwnPlanet(false, hittableObject.health, ownedPlanet.id);
                        }
                }
            }
            
            healthDict[hittableObject.id] = hittableObject.health;
    
            if(clientId != hittableObject.id){
                var localObj = hittableObjects[hittableObject.id];
    
                if(localObj){
                    if(hittableObject.health > 0)
                        hittableObjects[hittableObject.id] = hittableObject;
                    else
                        delete hittableObjects[hittableObject.id];
                }
                else{
                    if(hittableObject.health > 0)
                        hittableObjects[hittableObject.id] = hittableObject;
                }
            }
        }
    }
}

function damagedOwnPlanet(attackOnShield, health, id){

    // if(attackOnShield)
    //     console.log("HALP WE ARE UNDER ATTACK. Shield Health Left: " + health);
    // else
    //     console.log("HALP WE ARE UNDER ATTACK. Health Left: " + health);

    attackedPlanets[id] = true;
}

function showWorld(){

    imageArray.forEach(image => {
        getImage(image);
    });

    if(requestAnimationFrameId){
        location.reload();
    }

    // setInterval(update, UPDATE_RATE);
    animate();
}

function startLocalPlayer(data){

    var player = data.player;
    friendlyObjectIds = [clientId];

    Object.keys(playerStatUpgrades).forEach(key => {
        if(key != "roundToPlace")
            player[key] = playerStatUpgrades[key](player.statLevels[key]).val;
    });

    player.health = player.maxHealth;

    //Spawn client player
    spaceShip = new SpaceShip(centerX, centerY, player.maxHealth, player.health, player.level, player.radius, player.speed, player.turningSpeed, player.fireRate, player.projectileSpeed, player.numUpgrades, clientId);
    spaceShip.shopUpgrades = player.shopUpgrades;

    if(player.statLevels)
        spaceShip.statLevels = player.statLevels;
    
    
    playerItems = {};
    allWorldObjects = getAllWorldObjects();

    if(data.planet)
    {
        var localPlanet = worldObjects.planets[data.planet]

        if(localPlanet)
        {
            currentPlanet = localPlanet;
            closestAvailablePlanet = null;
            landed = false;
            gridPos = new Vector(currentPlanet.coordX * -1, currentPlanet.coordY * -1);
            
            var newOwnedPlanets = {};

            for (var id in ownedPlanets) {
                if (ownedPlanets.hasOwnProperty(id)) {
                    var planet = ownedPlanets[id];

                    planetObject = worldObjects.planets[planet.id];

                    if(planetObject){
                        newOwnedPlanets[planet.id] = planetObject;
                        friendlyObjectIds.push(planetObject.id);

                        if(planetObject.shield)
                            friendlyObjectIds.push(planetObject.shield.id);
                    }
                }
            }

            ownedPlanets = newOwnedPlanets;
        }
    }
    else
        gridPos = new Vector(player.x + gridSize / -2, player.y + gridSize / -2);

}

function newPlayer(data){
    otherPlayers[data.id] = new NetworkSpaceShip(data.x, data.y, data.maxHealth, data.health, data.rotation, data.level, data.radius, data.username, data.id);
}

var respawnCounter = 0;
var respawnInterval;

function respawnPlanet(){
    scale = 1;
    spaceShip = null;
    shopOpen = {shopRef: null, type: null, open: false};
    planetShopSelection = null;

    checklist.aquiredCrown.isActive = false;

    caughtInBlackHole = false;

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();

    $("#respawnPlanetWait").fadeIn();
    $("canvas").css("filter", "blur(5px)");

    respawnCounter = 10;
    respawnTimer();
    respawnInterval = setInterval(respawnTimer, 1000);
}

function respawnTimer(){
    if(respawnCounter > 0)
    {
        $("#respawnTimer").text("Respawning in "+ respawnCounter + " on base");
        respawnCounter--;
    }
    else
    {
        $("#respawnPlanetWait").fadeOut();
        $("canvas").css("filter", "none");

        socket.emit("playerStartGame", {username: username, worldId: worldId});
        clearInterval(respawnInterval);
    }
        
}

function respawn(){
    scale = 1;
    spaceShip = null;
    ownedPlanets = {};
    currentPlanet = null;
    shopOpen = {shopRef: null, type: null, open: false};
    planetShopSelection = null;

    checklist.aquiredCrown.isActive = false;

    caughtInBlackHole = false;

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();

    $("#preGameContent").fadeIn();
    $("canvas").css("filter", "blur(5px)");
    $('#playerNameInput').removeAttr("disabled");
    
}
function updatePlayerPosition(data){

    data.forEach(player => {
        var otherPlayer = otherPlayers[player.id];

        if(otherPlayer){

            otherPlayer.coordX = player.x;
            otherPlayer.coordY = player.y;
            otherPlayer.targetRotation = player.rot;

            if(player.is)
            {
                otherPlayer.rotLerpAmount = 0;
                otherPlayer.rotLerpTime = 0;
                otherPlayer.rotWatcher = otherPlayer.targetRotation;
                otherPlayer.lastRot = otherPlayer.targetRotation;
                otherPlayer.rotation = otherPlayer.targetRotation;
            }
        }
    });
}
function spawnNetworkedProjectile(data){
    otherProjectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, data.bulletPenetration, true, data.id));
}
function destroyNetworkedProjectiles(data){

    data.forEach(proj => {
        
        var deadProjOther = findObjectWithId(otherProjectiles, proj.id);
        var deadProjOwn = findObjectWithId(projectiles, proj.id);
    
        if(deadProjOther)
            otherProjectiles.splice(deadProjOther.index, 1);
        else if(deadProjOwn)
            projectiles.splice(deadProjOwn.index, 1);

    });

    
}
function updatePlanetOccupier(data){
    worldObjects.planets[data.planetId].occupiedBy = data.playerId;
}
function ejectPlayer()
{
    currentPlanet.occupiedBy = null;
    currentPlanet = null;
    landed = false;
}
function spawnNetworkedStructure(data)
{
    planet = worldObjects.planets[data.planetId];

    if(planet)
        planet.addStructure(planet, data.x, data.y, data.rotation, data.type, data.level, data.isFacade, data.ownerId, data.id);

    if(data.ownerId == clientId){
        for (var cost in data.costs) {
            if (data.costs.hasOwnProperty(cost)) {
                playerItems[cost] -= data.costs[cost];
            }
        }
    }

    allStructures = getAllStructures();
}
function returnMsg(data){
    var compiledString = "";

    data.forEach(element => {
        if(typeof element == "number")
            compiledString += " " + element.toString();
        else{
            if(compiledString != "" && element != "S")
                compiledString += " ";

            var text = $('p#' + element).text();

            if(text == "")
                text = element;

            compiledString += text;

        }
    });

    displayMessage(compiledString, 35, 5);
}
function upgradeSync(data) {
    
    var allUpgradeables = Object.assign({}, allPlayers);
    Object.assign(allUpgradeables, allStructures);

    upgradedObject = allUpgradeables[data.id];

    if(upgradedObject)
    {
        if(data.type)
        {
            upgradedObject.statLevels[data.type] = data.level;
            usedUpgrades++;
        }
        else
            upgradedObject.level = data.level;

        for (var property in data.upgrade) {
            if (data.upgrade.hasOwnProperty(property)) {
    
                if(property == "maxHealth" || property == "oxygen"){
    
                    var val = "";
    
                    switch (property)
                    {
                        case "maxHealth":
                            val = "health"
                            break;
                        case "oxygen":
                            val = "oxygenRemaining"
                            break;
                    }
    
                    var precent = upgradedObject[val] / upgradedObject[property];
    
                    upgradedObject[property] = data.upgrade[property];
                    upgradedObject[val] = precent * data.upgrade[property];
                }
                else
                    upgradedObject[property] = data.upgrade[property];
            }
        }
    }

    if(data.playerId == clientId){
        for (var cost in data.costs) {
            if (data.costs.hasOwnProperty(cost) && playerItems[cost]) {
                playerItems[cost] -= data.costs[cost];
            }
        }
    }
}
function shopUpgrade(data){

    var player = allPlayers[data.playerId];
    var isLocalPlayer = data.playerId == clientId;

    if(isLocalPlayer){
        player.shopUpgrades[data.type].value = data.value;
        player.shopUpgrades[data.type].level = data.level;
    
        for (var cost in data.costs) {
            if (data.costs.hasOwnProperty(cost)) {
                playerItems[cost] -= data.costs[cost];
            }
        }
    }

    if(data.type == "shipTurret" && player){
        if(!player.turret)
        {
            var planet = {x: centerX, y: centerY, radius: player.radius};

            player.turret = new Turret(planet, 0, 0, 0, 0, !isLocalPlayer, clientId, data.turretId);
            player.turret.distanceFromPlanet = 0;
            player.turret.headDistanceFromBase = 0;
            player.turret.type = "shipTurret";
        }

        player.turret.level = data.level - 1;
        player.turret.shootInterval = Math.round(75 / Math.sqrt(data.value));
        player.turret.projectileSpeed = Math.round(Math.sqrt(data.value) * 4);
        player.turret.projectileSize = Math.round(Math.sqrt(player.radius) * 2);
    }

    allStructures = getAllStructures();
}
function mineProduce(data){
    var added = {};

    data.forEach(mine => {
        localMine = findObjectWithId(producingMines, mine.id);

        if(localMine)
        {
            localMine.object.productionEffect(mine.item);
        
            if(playerItems[mine.item])
                playerItems[mine.item] += mine.amount;
            else 
            {
                playerItems[mine.item] = mine.amount;
            }

            if(added[mine.item])
                added[mine.item] += mine.amount;
            else 
            {
                added[mine.item] = mine.amount;
            }
        }
    });
    
    for (var item in added) {
        if (added.hasOwnProperty(item)) {
            aquiredItems[item] = {amount: added[item], time: aquireItemsFadeTime};
        }
    }
}

function onAquiredItems(data){
    for (var drop in data.drops) {
        if (data.drops.hasOwnProperty(drop)) {

            if(drop == "crown")
            {
                master.id = clientId;
                if(spaceShip){
                    master.obj = spaceShip;
                    checklist.aquiredCrown.isActive = true;
                }

                ownedPlanets[hiveObj.id] = hiveObj;
            }

            if(playerItems[drop] == undefined)
                playerItems[drop] = 0;

            aquiredItems[drop] = {amount: data.drops[drop] - playerItems[drop], time: aquireItemsFadeTime};
            playerItems[drop] = data.drops[drop];
        }
    } 
}

function updateItems(data){

    var items = data;
    var itemIds = Object.keys(items);

    for (var i = 0; i < itemIds.length; i++) {
        var item = items[itemIds[i]];
        
        var localItem = worldItems[item.id];

        if(item.collected){
            if(localItem)
                delete worldItems[item.id];
            continue;
        }

        if(!localItem)
            localItem = worldItems[item.id] = new Item(item.x, item.y, item.size, item.type, item.id);
        else{
            localItem.coordX = item.x;
            localItem.coordY = item.y;
            localItem.size = item.size;
        }
        
        if(item.iVel)
        {
            localItem.coordChangeWatcher.x = localItem.coordX;
            localItem.coordChangeWatcher.y = localItem.coordY;

            localItem.coordX -= item.iVel.x * 1.5;
            localItem.coordY -= item.iVel.y * 1.5;
            localItem.lerpAmount = 20;
        }

        localItem.targetRotation = item.rot;
    }

}

function turretRot(data)
{
    for (var i = 0; i < data.length; i++) {
        var turret = data[i];

        var localTurret = allStructures[turret.id];

        if(localTurret)
        {
            if(turret.stop)
                localTurret.rotControlled = false;
            else{
                localTurret.rotControlled = true;
                localTurret.targetServerRot = turret.rot;
            }
        }
        
    }
}

function cloak(data){
    var player = allPlayers[data.playerId];
    var hittablePlayer = hittableObjects[data.playerId]

    if(player){

        if(data.cloaked)
        {
            if(clientId != player.id && hittablePlayer)
                hittablePlayer.active = false;
            player.alpha = 0;
        }
        else{
            if(clientId != player.id && hittablePlayer)
                hittablePlayer.active = true;
            player.alpha = 1;
            
            if(clientId == player.id)
                cloaked = false;
        }
    }
}

function setMaster(data)
{
    master.id = data;

    if(data != null)
        master.obj = allPlayers[data];
    else 
        master.obj = null;   
}

function playerExited(data){

    var otherPlayer = otherPlayers[data.clientId];

    if(otherPlayer){
        for (var [planetId] in  worldObjects.planets) {
            if ( worldObjects.planets.hasOwnProperty(planetId)) {
                var planet = worldObjects.planets;

                if(planet.occupiedBy == data.clientId)
                    planet.occupiedBy = null;
            }
        }

        delete otherPlayers[data.clientId];

        var otherPlayerHittableObj = hittableObjects[data.clientId];

        if(otherPlayerHittableObj)
            delete hittableObjects[data.clientId];
    }

    if(data.structureIds)
    {
        data.structureIds.forEach(id => {

            var localStructure = allStructures[id];

            if(localStructure)
            {
                var planet = worldObjects.planets[localStructure.planet.id];

                if(planet)
                {
                    planet.owner = null;
                    planetStructure = findObjectWithId(planet.structures, localStructure.id);
    
                    if(planetStructure)
                        planet.structures.splice(planetStructure.index, 1);
                }
            }
            
        });

        allStructures = getAllStructures();
    }
}
function forceDisconnect(data){
    location.reload();
} 

//Send Data Functions
function sendPlayerPosition(pos, rotation){
    var data = {
        x: Math.round(pos.x * 10) / 10, 
        y: Math.round(pos.y * 10) / 10,
        rot: Math.round(rotation * 100) / 100,
        worldId: worldId
    }

    socket.emit('playerPos', data);
}
function sendProjectile(x, y, vel, size, color, id, shooterId, damagePercent){
    var data = {
        x: Math.round(x * 10) / 10, 
        y: Math.round(y * 10) / 10,
        vel: vel,
        size: size,
        color: color,
        id: id,
        shooterId: shooterId,
        percentDamage: Math.round(Math.floor(damagePercent * 10) * 100) / 1000,
        worldId: worldId
    }

    socket.emit('spawnProj', data);
}
function sendProjectileHit(projectileId, subjectId, hitX, hitY, ignoreShield = false){
    var data = {
        id: subjectId,
        projectileId: projectileId,
        hitX: Math.round(hitX),
        hitY: Math.round(hitY),
        worldId: worldId,
        ignoreShield: ignoreShield
    }

    socket.emit('projectileHit', data);
}

//Events
window.addEventListener('mousemove', 
    function(event){
    mouse.x = event.x / scale;
    mouse.y = event.y / scale;
})

window.addEventListener('mousedown', 
    function(event){
        mouse.clickDown = true;
        mouse.clicked = true;
       
        if(newsDisplayed)
        {
            $("#mainContent").css("filter", "none");
            $("#news").fadeOut(250);

            newsDisplayed = false;
        }

        if(spaceShip)
            checklist.fly.done = true;
})

window.addEventListener('mouseup', 
    function(event){
        mouse.clicked = false;
});

window.addEventListener('resize', 
    function(event){

    windowWidth =  $(window).width();
    windowHeight =  $(window).height();

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can)) {
            canvases[can].width = window.innerWidth;
            canvases[can].height = window.innerHeight;
        }
    }

    centerX = (window.innerWidth / 2 / scale);
    centerY = (window.innerHeight / 2 / scale);
});

$('#playerNameInput').on('keypress', function (e) {
    if(e.which == 13){

        startGame();
       //Disable textbox to prevent multiple submit
       $(this).attr("disabled", "disabled");
    }
});

$("#startGame").click(function(){
    startGame();
});

function startGame(){

    if($("#playerNameInput").val() != ""){
        username = $("#playerNameInput").val().toString();
        username = username.slice(0, 15);
    }
    else
    {
        var div = $('#playerNameInput');
        $({alpha:1}).animate({alpha:0}, {
            duration: 1000,
            step: function(){
                div.css('border-color','rgba(255,177,177,'+this.alpha+')');
            }
        });
        return;
    }


    //$(".bottomAd").toggleClass('lowered', 2);

    socket.emit("playerStartGame", {username: username, worldId: worldId});

    $("#preGameContent").fadeOut();
    $("canvas").css("filter", "none");
}

$("#help").click(function(){
    $("#mainContent").fadeOut(250);
    $("#helpContent").fadeIn(250);
});

$("#aboutButton").click(function(){
    $("#mainContent").fadeOut(250);
    $("#aboutContent").fadeIn(250);
});

$("#backHelp").click(function(){
    $("#mainContent").fadeIn(250);
    $("#helpContent").fadeOut(250);
});


$("#backAbout").click(function(){
    $("#mainContent").fadeIn(250);
    $("#aboutContent").fadeOut(250);
});

$(document).ready(function() {

    $("#playerNameInput").attr("placeholder", $("#name").text());
    $("#mainContent").fadeIn(0);
    $("#helpContent").fadeOut(0);
    $("#aboutContent").fadeOut(0);
    $("#helpContent").css('display', '');
    $("#aboutContent").css('display', '');
    $("#respawnPlanetWait").fadeOut(0);
    $("#respawnPlanetWait").css('display', '');

    if(DISPLAY_NEWS)
    {
        $("#mainContent").css("filter", "blur(5px)");
        $("#news").fadeIn(0);
    }
    else{
        $("#news").fadeOut(0);
    }
});

$(document).keyup(function(e){

    if(e.keyCode == 32){ //SPACE
        isHoldingShoot = false;
    }
});

$(document).keypress(function(e){

    if(boughtStructure != null)
        return;

    if(currentPlanet && spaceShip){

        if(currentPlanet.id != "hive")
        {
            if(e.keyCode == 104 || e.keyCode == 72) // H
            {
                if(currentPlanet.health < currentPlanet.maxHealth)
                    socket.emit("heal", {id: currentPlanet.id, worldId: worldId});
                else
                    socket.emit("heal", {id: clientId, worldId: worldId});
            }
    
            if(structureSpawnPoint(50 * scale))
            {
                switch (e.keyCode)
                {
                    case 108 : // l
                    case 76 : // L
                        requestStructureSpawn("landingPad");
                        break;
                    case 115: // s
                        requestStructureSpawn("shield");
                        break;
                    case 83: // S
                        requestStructureSpawn("satellite");
                        break;
                    case 109: // m
                    case 77: // M
                        requestStructureSpawn("mine");
                        break;
                    case 116: // t
                    case 84: // T
                        requestStructureSpawn("turret");
                        break;
                    case 101: // e
                    case 69: // E
                        requestStructureSpawn("electricity");
                        break;
                    case 113: // q
                    case 81: // Q
                        requestStructureSpawn("satellite");
                        break;
                }
            }
        }

        if(e.keyCode == 32){ //SPACE
            socket.emit('planetOccupancy', {planetId: currentPlanet.id, playerId: null, worldId: worldId})

            currentPlanet.occupiedBy = null;
                
            turretManualMode = false;

            landed = false;
            currentPlanet = null;
            planetShopSelection = null;

            checklist.landingPadDesc.isActive = false;

        }
    }
    else if(spaceShip){
        if(e.keyCode == 99 || e.keyCode == 67 && !cloaked && cloakCoolDownTime >= cloakCoolDown) //C
        {
            if(spaceShip.shopUpgrades["cloakTime"].level > 0){
                spaceShip.alpha = .1;

                cloakTime = 0;
                cloaked = true;
                cloakCoolDownTime = 0;
                
                var data = 
                {
                    worldId: worldId
                }

                socket.emit("cloak", data);
            }
            else
                displayMessage("Purchase cloak ability at shop first", 10, 2);
        }

        if(e.keyCode == 104 || e.keyCode == 72) // H
            socket.emit("heal", {id: clientId, worldId: worldId});

        if(e.keyCode == 32){ //SPACE
            
            checklist.shoot.done = true;

            if(shootCooldownTimer >= shootCooldownTime){

                var shootBullet = false;

                if(isHoldingShoot)
                {
                    if(playerReloadTimer <=0)
                        shootBullet = true;
                }
                else {
                    shootBullet = true;
                }

                if(shootBullet)
                {
                    var damagePercent = 1 - playerReloadTimer / spaceShip.fireRate;
                    shoot(-gridPos.x, -gridPos.y, spaceShip.rotation, spaceShip.projectileSpeed, Math.sqrt(spaceShip.radius) * damagePercent, spaceShip.shopUpgrades.bulletPenetration.value + 1, "#f45c42", clientId, damagePercent);
                    shootCooldownTimer = 0;
                    playerReloadTimer = spaceShip.fireRate;
                }
            }
            

            isHoldingShoot = true;
            
        } 
        if((e.keyCode == 106 || e.keyCode == 74) && closestAvailablePlanet != null){ // J

            socket.emit('planetOccupancy', {planetId: closestAvailablePlanet.id, playerId: clientId, worldId: worldId})

            currentPlanet = closestAvailablePlanet;
            currentPlanet.occupiedBy = clientId;
            closestAvailablePlanet = null;

            if(currentPlanet.id == "hive" && checklist.aquiredCrown.isActive)
                checklist.aquiredCrown.done = true;

            if(playerHasResources(structureUpgrades["landingPad"][0].costs) && !ownedPlanets[currentPlanet.id] && !checklist.landingPadDesc.done && !currentPlanet.id == "hive")
                checklist.landingPadDesc.isActive = true;

        } 
    }
    
    if(e.keyCode == 59) // ;
        statsView = !statsView; 
});
$(document).on('keydown', function(e){
    
    if(spaceShip){

        if(shopOpen)
        {
            if(e.keyCode == 27){ // Escape
                shopOpen.open = false;
                boughtStructure = null;
            }
        }

        if(e.keyCode == 83 || e.keyCode == 115 && !currentPlanet){ // S

            if(!shopOpen.open){
                var shopInRange = false;

                var shopIds = Object.keys(worldObjects.shops);
                shopIds.forEach(shopId => {
                    var shop = worldObjects.shops[shopId];
    
                    if(shop.isInRange){
                        shopOpen.type = shop.upgradeType;
                        shopOpen.shopRef = shop;
                        shopOpen.open = true;
                        shopInRange = true;
                    }
    
                });
    
                if(!shopInRange)
                {
                    displayMessage("No shops in range", 10, 2);
                }
            }
            else
                shopOpen.open = false;
        }

        if(spaceShip.shopUpgrades["boost"].level > 0){
            if(boostReady)
                boost = e.shiftKey
        }
        else{
            if(e.shiftKey)
                displayMessage("Purchase boost ability at shop first", 10, 2);
        }
    }

});

$(document).on('keyup', function(e){
    if(boost && spaceShip){
        boost = e.shiftKey;
    }
});

function requestStructureSpawn(type, enemyType){

    var globalPos;

    if(structureSpawnPosition != null)
        globalPos = screenPosToCords(structureSpawnPosition.x, structureSpawnPosition.y);
    else
        globalPos = screenPosToCords(-1908129038, 102839);

    var spawnData = {
        planetId: currentPlanet.id,
        x: globalPos.x, 
        y: globalPos.y,
        rotation: structureSpawnRotation,
        type: type,
        ownerId: clientId,
        isFacade: false,
        enemyType: enemyType,
        worldId: worldId
    }

    socket.emit("requestSpawnStructure", spawnData);
}


var time = 0;
var isScaling = true;


function update() {

    canvas.width = innerWidth;
    canvas.height = innerHeight;

    windowWidth =  $(window).width();
    windowHeight =  $(window).height();

    if(scale != targetScale) {

        if(!isScaling){
            time = 0;
            isScaling = true;
        }

        if (time < scaleTime)
        {
            scale = (targetScale - scale) * Math.pow(time, scaleSpeed) / (Math.pow(scaleTime, scaleSpeed) + Math.pow(time, scaleSpeed)) + scale;
            time++;
        }
        else
        {
            scale = targetScale
            isScaling = false;
        }
    }
    
    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);  
    
    allPlayers = Object.assign({}, otherPlayers);

    if(spaceShip)
        allPlayers[spaceShip.id] = spaceShip;


    for (var id in otherPlayers) {
        if (otherPlayers.hasOwnProperty(id)) {

            var player = otherPlayers[id];
            player.health = healthDict[player.id];

            if(hittableObjects[player.id])
            {
                if(player.displayPos && player.displayPos.x && player.displayPos.y)
                { 
                    hittableObjects[player.id].x = player.displayPos.x;
                    hittableObjects[player.id].y = player.displayPos.y;
                }
                else if(player.coordX && player.coordY){
                    hittableObjects[player.id].x = player.coordX;
                    hittableObjects[player.id].y = player.coordY;
                }
            }

            player.update();
        }
    }
    
    if(spaceShip){        

        var mousePullxTarget = 0;
        var mousePullyTarget = 0;

        if(currentPlanet){
            spaceShip.speed = 10;

            mousePullx = 0;
            mousePully = 0;

            a = centerX - currentPlanet.x;
            b = centerY - currentPlanet.y;
            var distance = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));

            if(spaceshipVelocity.getMagnitude() < .2 && distance < 2)
            {
                var satelliteAddedRange = 0;

                if(currentPlanet.powered)
                {
                    currentPlanet.structures.forEach(structure => {
                        if(structure.type == "satellite")
                            satelliteAddedRange += structure.range;
                    });
                }

                landed = true;
                targetScale = (250 - satelliteAddedRange) / currentPlanet.radius;
                mousePullxTarget = 0;
                mousePullxTarget = 0;
            }
            else if(!landed){
                mousePullxTarget = currentPlanet.x - centerX;
                mousePullyTarget = currentPlanet.y - centerY;
            }
        }
        else if(!shopOpen.open) {
            targetScale = 50 / spaceShip.radius;

            if(mouse.clicked || boost){
                if(boost)
                    spaceShip.speed = spaceShip.shopUpgrades["boost"].value + playerStatUpgrades["speed"](spaceShip.statLevels.speed).val;
                else
                    spaceShip.speed = playerStatUpgrades["speed"](spaceShip.statLevels.speed).val;


                var dirrectionX = Math.cos(spaceShip.rotation - Math.PI / 2) * spaceShip.speed / 100;
                var dirrectionY = Math.sin(spaceShip.rotation - Math.PI / 2) * spaceShip.speed / 100;

                mousePullxTarget = dirrectionX;
                mousePullyTarget = dirrectionY;
            }
        }
        
        var stepFactorX = mousePullxTarget - mousePullx / SPACESHIP_DECELERATION_TIME;
        var stepFactorY = mousePullyTarget - mousePully / SPACESHIP_DECELERATION_TIME;

        mousePullx += stepFactorX;
        mousePully += stepFactorY;

        forceVector = new Vector(mousePullx, mousePully);

        if(forceVector.getMagnitude() > spaceShip.speed){
            forceVector.setMagnitude(spaceShip.speed);
        }
        
        mousePullx = forceVector.x;
        mousePully = forceVector.y;

        spaceshipVelocity = isNaN(mousePullx + mousePully) 
            ? new Vector()
            : new Vector(mousePullx, mousePully);

        var matterIds = Object.keys(worldObjects.spaceMatter);
        matterIds.forEach(function(matterId){

            spaceMatter = worldObjects.spaceMatter[matterId];

            if(spaceMatter.type == "blackHole" && !currentPlanet)
            {
                var pos = cordsToScreenPos(spaceMatter.coordX, spaceMatter.coordY);

                var x = pos.x - centerX;
                var y = pos.y - centerY;

                holeDist = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)); 

                if(holeDist <= MAX_GRAVITATIONAL_DISTACNE){
                    var holeScaleFactor = Math.pow(Math.pow(holeDist / MAX_GRAVITATIONAL_DISTACNE, -2), 1.2) / 3000 * spaceShip.radius / 15; //(1 - holeDist / MAX_GRAVITATIONAL_DISTACNE) * BLCAKHOLE_GRAVITY * spaceMatter.radius / 100; //Math.pow((1 - holeDist / MAX_GRAVITATIONAL_DISTACNE) * BLCAKHOLE_GRAVITY, BLCAKHOLE_GRAVITY);

                    if(holeScaleFactor > 1)
                        holeScaleFactor = 1;

                    if(!caughtInBlackHole)
                    {
                        if(holeScaleFactor > 0){
                            spaceshipVelocity.x += x * holeScaleFactor;
                            spaceshipVelocity.y += y * holeScaleFactor;
                        }
                    }
                    else if(holeScaleFactor > 0)
                    {
                        spaceshipVelocity.x = x * holeScaleFactor;
                        spaceshipVelocity.y = y * holeScaleFactor;
                    }
                    
                    if(holeDist < 10)
                    {
                        caughtInBlackHole = true;
                    }
                }   
            }
        });

        var spaceShipCoords = screenPosToCords(centerX, centerY);

        spaceShip.coordX = spaceShipCoords.x; //(gridPos.x + gridSize / 2) * -1;
        spaceShip.coordY = spaceShipCoords.y; //gridPos.y + gridSize / 2;
    
        //Screen Bounds

        //Left 
        if(spaceShip.coordX <= 0 && spaceshipVelocity.x < 0){
            spaceshipVelocity.x = 0;
        }
        //Right 
        if(spaceShip.coordX >= gridSize && spaceshipVelocity.x > 0){
            spaceshipVelocity.x = 0;
        }
        //Top 
        if(spaceShip.coordY <= 0 && spaceshipVelocity.y < 0){
            spaceshipVelocity.y = 0;
        }
        //Bottom 
        if(spaceShip.coordY >= gridSize && spaceshipVelocity.y > 0){
            spaceshipVelocity.y = 0;
        }
        
        gridPos.x -= spaceshipVelocity.x;
        gridPos.y -= spaceshipVelocity.y;

        if(positionSendTime >= POSITION_SEND_DELAY)
        {
            positionSendTime = 0;
            var playerPos = new Vector(-gridPos.x, -gridPos.y);

            if(playerPos.x != lastPlayerPos.x || playerPos.y != lastPlayerPos.y || Math.round(lastPlayerRot * 10) / 10 != Math.round(spaceShip.rotation * 10) / 10)
            {
                sendPlayerPosition(playerPos, spaceShip.rotation);
                lastPlayerPos = playerPos;
                lastPlayerRot = spaceShip.rotation;
            }
        }
        else{
            positionSendTime++;
        }

        // --------------------------------- Properties Overview    
        if(propertiesTimer.matter && propertiesTimer.time >= propertiesHoldTime && propertiesTimer.fill < 1)
            propertiesTimer.fill += .05;
        // --------------------------------- In Sun
        
        var isInSun = false;
        matterIds.forEach(function(matterId){

            spaceMatter = worldObjects.spaceMatter[matterId];
            
            if(spaceMatter.type == "sun"){

                var pos = cordsToScreenPos(spaceMatter.coordX, spaceMatter.coordY);

                if(spaceShip){
                    var sun = {x: pos.x, y: pos.y, radius: spaceMatter.radius} 
                    var player = {pos: {x: centerX, y: centerY}, radius: spaceShip.radius} 

                    if(isCollidingCircles(player, sun)){
                        isInSun = true;
                        sunTint.color = spaceMatter.color;
                    }
                }

            }
        });    
            
        if(isInSun){
            if(sunTint.amount < .75)
                sunTint.amount += .01;
        }
        else{
            if(sunTint.amount > 0)
                sunTint.amount -= .02;
        }

        // --------------------------------- Boost & Cloak

        if(cloaked && cloakTime < spaceShip.shopUpgrades.cloakTime.value)
            cloakTime += 16;
        else if(cloakCoolDownTime < cloakCoolDown)
            cloakCoolDownTime++;

        boostLength = spaceShip.shopUpgrades.boost.value;
        boostRechargeLegnth = spaceShip.shopUpgrades.boost.value * 6;

        if(boostReady && boostAmount <= boostLength && boost)
        {
            if(boostAmount > 0)
                boostAmount--;
            else{
                boostReady = false;
                boost = false;
                boostAmount = 0;
            }
        }
        else if (boostRechargeLegnth > 0 && !boostReady){
            if(boostAmount < boostRechargeLegnth)
                boostAmount++;
            else{
                boostAmount = boostLength;
                boostReady = true;
            }
        }

        // --------------------------------- Other

        for (var changed in colorChangedHitObjects) {
            if (colorChangedHitObjects.hasOwnProperty(changed)) {
               
                var worldObject = findObjectWithId(allWorldObjects, changed);
    
                if(worldObject && worldObject.object.type != "scrapmetal")
                {
                    if(colorChangedHitObjects[changed].time > 0)
                    {
                        worldObject.object.color = shadeColorHex(colorChangedHitObjects[changed].color, colorChangedHitObjects[changed].time);
                        colorChangedHitObjects[changed].time--;
                    }
                    else
                    {
                        worldObject.object.color = colorChangedHitObjects[changed].color;
                        delete colorChangedHitObjects[changed];
                    }
                }
            }
        }

        if(playerDisplayMessage != ""){
            if(playerMessageTimer > 0)
                playerMessageTimer -= 1;
            else if(playerMessageAlpha > 0)
                playerMessageAlpha -= playerMessageFadeSpeed / 100;
            else
                playerDisplayMessage = "";
    
            if(playerMessageAlpha < 0)
                playerMessageAlpha= 0;
        }

        if(shootCooldownTimer < shootCooldownTime)
            shootCooldownTimer++;

        if(playerReloadTimer > 0)
            playerReloadTimer -= 1;

        for(var i = 0; i < allStructures.length; i++){
            if(allStructures[i].health != healthDict[allStructures[i].id])
                allStructures[i].health = healthDict[allStructures[i].id];
        }

        if(!currentPlanet)
            closestAvailablePlanet = findClosestUnoccupiedPlanet();

    }
    else{

        var opacity = $("#vignetteOverlay").css("opacity");

        if(opacity > 0){
            opacity -= .2;
            $("#vignetteOverlay").css("opacity", opacity);
        }

        targetScale = startScale;
        
        spaceshipVelocity.x = 0;
        spaceshipVelocity.y = 0;
    }
    
    if(caughtInBlackHole && spaceShip)
    {
        if(spaceShip.radius > 1)
        {
            spaceShip.radius -= 1;
        }
        else{
            socket.emit("blackHoleDeath", {worldId: worldId});
        }
    }

    var planets = Object.assign({}, ownedPlanets);

    if(closestAvailablePlanet)
    {
        var tempObj = {};
        tempObj[closestAvailablePlanet.id] = closestAvailablePlanet;
        Object.assign(planets, tempObj);
    }
        
    for (var id in planets) {
        if (planets.hasOwnProperty(id)) {

            var planet = planets[id];
            var size = planet.radius;

            if(planet.shield)
                size = planet.shield.radius;

            var pos = cordsToScreenPos(planet.coordX, planet.coordY);

            if(!isOnScreen(pos.x, pos.y, size))
            {
                planet.x = pos.x;
                planet.y = pos.y;
            }
                
        }
    }

    miniMapSize = windowHeight / 5;
    minimapPadding = windowHeight / 60;

}

//------------------------------------------------------- ANIMATE ------------------------------------------------------

function animate() { 
    update();

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can)) {
            canvases[can].getContext('2d').clearRect(0, 0, innerWidth, innerHeight);
        }
    }

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can)) {
            canvases[can].getContext('2d').scale(scale, scale);
        }
    }

    drawGrid(gridPos.x + centerX, gridPos.y + centerY, gridSize, gridSize, gridBoxScale);
    updateAllMatter();

    //console.log("Call to doSomething took " + (Math.round((averageTime)*100) / 100) + " milliseconds.");
    
    for (var id in otherPlayers) {
        if (otherPlayers.hasOwnProperty(id)) {
            if(isOnScreen(otherPlayers[id].x, otherPlayers[id].y, otherPlayers[id].radius))
                otherPlayers[id].draw();
        }
    }

    if(statsView)  // Draw circles to show hitboxes && display coords
    {
        c.font = "20px Arial";

        for (var id in hittableObjects) {
            if (hittableObjects.hasOwnProperty(id)) {
    
                var obj = hittableObjects[id];
    
                if(obj.radius && obj.active){
                    var pos = cordsToScreenPos(obj.x, obj.y);
    
                    if(isOnScreen(pos.x, pos.y, obj.radius)){
                        c.beginPath();
                        c.arc(pos.x, pos.y, obj.radius, 0, Math.PI * 2, false);
                        c.lineWidth = 2;
                        c.strokeStyle = "#f44242";
                        c.stroke();
                    }
                }
            }
        }
    }

    for(var i = projectiles.length - 1; i >= 0; i--){
        var projectile = projectiles[i];

        projectile.pos.x -= spaceshipVelocity.x;
        projectile.pos.y -= spaceshipVelocity.y;

        projectile.update();

        if(projectile.hitsLeft <= 0)
            projectiles.splice(i, 1);
    }

    //NetworkedProjectiles
    for(var i = 0; i < otherProjectiles.length; i++){
        proj = otherProjectiles[i];
        proj.pos.x -= spaceshipVelocity.x;
        proj.pos.y -= spaceshipVelocity.y;
        proj.update();
    }

    if(spaceShip && !jQuery.isEmptyObject(ownedPlanets)){
        drawArrowsToOwnedPlanets();
    }

    for (var item in worldItems) {
        if (worldItems.hasOwnProperty(item)) {
            worldItems[item].update();
        }
    }

    c.scale(1 / scale, 1 / scale);

    if(statsView && spaceShip)
    {
        c.fillStyle = "#ffffff";
        c.fillText("x: " + Math.round(spaceShip.coordX) + " y: " + Math.round(spaceShip.coordY), 5, canvas.height - 5);
    }

    if(sunTint.amount > 0){
        c.globalAlpha = sunTint.amount;
        c.fillStyle = sunTint.color;
        c.fillRect(0, 0, canvas.width * scale * 100, canvas.height * scale * 100);
        c.globalAlpha = 1;
    }

    if(shopOpen.open && spaceShip)
    {
        if(isCollidingCircles({pos: {x: centerX, y: centerY}, radius: spaceShip.radius}, shopOpen.shopRef))
            drawShopPanel(shopOpen.type);
        else
            shopOpen.open = false;
    }
    else{
        shopUpgradeButtonClicked = false;
    }

    //Display Stats
    if(spaceShip){

        drawLeaderBoard();

        // if(!currentPlanet)
        //     drawOxygen();

        if(currentPlanet)
        {
            checklist.shoot.isActive = false;
            checklist.fly.isActive = false;
        }
        else
        {
            checklist.shoot.isActive = true;
            checklist.fly.isActive = true;
        }

        drawChecklist();

        if(spaceShip.health > 0){
            var xPadding = 10;
            var yPadding = 10;

            displayBar(xPadding, yPadding, windowHeight / 3.4, 50, spaceShip.health / spaceShip.maxHealth, "#36a52c");
            c.fillStyle = "white";
            displayResources();
            c.font = windowHeight / 40 + "px Helvetica";
            c.fillText(Math.round(spaceShip.health)+  "/" + Math.round(spaceShip.maxHealth), xPadding + 10, yPadding + 35);  
        }
    
        if(playerDisplayMessage != ""){
            c.globalAlpha = playerMessageAlpha;
            c.font = "50px Helvetica";
            c.fillStyle = "White";
            c.textAlign = "center";
            c.fillText(playerDisplayMessage, canvas.width/2, canvas.height/2); 
            c.globalAlpha = 1;
            c.textAlign = "left";
        }

        //Shop and Landing Text ---------------------------------------------------
        if(!currentPlanet && closestAvailablePlanet){

            var shopInRange = false;

            var shopIds = Object.keys(worldObjects.shops);
            shopIds.forEach(shopId => {
                var shop = worldObjects.shops[shopId];

                if(shop.isInRange)
                    shopInRange = true;
            });

            if(!shopInRange)
            {
                c.font =  windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('p#land').text(), windowWidth / 2, infoPosY());
                c.textAlign="left"; 
    
                c.globalAlpha = .5;
                c.beginPath();
                c.setLineDash([10, 30]);
                c.moveTo(windowWidth / 2, windowHeight / 2);
                c.strokeStyle = "gray";
                c.lineWidth = 10;  
                c.lineTo(closestAvailablePlanet.x * scale, closestAvailablePlanet.y * scale);
                c.stroke();
        
                c.setLineDash([]);
                c.globalAlpha = 1;
            }
        }
        
        //Planet Structure Placement -----------------------------------------------
        if(currentPlanet){
            if(boughtStructure != null)
            {
                var addedDist = 0;
                var structureImage = boughtStructure;

                if(boughtStructure == "satellite")
                    addedDist = new Satellite().distance - new Satellite().size / 2;
                else if(boughtStructure == "shield")
                    structureImage = "shieldGenerator"

                if(structureSpawnPoint(50 * scale, structureImage + "0", addedDist)){
                    if(mouse.clickDown)
                    {
                        var spawnerType = "nope";

                        if(boughtStructure.substring(0, 7) == "spawner")
                        {
                            spawnerType = (boughtStructure.substring(7, boughtStructure.legnth));
                            spawnerType = spawnerType.charAt(0).toLowerCase() + spawnerType.substring(1, spawnerType.legnth);
                        }
                        
                        requestStructureSpawn(boughtStructure, spawnerType);
                        boughtStructure = null;

                        structureSpawnPosition = null;
                        structureSpawnRotation = null;
                    }
                }
            }
            else
                drawPlanetShopPanel();

            if(boughtStructure)
            {
                c.font = windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('p#placeStructue').text() + boughtStructure, windowWidth / 2, infoPosY());
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
            else{
                c.font = windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('p#takeOff').text(), windowWidth / 2, infoPosY());
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
        }

        minimap(miniMapSize, windowWidth - miniMapSize - minimapPadding, windowHeight - miniMapSize - minimapPadding);

        var cloakedBarDisplayed = false;
        var dbWidth = canvas.width / 3;
        
        if(cloaked)
        {
            cloakedBarDisplayed = true;
            displayBar(centerX * scale - dbWidth / 2, 10, dbWidth, 20, (spaceShip.shopUpgrades.cloakTime.value - cloakTime) / spaceShip.shopUpgrades.cloakTime.value, "#77e3ff");
        }
        else if(cloakCoolDownTime < cloakCoolDown){
            cloakedBarDisplayed = true;
            displayBar(centerX * scale - dbWidth / 2, 10, dbWidth, 20, cloakCoolDownTime / cloakCoolDown, "#2fc4a8");
        }

        var boostBarY = 10;

        if(cloakedBarDisplayed)
            boostBarY = 40;

        if(boostReady && boostAmount <= boostLength && boostLength != boostAmount)
            displayBar(centerX * scale - dbWidth / 2, boostBarY, dbWidth, 20, boostAmount / boostLength, "#f9dd6b");
        else if (boostRechargeLegnth > 0 && !boostReady)
            displayBar(centerX * scale - dbWidth / 2, boostBarY, dbWidth, 20, boostAmount / boostRechargeLegnth, "#937f2a");


        if(!currentPlanet){
            var width = canvas.width / 5;
            var ypos = $(window).height() - $(window).height() / 7;
            displayBar(centerX * scale - width / 2, ypos, width, 20, (spaceShip.fireRate - playerReloadTimer) / spaceShip.fireRate, "#ff5a51");
        }

    }

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can) && can != "mainCanvas") {
            canvases[can].getContext('2d').scale(1 / scale, 1 / scale);
        }
    }

    if(mouse.clickDown)
        mouse.clickDown = false;

    requestAnimationFrameId = requestAnimationFrame(animate);
}

function displayMessage(text, timeToFade, fadeSpeed){
    playerDisplayMessage = text
    playerMessageAlpha = 1;
    playerMessageFadeSpeed = fadeSpeed;
    playerMessageTimer = timeToFade;
}

function drawLeaderBoard(){
    var width = windowHeight * .22;
    var height = windowHeight / 4;
    var padding = windowHeight / 65;

    var PLAYERS_ON_BOARD = 5;

    c.globalAlpha = .75;

    c.textAlign = "center";
    c.font = height / 10 + "px Helvetica";
    c.fillStyle = "white";
    c.fillText($('p#leaderboard').text(), windowWidth - width / 2 - padding, padding * 2.8);
    c.textAlign = "left";

    c.globalAlpha = .25;
    c.fillStyle = "#898989";


    c.fillRect(windowWidth - width - padding, padding, width, height);

    var playerY = padding * 4.5;

    c.font = height / 15 + "px Helvetica";
    c.globalAlpha = .75;

    var IMAGE_SIZE =  windowHeight / 35;
    var topPlayers = [];

    for (var id in allPlayers) {
        if (allPlayers.hasOwnProperty(id)) {

            var player = allPlayers[id];

            if(player.id != master.id && player.id.substring(0,5) != "enemy")
                topPlayers.push(player);
        }
    }

    topPlayers.sort(function (player1, player2) {
        if (player1.level > player2.level) return -1;
	    if (player1.level < player2.level) return 1;
    });

    if(master.obj)
        topPlayers.unshift(master.obj);

    var playerIndex = topPlayers.indexOf(spaceShip);

    topPlayers = topPlayers.slice(0, PLAYERS_ON_BOARD);

    if(!topPlayers.includes(spaceShip))
        topPlayers.push(spaceShip);

    for (var i = 0; i < topPlayers.length; i++) {
        var player = topPlayers[i];
        
        if(i >= PLAYERS_ON_BOARD)
        {
            playerY = height + padding * 3.6;

            c.globalAlpha = .25;
            c.fillStyle = "#898989";
            c.fillRect(windowWidth - width - padding, height + padding * 2, width, height / 5);
            c.globalAlpha = 1;
        }

        var name;
        var index = i;

        if(player == spaceShip)
        {
            index = playerIndex;
            name = username;
        }
        else
            name = player.username;

        c.save();
        c.translate(windowWidth - width + padding * 1.9 + IMAGE_SIZE / 2, playerY);
        c.rotate(Math.PI/2);
        c.drawImage(getImage("spaceShip" + player.level), IMAGE_SIZE / -2, IMAGE_SIZE / -2, IMAGE_SIZE, IMAGE_SIZE);
        c.restore();

        if(player == spaceShip)
            c.globalAlpha = 1;
        else 
            c.globalAlpha = .5;


        c.fillStyle = "#e0ecff";

        if(player.id == master.id)
            c.drawImage(getImage("crown"), windowWidth - width + padding / 4 + IMAGE_SIZE / -2, playerY + IMAGE_SIZE / -2, IMAGE_SIZE, IMAGE_SIZE);
        else
            c.fillText(index + 1 + ")", windowWidth - width, playerY);
        
        c.fillText(name, windowWidth - width + padding * 2 + IMAGE_SIZE, playerY);
        playerY += IMAGE_SIZE + padding;
        
        c.globalAlpha = 1;
    }
    
    c.globalAlpha = 1;
}

function drawShopPanel(type){

    var width = windowWidth / 1.5;
    var height = windowHeight / 1.5;
    
    var currentLevel = spaceShip.shopUpgrades[type].level;
    var imageSize = height / 3;

    var label;

    var costSize = height / 15;
    var costPadding = height / 25;

    //Background pane
    c.globalAlpha = .5;
    c.fillStyle = "#516689";
    c.strokeStyle = "#516689";
    c.fillRect((windowWidth - width) / 2, (windowHeight - height) / 2, width, height);
    
    c.strokeRect((windowWidth - width) / 2, (windowHeight - height) / 2, width, height);
    
    var padding = imageSize / 10;
    var imageY = (windowHeight - height) / 2 + (height * .35) - imageSize / 2;

    c.globalAlpha = .9;

    //Name
    var name = "";
    var description = "";

    switch (type) {
        case "bulletPenetration":
            name = $('p#bulletPenetration').text();
            description = $('p#bulletPenetrationDescription').text();
        break;
        case "boost":
            name = $('p#boost').text();
            description = $('p#boostDescription').text();
        break;
        case "cloakTime":
            name = $('p#cloakTime').text();
            description = $('p#cloakTimeDescription').text();
        break;
        case "shipTurret":
            name = $('p#shipTurret').text();
            description = $('p#shipTurretDescription').text();
        break;
    }

    c.font = height / 20 + "px Helvetica";
    c.textAlign = "center";
    c.fillStyle = "white";
    c.fillText(name, windowWidth / 2, (windowHeight - height) / 2 + height * .1);
    c.textAlign = "left";

    c.fillStyle = "#5784ba";
    var descriptionBoxX = windowWidth - ((windowWidth - width) / 2) - costPadding - width / 4;
    var descriptionBoxY = (windowHeight - height) / 2 + (height * .65) - costPadding;

    c.fillRect(descriptionBoxX, descriptionBoxY, width / 4, height / 2.8);
    c.fillStyle = "white";
    wrapText(c, description, descriptionBoxX + costPadding / 2, descriptionBoxY + height / 20 + costPadding / 2, width / 4 - costPadding, height / 20);

    c.fillStyle = "#516689";

    //Image(s)
    if(currentLevel + 1 >= shopUpgrades[type].length)
    {
        c.fillRect(windowWidth / 2 - imageSize / 2 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
        c.drawImage(getImage(type + (currentLevel - 1)), windowWidth / 2 - imageSize / 2, imageY, imageSize, imageSize);

        var textWidth = height / 5;

        c.font = height / 40 + "px Helvetica";
        c.textAlign = "center";
        c.fillStyle = "white";
        c.fillText($('p#fullyUpgraded').text(), windowWidth / 2, (windowHeight - height) / 2 + height * .8);
        c.textAlign = "left";
    }
    else{
        if(currentLevel > 0){

            var arrowSize = height / 20;

            label = $('p#upgrade').text();
            c.fillRect((windowWidth - width) / 2 + imageSize / 2 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
            c.drawImage(getImage(type + (currentLevel - 1)), (windowWidth - width) / 2 + imageSize / 2, imageY, imageSize, imageSize);
            
            c.fillRect((windowWidth - width) / 2 + width - imageSize * 1.5 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
            c.drawImage(getImage(type + (currentLevel)), (windowWidth - width) / 2 + width - imageSize * 1.5, imageY, imageSize, imageSize);

            c.globalAlpha = 1;
            drawArrow(windowWidth / 2 + arrowSize, imageY + imageSize / 2, 135 * Math.PI / 180, "white", arrowSize);
            c.globalAlpha = .9;
        }
        else{
            label = $('p#buy').text();
            c.globalAlpha = .9;
            c.fillRect(windowWidth / 2 - imageSize / 2 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
            c.drawImage(getImage(type + currentLevel), windowWidth / 2 - imageSize / 2, imageY, imageSize, imageSize);
        }
    
        var buttonWidth = height / 2.5;
        var buttonHeight = height / 10;
        var buttonX = windowWidth / 2 - buttonWidth / 2;
        var buttonY = (windowHeight - height) / 2 + (height * .8) - buttonHeight;
    
        var mouseX = mouse.x * scale;
        var mouseY = mouse.y * scale;
    
        c.globalAlpha = .75;
    
        if(mouse.clicked == false)
            shopUpgradeButtonClicked = false
        //Button
        if (mouseY > buttonY && mouseY < buttonY + buttonHeight && mouseX > buttonX && mouseX < buttonX + buttonWidth && shopUpgradeButtonClicked == false) {
            c.fillStyle = "#1981ff";
            c.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
            if(mouse.clicked)
            {
                shopUpgradeButtonClicked = true;
    
                var data = {
                    worldId: worldId,
                    type: type
                }
    
                socket.emit("shopUpgrade", data);
                c.fillStyle = "#24374f";
                c.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
            }
        }
        else
        {
            c.fillStyle = "#5784ba";
            c.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
        }
            
        c.font = height / 30 + "px Helvetica";
        c.textAlign = "center";
        c.fillStyle = "white";
        c.fillText(label, buttonX + buttonWidth / 2, buttonY + buttonHeight / 1.5);
        c.textAlign = "left";

        //Costs
        var upgradeCosts = shopUpgrades[type][currentLevel + 1].costs;
        var costX = (windowWidth - width) / 2 + costPadding * 2;
        var costY = (windowHeight - height) / 2 + (height * .65);

        c.fillStyle = "#5784ba";
        c.fillRect(costX - costPadding, costY - costPadding, width / 4, height / 2.8);
        
        if(upgradeCosts){
            for (var cost in upgradeCosts) {
                if (upgradeCosts.hasOwnProperty(cost)) {

                    var color = "white";
                    if(!playerItems[cost] || playerItems[cost] < upgradeCosts[cost])
                        color = "#ff9696";

                    c.drawImage(getImage(cost), costX, costY, costSize, costSize);
                    c.font = costSize / 1.5 + "px Helvetica";
                    c.fillStyle = color;
                    c.fillText(upgradeCosts[cost], costX + costSize + costPadding, costY + costSize / 1.3);
    
                    costY += costSize + costPadding;
                }
            }
        }
    }
    
    c.globalAlpha = 1;
}

function drawPlanetShopPanel(){

    var hoveredStructure = null;

    //Highlight Seleted Structures ----------------------------------------------------

    currentPlanet.structures.forEach(structure => {
        
        var distance = Math.sqrt(Math.pow(mouse.x - structure.x, 2) + Math.pow(mouse.y - structure.y, 2));
        
        if(distance < structure.size / 2)
            hoveredStructure = structure;
    });

    var selectedNew = false;

    var slCtx = FindCanvas("selectedObj", "destination-atop", true);            //Selected structure canvas context
    var hlCtx = FindCanvas("highlightedObjCanvas", "destination-atop", true);   //Highlighted structure canvas context

    if(hoveredStructure)
    {   
        if(hoveredStructure != selectedStructure)
        {

            if(mouse.clickDown)
            {
                selectedStructure = hoveredStructure;
                planetShopSelection = selectedStructure;
                hlCtx.fillStyle = "#5beeff";

                selectedNew = true;
            }

            hlCtx.fillStyle = "#ffffff";
            
            hlCtx.globalAlpha = .5;

            hlCtx.save();
            hlCtx.translate(hoveredStructure.x, hoveredStructure.y);
            hlCtx.rotate((hoveredStructure.rotation - 90) / -57.2958);
            hlCtx.fillRect(-hoveredStructure.size / 2, -hoveredStructure.size / 2, hoveredStructure.size, hoveredStructure.size);
            hlCtx.restore();

            hlCtx.globalAlpha = 1;
            hoveredStructure.draw(hlCtx);
        }
        else if(mouse.clickDown)
        {
            selectedStructure = null;
            planetShopSelection = null;
        }
    }
    else{
        lastSelectedStructue = null;
    }
    if(selectedStructure && !selectedNew){
        
        slCtx.fillStyle = "#5beeff";
        slCtx.globalAlpha = .5;

        slCtx.save();
        slCtx.translate(selectedStructure.x, selectedStructure.y);
        slCtx.rotate((selectedStructure.rotation - 90) / -57.2958);
        slCtx.fillRect(-selectedStructure.size / 2, -selectedStructure.size / 2, selectedStructure.size, selectedStructure.size);
        slCtx.restore();

        slCtx.globalAlpha = 1;
        selectedStructure.draw(slCtx);
    }

    //Draw planet structure shop ------------------------------------------------------------
    var turretButtonOffset = 0;

    var numYButtons = 4;
    var numXButtons = 2;

    var buttonSizes = Math.sqrt(canvas.height * canvas.width) / 18;
    var padding = Math.sqrt(canvas.height * canvas.width) / 100;

    var selectedStructureImageSize = Math.sqrt(canvas.height * canvas.width) / 9;

    var yVal = canvas.height - (buttonSizes + padding) * numYButtons - padding * 2;
    var xVal = padding;

    var buttonTypes = ["spaceShip", "landingPad", "mine", "turret", "shield", "electricity", "satellite"];

    if(currentPlanet.id == "hive")
    {
        numYButtons = 4;
        numXButtons = 1;
        buttonTypes = ["spawnerScout", "spawnerDefender", "spawnerGuard"];
    }

    //Box Label -----------------------------
    var backgroundWidth = (buttonSizes + padding) * numXButtons + padding;
    var backgroundHeight = (buttonSizes + padding) * numYButtons + padding;

    var cornerRadius = Math.sqrt(canvas.height * canvas.width) / 70;
    var fontsize = Math.sqrt(canvas.height * canvas.width) / 45 * Math.sqrt(numXButtons) / Math.sqrt(3);
    
    var yTextSize = fontsize - padding / Math.sqrt(canvas.height * canvas.width);

    c.globalAlpha = .2;
    c.fillStyle = "#ffffff";

    c.beginPath();
    c.moveTo(xVal + padding, yVal);
    c.lineTo(xVal + padding, yVal - yTextSize + cornerRadius);
    c.arc(xVal + padding + cornerRadius, yVal - yTextSize, cornerRadius, -180 * Math.PI / 180, -90 * Math.PI / 180);
    c.lineTo(xVal + backgroundWidth - padding - cornerRadius, yVal - yTextSize - cornerRadius);
    c.arc(xVal + backgroundWidth - padding - cornerRadius, yVal - yTextSize, cornerRadius, -90 * Math.PI / 180, 0);
    c.lineTo(xVal + backgroundWidth - padding, yVal);
    c.fill();

    c.globalAlpha = 1;
    c.font = fontsize + "px Helvetica";
    c.textAlign = "center";
    c.fillText($('p#structures').text(), backgroundWidth / 2 + padding, yVal - padding);

    c.globalAlpha = .2;
    c.fillRect(xVal, yVal, backgroundWidth, backgroundHeight);

    //Draw Buttons ------------------------------
    c.globalAlpha = 1;

    var buttonY = yVal;
    var buttonX = xVal;

    var mouseX = mouse.x * scale;
    var mouseY = mouse.y * scale;                    

    var typeI = 0;

    for (var ix = 0; ix < numXButtons; ix++) {

        for (var iy = 0; iy < numYButtons; iy++) {
            if (mouseY > buttonY + padding && mouseY < buttonY + padding + buttonSizes && mouseX > buttonX + padding && mouseX < buttonX + padding + buttonSizes) 
            {
                if(mouse.clicked)
                {
                    if(mouse.clickDown)
                    {
                        selectedStructure = null;
                        planetShopSelection = buttonTypes[typeI];
                    }

                    c.fillStyle = "#a3a3a3";
                }
                else
                    c.fillStyle = "#cccccc";
            }
            else
                c.fillStyle = "#ffffff";


            var imagePadding = 20;
            var imageName = buttonTypes[typeI] + "Gray";

            if(typeI > buttonTypes.length - 1)
                imageName = "x"
            else if(buttonTypes[typeI] == "shield")
                imageName = "shieldGeneratorGray"
            

            c.globalAlpha = ".5";
            c.fillRect(buttonX + padding, buttonY + padding, buttonSizes, buttonSizes);
            c.globalAlpha = "1";
            c.drawImage(getImage(imageName), buttonX + padding + imagePadding / 2, buttonY + padding + imagePadding / 2, buttonSizes - imagePadding, buttonSizes - imagePadding);
            buttonY += buttonSizes + padding;
            typeI++;
        }

        buttonX += buttonSizes + padding;
        buttonY = yVal;
    }

    //Draw Selected Structure Panel -------------            
    c.globalAlpha = 1;

    if(planetShopSelection != null)
    {
        var type = planetShopSelection;
        var upgradeType = type;
        var level = 0;
        var upgrading = typeof planetShopSelection == "object";

        if(upgrading)
        {
            type = planetShopSelection.type;
            upgradeType = planetShopSelection.type;
            level = planetShopSelection.level;
        }
        else if(type == "spaceShip")
            level = spaceShip.level;

        if(type.substring(0, 7) == "spawner")
            upgradeType = "spawner";

        var upgrades = structureUpgrades[upgradeType];

        if(upgrades == undefined)
            upgrades = playerUpgrades;

        var pannelWidth = selectedStructureImageSize * 8/7 + padding * 2;
        var pannelHeight = backgroundHeight;

        var panelX = xVal + backgroundWidth
        var panelY = canvas.height - pannelHeight - padding;

        turretButtonOffset += pannelWidth;

        //Header
        var headerX = panelX;

        c.globalAlpha = .2;
        c.fillStyle = "#ffffff";

        c.beginPath();
        c.moveTo(headerX + padding, yVal);
        c.lineTo(headerX + padding, yVal - yTextSize + cornerRadius);
        c.arc(headerX + padding + cornerRadius, yVal - yTextSize, cornerRadius, -180 * Math.PI / 180, -90 * Math.PI / 180);
        c.lineTo(headerX + pannelWidth - padding - cornerRadius, yVal - yTextSize - cornerRadius);
        c.arc(headerX + pannelWidth - padding - cornerRadius, yVal - yTextSize, cornerRadius, -90 * Math.PI / 180, 0);
        c.lineTo(headerX + pannelWidth - padding, yVal);
        c.fill();

        c.globalAlpha = 1;
        c.font = fontsize + "px Helvetica";
        c.textAlign = "center";

        var name = $('p#' + type).text();
        
        if(type == "spaceShip")
            name = $('p#spaceShipp').text();
        else if(type == "spawner")
            name = $('p#' + planetShopSelection.spawnerType).text();

        var uppercasedType = name.charAt(0).toUpperCase() + name.slice(1);
        c.fillText(uppercasedType, headerX + pannelWidth / 2, yVal - padding);

        //Background
        c.globalAlpha = .2;
        c.fillRect(panelX, panelY, pannelWidth, pannelHeight);

        //Division Line
        c.globalAlpha = .5;
        c.fillRect(panelX - 2, panelY + 10, 4, pannelHeight - 20);

        //Image
        c.globalAlpha = 1;

        var fullyUpgraded = false;

        if(type == "spaceShip")
        {
            if(spaceShip.level > 0)
            {
                upgrading = true;
                fullyUpgraded = upgrades[level + 1] == null;
            }
            else
                level = 1;
        }

        if(upgrading)
            fullyUpgraded = upgrades[level + 1] == null;
        
        var imageLevel = level;

        if(upgrading && !fullyUpgraded)
            imageLevel = level + 1;

        if(type == "spawner" && upgrading)
            type = planetShopSelection.spawnerType;

        var imageName = type + imageLevel;

        if(type == "shield")
            imageName = "shieldGenerator" + imageLevel;

        c.drawImage(getImage(imageName), panelX + pannelWidth / 2 - selectedStructureImageSize / 2, panelY + padding / 2, selectedStructureImageSize, selectedStructureImageSize);

        //Buy / Upgrade button
        var shopButtonWidth = pannelWidth * 2 / 3;
        var shopButtonHeight = pannelHeight / 10;

        var shopButtonX = panelX + pannelWidth / 2 - shopButtonWidth / 2;
        var shopButtonY = panelY + padding * 2 + selectedStructureImageSize;

        var hoveringOnBuy = false;

        if(type == "spaceShip")
            shopButtonY = panelY + pannelHeight - (shopButtonHeight + padding);

        var label = $('p#buy').text();

        fontsize = Math.sqrt(canvas.height * canvas.width) / 60;

        if(upgrading || type == "spaceShip")
        {
            if(fullyUpgraded){
                label = $('p#fullyUpgraded').text();
                fontsize = Math.sqrt(canvas.height * canvas.width) / 80;
            }
            else{
                label = $('p#upgrade').text();
                upgrading = true;
            }
        }
        if (!fullyUpgraded && mouseY > shopButtonY && mouseY < shopButtonY + shopButtonHeight && mouseX > shopButtonX && mouseX < shopButtonX + shopButtonWidth) {
            
            if(mouse.clicked)
            {
                if(mouse.clickDown)
                {
                    if(upgrading)
                    {
                        var id = planetShopSelection.id;

                        if(type == "spaceShip")
                            id = clientId;
                        
                        var data = {id: id, worldId: worldId}
                        socket.emit('upgradeRequest', data);
                    }
                    else
                    {
                        if(type == "landingPad")
                            requestStructureSpawn(type);
                        else if(type == "spaceShip")
                        {
                            var data = {id: clientId, worldId: worldId}
                            socket.emit('upgradeRequest', data);
                        }
                        else
                            boughtStructure = type;
                    }
                    
                }

                c.fillStyle = "#c6c6c6";
            }
            else{
                c.fillStyle = "#e2e2e2";
                hoveringOnBuy = true;
            }
            
        }
        else
            c.fillStyle = "#ffffff";

        c.fillRect(shopButtonX, shopButtonY, shopButtonWidth, shopButtonHeight);

        c.globalAlpha = .8;
        c.fillStyle = "black";
        c.font = "bold " + fontsize + "px Helvetica";
        c.textAlign = "center";
        c.fillText(label, shopButtonX + shopButtonWidth / 2, shopButtonY + shopButtonHeight - padding);
        
        var upgradeCosts;
        
        if(upgrading && upgrades[level + 1] != null)
            upgradeCosts = upgrades[level + 1].costs;
        else if(!upgrading)
            upgradeCosts = upgrades[level].costs;

        //Draw spaceship upgrade menu
        if(type == "spaceShip"){
            var numberOfSegments = 4;
            var barWidth = pannelWidth / 2;
            
            var segmentPadding = padding / 3;
            var segmentWidth = barWidth / numberOfSegments - segmentPadding;
            var barHeight = segmentWidth;

            var barX = panelX + padding;
            var barY = panelY + selectedStructureImageSize + padding * 1.2;

            var upgradeBars = ["speed", "damage", "maxHealth", "fireRate"];

            var xPos = barX;
            var yPos = barY;

            var yAdd = barHeight + segmentPadding * 1.3;

            var buttonY = yPos;
            var buttonX = panelX + padding * 2 + segmentWidth * numberOfSegments + segmentPadding * (numberOfSegments - 1);
            var buttonWidth = (panelX + pannelWidth) - buttonX - padding;

            var highlighted;

            //Draw used upgrades
            c.textAlign = "left";
            c.fillStyle = "white";

            var addToNumUpgrades = 0;

            if(hoveringOnBuy)
            {
                c.fillStyle = "#9aff75";
                addToNumUpgrades = 3;
            }
                

            c.font = Math.sqrt(canvas.height * canvas.width) / 85 + "px Helvetica";
            c.fillText(usedUpgrades + "/" + (spaceShip.numUpgrades + addToNumUpgrades), panelX + padding, panelY + selectedStructureImageSize + padding / 2);

            //Draw Upgrade Buttons
            for (let i = 0; i < upgradeBars.length; i++) {

                c.globalAlpha = 1;
                c.fillStyle = "#ffffff"; 

                if(numStatUpgrades <= spaceShip.statLevels[upgradeBars[i]] || usedUpgrades >= spaceShip.numUpgrades)
                    c.globalAlpha = .5;
                else{

                    if (mouseY > buttonY && mouseY < buttonY + barHeight && mouseX > buttonX && mouseX < buttonX + buttonWidth)
                    {
                        if(mouse.clickDown) //initial click
                        {
                            var data = {id: clientId, worldId: worldId, type: upgradeBars[i]}
                            socket.emit('upgradeRequest', data);
                            c.globalAlpha = .4;
                        }
                        else if(mouse.clicked) //mouse pressed down after initial click
                            c.globalAlpha = .6; 
                        else
                        {
                            highlighted = upgradeBars[i];
                            c.globalAlpha = .8; //just hovering
                        }
                            
                        upgradeCosts = playerStatUpgrades[upgradeBars[i]](spaceShip.statLevels[upgradeBars[i]] + 1).costs;
                    }
                }

                roundRect(c, buttonX, buttonY, buttonWidth, barHeight, 5);

                var text = upgradeBars[i];

                if(text == "maxHealth")
                    text = "health";
                if(text == "fireRate")
                    text = "fire rate";

                c.textAlign = "center";
                c.fillStyle = "black";
                c.font = Math.sqrt(canvas.height * canvas.width) / 95 + "px Helvetica";
                c.fillText(text, buttonX + buttonWidth / 2, buttonY + barHeight / 1.4, buttonWidth);

                buttonY += yAdd;
            }

            //Draw Upgrade Segments
            for (let i = 0; i < upgradeBars.length; i++) {

                var level = spaceShip.statLevels[upgradeBars[i]];

                if(highlighted == upgradeBars[i])
                    level++;

                var filled = level % (numberOfSegments);                

                if(filled == 0 && level != 0)
                    filled = numberOfSegments;

                for (let x = 0; x < numberOfSegments; x++) {

                    var width = segmentWidth;

                    c.globalAlpha = .5;
                    c.fillStyle = "#ffffff"; 

                    if(x < filled)
                    {
                        if(level > 12)
                            c.fillStyle = "#ff75de";
                        else if(level > 8)
                            c.fillStyle = "#ffa954";
                        else if(level > 4)
                            c.fillStyle = "#91fffb";
                        else
                            c.fillStyle = "#9aff75";
                    }

                    if(x == 0)
                        roundRectLeft(c, xPos, yPos, width, barHeight, 5);
                    else if(x == numberOfSegments - 1)
                        roundRectRight(c, xPos, yPos, width, barHeight, 5);
                    else
                        c.fillRect(xPos, yPos, width, barHeight);

                    xPos += segmentWidth + segmentPadding;
                }

                xPos = barX;
                yPos += yAdd;
            }
        }

        // Cost
        if(!fullyUpgraded || upgradeCosts != null)
        {
            if(upgrading)
                level++;

            var costX = panelX + padding;
            var startCostY = shopButtonY + shopButtonHeight + padding;
            var costY = startCostY;

            if(type == "spaceShip")
                costY = panelY + pannelHeight * .75;
            
            var costSize = Math.sqrt(canvas.height * canvas.width) / 45;
            var numberOfCosts = 0;

            if(upgradeCosts){
                for (var cost in upgradeCosts) {
                    if (upgradeCosts.hasOwnProperty(cost) && upgradeCosts[cost] > 0) {
                        var color = "white";

                        if(!playerItems[cost] || playerItems[cost] < upgradeCosts[cost])
                            color = "#ff9696";
    
                        c.globalAlpha = 1;
                        c.drawImage(getImage(cost), costX, costY, costSize, costSize);
                        c.font = costSize / 1.5 + "px Helvetica";
                        c.fillStyle = color;
                        c.textAlign = "left";
                        c.fillText(abbreviate(upgradeCosts[cost]), costX + costSize + padding / 2, costY + costSize / 1.3);
                        
                        if(type != "spaceShip")
                            costY += costSize + padding;
                        else
                            costX += costSize + padding * 5;

                        numberOfCosts++;

                        if(numberOfCosts == 3 && numberOfCosts < upgradeCosts.length)
                        {
                            costY = startCostY;
                            costX += costSize + padding * 6;
                        }
                    }
                }
            }
        }
        
        // Description
        if(typeof planetShopSelection == "string" && !(type == "spaceShip") )
        {
            var descBoxHeight = -1 * (costY + padding - canvas.height + padding);
            var descBoxWidth = pannelWidth - padding * 2;

            var descBoxX = panelX + pannelWidth / 2 - descBoxWidth / 2;
            var descBoxY = costY;

            var fontsize = Math.sqrt(canvas.height * canvas.width) / 65;
            c.globalAlpha = .2;
            c.fillStyle = "#ffffff";
            c.fillRect(descBoxX, descBoxY, descBoxWidth, descBoxHeight);

            c.globalAlpha = 1;
            c.textAlign = "left";
            c.fillStyle = "white";
            c.font = fontsize + "px Helvetica";
            wrapText(c, $('p#' + type + "Desc").text(), descBoxX + padding / 2, descBoxY + fontsize + padding / 5, descBoxWidth - padding / 2, fontsize);
        } 
    }

    var drawManualTurretButton = false;

    for (var x = 0; x < currentPlanet.structures.length; x++) {
        var structure = currentPlanet.structures[x];
        
        if(structure.type == "turret")
        {
            drawManualTurretButton = true;
            break;
        }
    }

    if(drawManualTurretButton)
    {
        var mtButtonSize = windowHeight / 15;

        var mtButtonX = backgroundWidth + turretButtonOffset + padding * 2;
        var mtButtonY = windowHeight - padding - mtButtonSize;

        c.fillStyle = "#e2e2e2";
        c.globalAlpha = .3;

        if (mouseY > mtButtonY && mouseY < mtButtonY + mtButtonSize && mouseX > mtButtonX && mouseX < mtButtonX + mtButtonSize) 
        {
            if(mouse.clickDown) //initial click
            {
                turretManualMode = !turretManualMode;

                if (!turretManualMode)
                {
                    var data = {turrets: [], worldId:worldId};

                    for(var i = 0; i < currentPlanet.structures.length; i++){
                        var structure = currentPlanet.structures[i];
                        if(structure.type == "turret")
                            data.turrets.push({id: structure.id, stop: true});
                    } 

                    socket.emit("turretRot", data);
                }
            }
            else if(mouse.clicked) //mouse pressed down after initial click
                c.globalAlpha = .5; 
            else
                c.globalAlpha = .4; //just hovering
        }

        c.fillRect(mtButtonX, mtButtonY, mtButtonSize, mtButtonSize);
        c.globalAlpha = 1;
        c.drawImage(getImage("target"), mtButtonX + padding / 2, mtButtonY + padding / 2, mtButtonSize - padding, mtButtonSize - padding)
    }

    c.textAlign = "left";
            
}

function drawArrowsToOwnedPlanets(){

    for (var id in ownedPlanets) {
        if (ownedPlanets.hasOwnProperty(id)) {
            var planet = ownedPlanets[id];

            var size = planet.radius;

            if(planet.shield)
                size = planet.shield.radius;

            if(!isOnScreen(planet.x, planet.y, size)){
                var padding = 20 / scale;
                var screenWidth = windowWidth / scale - 2 * padding;
                var screenHeight = windowHeight / scale - 2 * padding;

                var x = planet.x;
                var y = planet.y;

                var arrowPos = {x: 0, y: 0};

                var slopeY = planet.y - screenHeight / 2;
                var slopeX = planet.x - screenWidth / 2;
                var slope = Math.abs(slopeY / slopeX);
                var screenRatio = Math.abs(screenHeight / screenWidth);

                var xModifier = 1;
                var yModifier = 1;

                if(slopeX < 0)
                    xModifier = 0;

                if(slopeY < 0)
                    yModifier = 0;

                if(slope == screenRatio) //Corner
                {
                    arrowPos.x = screenWidth * xModifier;
                    arrowPos.y = screenHeight * yModifier;   
                }
                else if(slope < screenRatio) //Top
                {
                    if(slopeX < 0)
                    {
                        arrowPos.x = padding;
                        arrowPos.y = (screenWidth * slopeY / slopeX) / -2 + (screenHeight / 2) + (padding);
                        
                    }
                    else{
                        arrowPos.x = screenWidth + padding;
                        arrowPos.y = (screenWidth * slopeY / slopeX) / 2 + (screenHeight / 2) + (padding);
                    }

                }
                else if(slope > screenRatio) //Top / Bottom
                {
                    if(slopeY < 0)
                    {
                        arrowPos.x = screenHeight * slopeX / slopeY / -2 + screenWidth / 2;
                        arrowPos.y = padding;
                    }
                    else{
                        arrowPos.x = screenHeight *  slopeX / slopeY / 2 + screenWidth / 2 
                        arrowPos.y = screenHeight + padding;
                    }

                    arrowPos.x += padding;
                }

                var arrowRotation = Math.atan2(centerY - planet.y, centerX - planet.x) - (45 * Math.PI / 180);
                var arrowSize = 20 / scale;

                var arrowColor = "#ffffff";

                if(attackedPlanets[planet.id]){
                    if(!flashingPlanetArrows[planet.id]){
                        flashingPlanetArrows[planet.id] = {times: 0, isFlashed: true, time: 0};
                    }
                    else{
                        if(flashingPlanetArrows[planet.id].times > planetArrowFlashTimes)
                        {
                            attackedPlanets[planet.id] = false;
                            delete flashingPlanetArrows[planet.id];
                        }
                        else{
                            if(flashingPlanetArrows[planet.id].time < planetArrowFlashInterval)
                                flashingPlanetArrows[planet.id].time++;
                            else
                            {
                                flashingPlanetArrows[planet.id].time = 0;
                                flashingPlanetArrows[planet.id].isFlashed = !flashingPlanetArrows[planet.id].isFlashed;
                                flashingPlanetArrows[planet.id].times++;
                            }
                        }       
                    }
                }
                
                if(flashingPlanetArrows[planet.id] && flashingPlanetArrows[planet.id].isFlashed)
                    arrowColor = planet.color;
                else
                    arrowColor = "#ffffff";

                drawArrow(arrowPos.x, arrowPos.y, arrowRotation, arrowColor, arrowSize);
            }
        }
    }
}

function drawChecklist()
{

    var i = 0;
    var checkItemY = windowHeight * .7;
    var checkPadding = windowHeight * .02;

    var width = windowHeight * .4;
    var height = width * .25;

    function getCardYPos(index)
    {
        return checkItemY + (checkPadding + height) * index;
    }

    var yPositions = {};
    

    for (var check in checklist) {

        c.globalAlpha = 1;

        if (checklist.hasOwnProperty(check)) {

            var checkItem = checklist[check];

            if(checkItem.isActive)
            {

                if(!checkItem.yPos)
                    checkItem.yPos = getCardYPos(i);
                else if(checkItem.yPos != getCardYPos(i)){
                    if(checkItem.lerp == undefined)
                        checkItem.lerp = 0;
                    else if(checkItem.lerp < 1){
                        checkItem.yPos = checkItem.yPos + (getCardYPos(i) - checkItem.yPos) * checkItem.lerp;
                        checkItem.lerp += .01;
                    }
                    else if(checkItem.lerp >= 1) { 
                        checkItem.yPos = getCardYPos(i);
                        checkItem.lerp = 0;
                    }
                }

                if(!checkItem.lerp)
                    checkItem.lerp = 0;

                if(!checkItem.alpha)
                    checkItem.alpha = 1 / (i + 1);
                else if(checkItem.alpha != 1 / (i + 1))
                {
                    checkItem.alpha = checkItem.alpha + (1 / (i + 1) - checkItem.alpha) * checkItem.lerp;
                }

                if(!checkItem.size)
                    checkItem.size = 1 / (i * .2 + 1);
                else if(checkItem.size != 1 / (i + 1))
                {
                    checkItem.size = checkItem.size + (1 / (i * .2 + 1) - checkItem.size) * checkItem.lerp;
                }

                //var size = 1 / (i * .2 + 1) * 1 - (getCardYPos(i) - checkItem.yPos) * checkItem.lerp / 10;

                var fontsize = width / 20;

                if(checkItem.done)
                {
                    if(!checkItem.fade)
                        checkItem.fade = 0;

                    if(checkItem.fade < checklistFadeTime)
                    {
                        c.globalAlpha = (checklistFadeTime - checkItem.fade) / checklistFadeTime * checkItem.alpha;
                        c.drawImage(getImage("checklist_checked"), windowWidth / 2 - width * checkItem.size / 2, checkItem.yPos, width * checkItem.size, height * checkItem.size);
                        checkItem.fade++;
                    }
                    else
                        checkItem.isActive = false
                }
                else{
                    c.globalAlpha = checkItem.alpha;
                    c.drawImage(getImage("checklist"), windowWidth / 2 - width * checkItem.size / 2, checkItem.yPos , width * checkItem.size, height * checkItem.size);
                }


                if(checkItem.isActive)
                {
                    c.fillStyle = "white";
                    c.font = fontsize + "px Helvetica";
    
                    wrapText(c, $('p#' + check).text(), windowWidth / 2 - width * checkItem.size / 4, checkItem.yPos + fontsize * 2, width * .7, fontsize);
                }
            

                if(!checkItem.done)
                    i++;
            }
        }
    }

    c.globalAlpha = 1;
}

function drawOxygen() {
    var oxyWidth = windowWidth / 3;
    var oxyHeight = windowHeight / 20;

    oxygenSize = windowHeight / 3.5;

    var percentOxygenRemaining = spaceShip.oxygenRemaining / spaceShip.oxygen;
    var oxyHeight = oxygenSize * .75 * percentOxygenRemaining;

    c.globalAlpha = .75;
    c.fillStyle = spaceShip.oxygenDispBarBGColor;
    c.fillRect(windowHeight / 34, windowHeight - oxygenSize * .75 - windowHeight / 23, oxygenSize / 7, oxygenSize * .75);

    c.globalAlpha = .75;
    c.fillStyle =  "#a3e1ff";
    c.fillRect(windowHeight / 34, windowHeight - oxyHeight - windowHeight / 24, oxygenSize / 7, oxyHeight);

    c.globalAlpha = 1;
    
    c.drawImage(getImage("oxygenTank"), -oxygenSize / 3.5 - windowHeight / 80, windowHeight - oxygenSize - windowHeight / 50, oxygenSize, oxygenSize)

    c.font = windowHeight / 30 + "px Helvetica";
    c.fillStyle = "white";
    c.textAlign = "center";
    c.fillText("O²", oxygenSize / 5.2, windowHeight - oxygenSize - windowHeight / 30);

    if(percentOxygenRemaining <= 0)
    {
        var warningWidth = (windowHeight + windowWidth) / 10;
        var warningHeight = warningWidth * 11/21;

        c.globalAlpha = .8;
        c.drawImage(getImage("warningSign"), windowWidth / 2 - warningWidth / 2, windowHeight / 2 - warningHeight /2, warningWidth, warningHeight);
        var fontsize = warningHeight / 6;

        c.font = fontsize + "px Helvetica";
        c.fillStyle = "white";

        wrapText(c, $('p#oxygenWarning').text(), windowWidth / 2, windowHeight / 2, warningWidth * .85, fontsize);
    }
    c.textAlign = "left";
}

function playerHasResources(costs) {
    var costCounter = 0;
    var neededCosts = 0;

    for (var cost in costs) {
        if (costs.hasOwnProperty(cost)) {
            if(playerItems[cost] >= costs[cost])
            {
                costCounter++;
            }
            neededCosts++;
        }
    }

    return costCounter >= neededCosts;
}

function minimap(size, x, y){

    c.globalAlpha = 0.25;
    c.fillStyle = "#bcbcbc";
    c.fillRect(x, y, size, size);

    var shopIds = Object.keys(worldObjects.shops);

    shopIds.forEach(shopId => {
        var shop = worldObjects.shops[shopId];
        
        c.globalAlpha = 0.75;
        c.beginPath();
        c.arc(x + shop.coordX / gridSize * size, y + shop.coordY / gridSize * size, size / 50, 0, Math.PI * 2, false);
        c.fillStyle = "#7fb0ff";
        c.fill();

    });

    for (var id in ownedPlanets) {
        if (ownedPlanets.hasOwnProperty(id)) {
            var planet = ownedPlanets[id];
        
            c.globalAlpha = 0.75;
            c.beginPath();
            c.arc(x + planet.coordX / gridSize * size, y + planet.coordY / gridSize * size, size / 40, 0, Math.PI * 2, false);
            c.fillStyle = planet.color;
            c.fill();
        }
    }

    var crownSize = size / 10;
    var crownDrawn = false;

    if(master.obj)
    {
        var crownX = master.obj.coordX;
        var crownY = master.obj.coordY;

        c.drawImage(getImage("crown"), x + crownX / gridSize * size - crownSize / 2, y + crownY / gridSize * size - crownSize / 2, crownSize, crownSize);
        crownDrawn = true;
    }

    if(!crownDrawn)
    {
        for (var worldItem in worldItems) {
            if (worldItems.hasOwnProperty(worldItem)) {
                if(worldItems[worldItem].type == "crown")
                {
                    var crown = worldItems[worldItem];
                    c.drawImage(getImage("crown"), x + crown.coordX / gridSize * size - crownSize / 2, y + crown.coordY / gridSize * size - crownSize / 2, crownSize, crownSize);
                }
            }
        }
    }
    
    if(master.id != clientId)
    {
        c.globalAlpha = 0.75; 
        c.beginPath();
        c.arc(x + spaceShip.coordX / gridSize * size, y + spaceShip.coordY / gridSize * size, size / 30, 0, Math.PI * 2, false);
        c.fillStyle = "white";
        c.fill();  
    }

    c.globalAlpha = 1;
      
}

var averageTime;
var t0;

function perfStart(){
    t0 = performance.now();
}
function perfEnd(){
    var t1 = performance.now();

    if(!averageTime)
        averageTime = (t1 - t0);
    else
        averageTime = (averageTime + (t1 - t0)) / 2;
}

function updateAllMatter(){

    var propertySelected = false;
    var allWorldObjectsIds = Object.keys(allWorldObjects);

    allWorldObjectsIds.forEach(function(objId){
        var matter = allWorldObjects[objId];

        var pos = cordsToScreenPos(matter.coordX, matter.coordY);
        var size = matter.radius;

        if(matter.type == "sun")
            size += 500;

        if(matter.shield)
            size = matter.shield.radius;

        var isClosestAvaiblePlanet = matter.id == closestAvailablePlanet;

        //perfStart();
        if(isOnScreen(pos.x, pos.y, size) || isClosestAvaiblePlanet){
            matter.health = healthDict[matter.id];
            matter.update();

            var shop = worldObjects.shops[matter.id];

            if(!shop)
            {
                var distanceToMouse = Math.sqrt(Math.pow(pos.x - mouse.x, 2) + Math.pow(pos.y - mouse.y, 2));

                if(distanceToMouse <= matter.radius)
                {
                    if(propertiesTimer.matter && propertiesTimer.matter.id == clientId && matter.id != clientId)
                        return;

                    if(propertiesTimer.matter && propertiesTimer.matter.id == matter.id)
                    {
                        if(propertiesTimer.time < propertiesHoldTime)
                            propertiesTimer.time++;
                    }
                    else
                        propertiesTimer = {time: 0, fill: 0, matter: matter};

                    propertySelected = true;
                }
            }
        }


        //perfEnd();
        
    });

    if(!propertySelected)
        propertiesTimer = {time: 0, fill: 0, matter: null};
    else
        propertiesOverview(propertiesTimer.matter, propertiesTimer.fill);

}

function propertiesOverview(object, fill){

    var size = 100 / scale;
    var dropSize = size / 3;
    var dropPadding = size / 10;
    var pos = cordsToScreenPos(object.coordX, object.coordY);
    var flipX = 1;

    if(pos.x - 10 > centerX && object.id != clientId)
        flipX = -1;

    if(!isOnScreen(pos.x, pos.y, -20))
        pos = {x: mouse.x, y: mouse.y};

    var drops = dropDict[object.id];
    var dropX = 0;

    c.globalAlpha = fill;

    var imageOfset = 0;

    if(flipX > 0)
        imageOfset = -dropSize;

    
    if(drops)
    {
        for (var drop in drops) {
            if (drops.hasOwnProperty(drop)) {
                c.drawImage(getImage(drop), pos.x + (size / 1.2 + dropX + imageOfset) * flipX, pos.y - size / 2 + size / 20 + dropPadding, dropSize, dropSize);
                dropX += dropSize + dropPadding;
            }
        }
    }

    if(object.level >= 0)
    {
        var fontSize =  size / 5;

        c.font = fontSize + "px Arial";
        c.fillStyle = "white";
        var edgePadding = size / 20;
        var x = pos.x + (size / 1.8) * flipX;

        if(flipX < 0)
            x = (pos.x + (size / 2) * flipX) + (size + dropX * 1.2) * flipX + edgePadding;
    
        c.fillText("Level: " + (object.level + 1), x, pos.y - size / 2 - edgePadding);

        dropX += size * .8;
    }
    else if(object.owner)
    {
        var name = "";

        if(object.owner == clientId)
            name = username;
        else{
            
            var ownerPlayer = otherPlayers[object.owner];

            if(ownerPlayer)
                name = ownerPlayer.username;
        }

        c.font = size / 5 + "px Arial";
        c.fillStyle = "white";
        c.fillText($('p#owner').text() + ": " + (name), pos.x + (size / 1.8) * flipX, pos.y - size / 2 - size / 20);

        dropX += size * .8;
    }

    var filFirst = fill * 2;

    if(filFirst > 1)
        filFirst = 1;

    c.globalAlpha = 0.5;
    c.beginPath();
    c.moveTo(pos.x, pos.y);
    c.lineTo(pos.x + (size / 2) * flipX * filFirst, pos.y - size / 2 * filFirst);
    if(fill >= .5)
        c.lineTo((pos.x + (size / 2) * flipX * filFirst) + (size + dropX * 1.2) * flipX * (fill - .5), pos.y - (size / 2));

    c.strokeStyle = "white";
    c.lineWidth = size / 20;
    c.stroke();

    c.globalAlpha = 1;
}

function displayResources(){
    pos = new Vector(10, 70);
    size = windowHeight / 25;
    padding = windowHeight / 55;
    itemsPerColumn = 5;
    itemsDrawnColumn = 0;

    for (var item in playerItems) {
        if (playerItems.hasOwnProperty(item)) {
            if(getImage(item)){
                c.font = windowHeight / 40 + "px Arial";

                c.drawImage(getImage(item), pos.x, pos.y, size, size);

                //Shadow
                var shadowX = 3;
                var shadowY = 3
                c.fillStyle = "black";
                c.globalAlpha = .5;
                c.fillText(abbreviate(playerItems[item].toString()), pos.x + size + padding + shadowX, pos.y + size / 1.3 + shadowY);

                c.fillStyle = "white";
                c.globalAlpha = 1;
                c.fillText(abbreviate(playerItems[item].toString()), pos.x + size + padding, pos.y + size / 1.3);

                if(aquiredItems[item])
                {
                    if(aquiredItems[item].time > 0)
                    {
                        c.globalAlpha = aquiredItems[item].time / aquireItemsFadeTime;
                        c.fillStyle = "white";
                        c.font = windowHeight / 50 + "px Arial";
                        c.fillText("+ " + abbreviate(aquiredItems[item].amount), pos.x + size + padding + 50 + 20 * playerItems[item].toString().length, pos.y + size / 1.3);
    
                        aquiredItems[item].time--;
                    }
                    else
                        delete aquiredItems[item];
                    
                    c.globalAlpha = 1;
                }
            }
        }

        itemsDrawnColumn++;

        pos.y += size + padding;

        if(itemsDrawnColumn >= itemsPerColumn)
        {
            itemsDrawnColumn = 0;
            pos.x += size * 3.5 + padding;
            pos.y = 70;
        }
    }

}

function displayBar(x, y, width, height, fillPrecentage, color, backgroundColor) {

    var bg = backgroundColor == null ? "#bababa" : backgroundColor;

    c.globalAlpha = 0.55;
    c.fillStyle = bg;
    c.fillRect(x, y, width, height);

    c.fillStyle = color;
    c.fillRect(x, y, Math.round(fillPrecentage * width), height);
    c.globalAlpha = 1.0;
}

function shoot(x, y, rotation, speed, size, bulletPenetration, color, shooterId, damagePercent = 1){
    velocity = new Vector(0, 0);
    velocity.setMagnitude(speed);
    velocity.setDirection(rotation - 1.5708);
    var projId = uniqueId();
    
    projectile = new Projectile(x, y, velocity, size, color, bulletPenetration, false, projId);
    projectiles.push(projectile);
    sendProjectile(x, y, velocity, size, color, projId, shooterId, damagePercent);
}

function findClosestUnoccupiedPlanet() {
    var closestPlanet;
    var planetIds = Object.keys(worldObjects.planets);

    for(var i = 0; i < planetIds.length; i++){

        var planet = worldObjects.planets[planetIds[i]];


        if(planet.owner && planet.owner != clientId)
            continue;
        
        if(planet.id == "hive" && !playerItems["crown"] > 0)
            continue;

        var distance = Math.sqrt(Math.pow(centerX - planet.x, 2) + Math.pow(centerY - planet.y, 2));

        distance -= planet.radius;

        if(closestPlanet != null){
            var targetDistance = Math.sqrt(Math.pow(centerX - closestPlanet.x, 2) + Math.pow(centerY - closestPlanet.y, 2));
            
            targetDistance -= closestPlanet.radius;

            if(distance < targetDistance && !planet.occupiedBy && distance <= LANDING_DISTANCE){
                closestPlanet = planet;
            }
        }
        else if(!planet.occupiedBy && distance <= LANDING_DISTANCE){
            closestPlanet = planet;
        }
    }
    return closestPlanet;
}
 
function wrapText (context, text, x, y, maxWidth, lineHeight) {
    var words = text.split(' '),
        line = '',
        lineCount = 0,
        i,
        test,
        metrics;

    for (i = 0; i < words.length; i++) {
        test = words[i];
        metrics = context.measureText(test);

        if(metrics.width > maxWidth) {
            // Determine how much of the word will fit
            test = test.substring(0, test.length - 1);
            metrics = context.measureText(test);
        }
        if (words[i] != test) {
            words.splice(i + 1, 0,  words[i].substr(test.length))
            words[i] = test;
        }  

        test = line + words[i] + ' ';  
        metrics = context.measureText(test);
        
        if (metrics.width > maxWidth && i > 0) {
            context.fillText(line, x, y);
            line = words[i] + ' ';
            y += lineHeight;
            lineCount++;
        }
        else {
            line = test;
        }
    }
            
    context.fillText(line, x, y);
}

function drawArrow(x, y, rotation, color, size){
    c.save();
    c.translate(x, y);
    c.rotate(rotation);
    c.fillStyle = color;
    c.fillRect(0, 0, size, size * 2);
    c.fillRect(0, 0, size * 2, size);
    c.restore();
}

function drawGrid(x, y, width, height, gridScale){

    c.lineWidth = 1;
    var color = planetColors[1];

    //Draw Horizontal Lines
    for(var i = 0; i <= gridScale; i++){

        ypos = height - height / gridScale * i + (y);

        if(ypos > 0 && ypos < windowHeight / scale)
        {
            c.beginPath();
            c.moveTo(x, ypos);
            c.lineTo(x + width,  ypos);
            c.strokeStyle = color;
            c.stroke();
        }
        
    }
    
    //Draw Vertical Lines
    for(var i = 0; i <= gridScale; i++){

        xpos = width - width / gridScale * i + (x);

        if(xpos > 0 && xpos < windowWidth / scale)
        {
            c.beginPath();
            c.moveTo(xpos, y);
            c.lineTo(xpos, y + height);
            c.strokeStyle = color;
            c.stroke();
        }

    }
} 

function spikyBall(ctx, x, y, radius, sides, startAngle, anticlockwise, spikyAmount) {
    if (sides < 3) return;
    var a = (Math.PI * 2)/sides;
    a = anticlockwise?-a:a;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(startAngle);
    ctx.moveTo(radius,0);

    var inSpike = spikyAmount;

    for (var i = 1; i < sides; i++) {
      ctx.lineTo(radius * Math.cos(a*i) * inSpike,radius*Math.sin(a*i) * inSpike);

      if(inSpike == spikyAmount)
        inSpike = 1;
    else
        inSpike = spikyAmount;
    }
    ctx.closePath();
    ctx.restore();
}

function polygon(ctx, x, y, radius, sides, startAngle, anticlockwise) {
    if (sides < 3) return;
    var a = (Math.PI * 2)/sides;
    a = anticlockwise?-a:a;
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(startAngle);
    ctx.moveTo(radius,0);
    for (var i = 1; i < sides; i++) {
      ctx.lineTo(radius*Math.cos(a*i),radius*Math.sin(a*i));
    }
    ctx.closePath();
    ctx.restore();
  }

function roundRectLeft(ctx, x, y, width, height, radius) {

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fill();

}

function roundRectRight(ctx, x, y, width, height, radius) {

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();

    ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    ctx.fill();
}

function abbreviate(num){
    var place = num.toString().length;

    if(place >= 4 && place <= 6)
        return Math.round(num / 100) / 10 + "k";
    else if(place >= 7 && place <= 9)
        return Math.round(num / 100000) / 10 + "M";
    else if(place >= 10)
        return Math.round(num / 100000000) / 10 + "B";
    else
        return num;
}

function structureSpawnPoint(structureSize, img, addedDist){

    var positionAviable = true;
    var rad = Math.atan2(mouse.y - currentPlanet.y, mouse.x - currentPlanet.x) * -57.2958;
    structureSpawnRotation = rad;

    var dist = 0

    if(addedDist)
        dist += addedDist;

    var x = currentPlanet.x * scale + ((currentPlanet.radius + dist) * scale + structureSize / 2.1) * Math.cos(-rad*Math.PI/180);
    var y = currentPlanet.y * scale + ((currentPlanet.radius + dist) * scale + structureSize / 2.1) * Math.sin(-rad*Math.PI/180);

    structureSpawnPosition = new Vector(x / scale, y / scale);

    currentPlanet.structures.forEach(structure => {

        var distance = Math.sqrt(Math.pow(x / scale - structure.x, 2) + Math.pow(y / scale - structure.y, 2));

        if(distance < structure.size / 2 + structureSize / 2 / scale)
            positionAviable = false;
    }); 

    if(img)
    {
        if(positionAviable)
            c.globalAlpha = 1;
        else
            c.globalAlpha = .5;

        c.save();
        c.translate(x, y);
        c.rotate((rad - 90) * Math.PI / -180);
        c.drawImage(getImage(img), -structureSize/2,-structureSize/2,structureSize,structureSize);
        c.restore();
    }

    return positionAviable;
}

function isOnScreen(x, y, size){
    return (!(x - size > windowWidth / scale || x + size < 0 || y + size < 0 || y - size > windowHeight / scale));
}

function getRndInteger(min, max) {
    return (Math.random() * (max - min) ) + min;
}

function sortArrayByProp(arr, prop){
    var len = arr.length;
    for (var i = len-1; i>=0; i--){
      for(var j = 1; j<=i; j++){
        if(arr[j-1][prop]>arr[j][prop]){
            var temp = arr[j-1][prop];
            arr[j-1][prop] = arr[j][prop];
            arr[j][prop] = temp;
         }
      }
    }
    return arr;
}

function screenPosToCords(x, y){
    x -= gridPos.x + centerX;
    y -= gridPos.y + centerY;

    return new Vector(x,y);
}

function cordsToScreenPos(x, y){
    x += centerX + gridPos.x;
    y += centerY + gridPos.y;

    return new Vector(x,y);
}

function shadeColorHex(color, percent) {
    var num = parseInt(color.slice(1),16), amt = Math.round(2.55 * percent), R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1);
}

function findObjectWithId(array, id){
    for(var i = 0; i < array.length; i++){
        if(array[i].id == id){
            return {object: array[i],
                    index: i};
        }
    }
}

var uniqueId = function() {
    return 'id-' + Math.random().toString(36).substr(2, 16);
}

CanvasRenderingContext2D.prototype.wavy = function(from, to, frequency, amplitude, step, negative) 
{ 
	var cx = 0, cy = 0, 
		fx = from.x, fy = from.y, 
		tx = to.x, ty = to.y,
		i = 0, waveOffsetLength = 0,
		
		ang = Math.atan2(ty - fy, tx - fx),
		distance = Math.sqrt((fx - tx) * (fx - tx) + (fy - ty) * (fy - ty)),
		a = amplitude * (!negative ? 1 : -1),
		f = Math.PI * frequency;
	
	for (i; i <= distance; i += step) 
	{
		waveOffsetLength = Math.sin((i / distance) * f) * a;
		cx = from.x + Math.cos(ang) * i + Math.cos(ang - Math.PI/2) * waveOffsetLength;
		cy = from.y + Math.sin(ang) * i + Math.sin(ang - Math.PI/2) * waveOffsetLength;
        
        if(i > 0)
            this.lineTo(cx, cy);
	}
}


setup();