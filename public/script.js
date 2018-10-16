//Canvas
var canvas = document.getElementById('mainCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var c = canvas.getContext('2d');

var FindCanvas = function(id, compositeOp, returnContext)
{
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
        tempCanvas.style.zIndex = -1;
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
var otherPlayers = [];
var worldObjects = [];
var hittableObjects = {};
var gridSize;
var gridBoxScale;
var gridPos;
var worldId;

function getAllWorldObjects(){
    var objects = [];

    objects = worldObjects.asteroids.concat(worldObjects.planets).concat(worldObjects.shops);

    if(spaceShip)
        objects.push(spaceShip);

    return objects;
}

function getAllStructures(){
    var structures = [];

    for(var i = 0; i < worldObjects.planets.length; i++){
        if(worldObjects.planets[i].health >= 0)
        {
            var planetStructures = worldObjects.planets[i].structures;

            for(var x = 0; x < planetStructures.length; x++){
                structures.push(planetStructures[x]);
            }
        }
    }

    for(var x = 0; x < otherPlayers.length; x++){
        if(otherPlayers[x].turret)
            structures.push(otherPlayers[x].turret);
    }

    if(spaceShip && spaceShip.turret)
        structures.push(spaceShip.turret);
    
    return structures;
}

//Variables
var centerX;
var centerY;
var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var spaceShip;

var allWorldObjects = [];
var allStructures = [];
var allPlayers = [];

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

var images = {};
var imageArray = ["NF", "asteroidBits", "backX", "boost0", "boost1", "boost2", "boost3", "bulletPenetration0", "bulletPenetration1", "bulletPenetration2", "bulletPenetration3", "charge", "cloakTime0", "cloakTime1", "cloakTime2", "cloakTime3", "cloakTime4", "crystal", "E", "earth", "gem", "iron", "landingPad0", "mine0", "mine1", "mine2", "mine3", "mine4", "mine5", "mine6", "mine7", "mine8", "mine9", "mine10", "mineGray", "S", "satellite0", "satellite1", "satellite2", "satellite3", "satelliteGray", "shieldGenerator0", "shieldGenerator1", "shieldGenerator2", "shieldGenerator3", "shieldGenerator4", "shieldGenerator5", "shieldGenerator6", "shipTurret0", "shipTurret1", "shipTurret2", "shipTurret3", "shipTurret4", "shipTurretBase0", "shipTurretBase1", "shipTurretBase2", "shipTurretBase3", "shipTurretBase4", "shop", "spaceship0", "spaceShip1", "spaceShip2", "spaceShip3", "spaceShip4", "spaceShip5", "spaceShip6", "spaceShip7", "spaceShip8", "spaceShip9", "spaceShip10", "spaceShip11", "spaceShip12", "spaceShip13", "spaceShip14", "stardust", "startGameButton", "spaceShipGray", "turret0", "turret1", "turret2", "turret3", "turret4", "turret5", "turret6", "turret7", "turretGray", "water"];

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

var upgradeables = [];
var structureUpgradeables = [];

var structureUpgrades;
var playerUpgrades;
var shopUpgrades;

var upgradeableObjects = function(){ return upgradeables.concat(structureUpgradeables); }

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

var ownedPlanets = [];

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

var landed = false;

var propertiesTimer = {};
var propertiesHoldTime = 80;
var username = "unnamed";

var colorChangedHitObjects = {};

var caughtInBlackHole = false;

var aquiredItems = {};
var aquireItemsFadeTime = 50;

var DISPLAY_NEWS = true;
var newsDisplayed = true;

var POSITION_SEND_DELAY = 6;
var positionSendTime = 0;

var planetShopSelection = null;
var selectedStructure = null;
var lastSelectedStructue = null;;
var boughtStructure = null;
var electricityTimer = {time: 0, duration: 50, on: false};

var structureSpawnPosition = null;
var structureSpawnRotation = null;

var checklist = {
    fly:{
        isActive: true
    },
    shoot:{
        isActive: true
    },
    landingPad:{
        isActive: false
    },
    structures:{
        isActive: false
    }
}

checklistFadeTime = 20;

function setup(){
    socket = io.connect('http://localhost:8080');
    //socket = io.connect('http://space-base.io/');
    socket.on('setupLocalWorld', setupLocalWorld);
    socket.on('showWorld', showWorld);
    socket.on('newPlayerStart', startLocalPlayer);
    socket.on('playerPos', updatePlayerPosition);
    socket.on('newPlayer', newPlayer);
    socket.on('playerExited', playerExited);
    socket.on('damageSync', receiveDamageSync);
    socket.on('spawnProj', spawnNetworkedProjectile);
    socket.on('spawnStructure', spawnNetworkedStructure);
    socket.on('destroyProjectile', destroyNetworkedProjectile);
    socket.on("items", onAquiredItems);
    socket.on("upgradeInfo", receiveUpgradeInfo)
    socket.on("upgradeSync", upgradeSync);
    socket.on("returnMsg", returnMsg);
    socket.on("serverDisconect", forceDisconnect);
    socket.on("planetOccupancy", updatePlanetOccupier);
    socket.on("mineProduce", mineProduce);
    socket.on("respawn", respawn);
    socket.on("respawnPlanet", respawnPlanet);
    socket.on("newWorldObjectSync", newWorldObjectSync);
    socket.on("syncItem", syncItem);
    socket.on('shopUpgrade', shopUpgrade);
    socket.on('cloak', cloak);

    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);
}

//Receive Data Functions
function setupLocalWorld(data){

    worldId = data.worldId;
    clientId = socket.io.engine.id;

    gridSize = data.gridSize;
    gridBoxScale = data.gridBoxScale;

    //Set Temporary GridPosition for spectating while not in game
    gridPos = new Vector(data.x + gridSize / -2, data.y + gridSize / -2);

    //Spawn other players
    otherPlayers = [];

    for(var i = 0; i < data.existingPlayers.length; i++){
        client = data.existingPlayers[i];

        if(client.id != clientId){
            var player = new NetworkSpaceShip(client.x, client.y, client.maxHealth, client.health, 0, client.level, client.radius, client.username, client.id);
            if(client.shipTurret){

                var isFacade = player.id != clientId;

                player.turret = new Turret(player, client.x, client.y, 0, client.shipTurret.level - 1, isFacade, player.id, client.shipTurret.id);
                player.turret.distanceFromPlanet = 0;
                player.turret.headDistanceFromBase = 0;
                player.turret.type = "shipTurretBase";
            }        

            otherPlayers.push(player);
        }
        
    }

    //Spawn World Objects
    worldObjects = {asteroids: [], planets: [], shops: []};// = data.worldObjects;

    //Shops
    for(var i = 0; i < data.worldObjects.shops.length; i++){

        var shop = data.worldObjects.shops[i];

        var shopObject = new Shop(shop.x, shop.y, shop.radius, shop.upgradeType);
        worldObjects.shops.push(shopObject);
    }


    //asteroids
    for(var i = 0; i < data.worldObjects.asteroids.length; i++){

        var asteroid = data.worldObjects.asteroids[i];

        if(!asteroid || asteroid.health <= 0)
            continue;

        var asteroidObject = new SpaceMatter(asteroid.x, asteroid.y, asteroid.radius, asteroid.color, asteroid.maxHealth, asteroid.health, asteroid.type, asteroid.id);
        worldObjects.asteroids.push(asteroidObject);
        dropDict[asteroid.id] = asteroid.drops;
    }

    //Planets
    for(let i = 0; i < data.worldObjects.planets.length; i++){

        var planet = data.worldObjects.planets[i];

        if(!planet || planet.health <= 0)
            continue;

        var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, planet.id);
        planetObject.occupiedBy = planet.occupiedBy;
        planetObject.owner = planet.owner; 

        //Add all existing structures
        for (var s = 0; s < planet.structures.length; s++) {
            const structure = planet.structures[s];
            var isFacade = structure.ownerId != clientId;
            planetObject.addStructure(planetObject, structure.x, structure.y, structure.rotation, structure.type, structure.level, isFacade, structure.ownerId, structure.id);
        }

        worldObjects.planets.push(planetObject);
        dropDict[planetObject.id] = planet.drops;
    }

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();

    socket.emit('upgradeInfo');
}
function syncItem(data){
    playerItems[data.item] = data.amount;
}
function newWorldObjectSync(data){
    
    if(data.newObject.type == "planet"){

        var changedPlanet = findObjectWithId(worldObjects.planets, data.id);
        var ownedPlanet = findObjectWithId(ownedPlanets, data.id);

        if(currentPlanet && data.id == currentPlanet.id){
            currentPlanet = null;
            landed = false;
        }

        if(ownedPlanet){
            ownedPlanet.object.structures = [];
            allStructures = getAllStructures();
            ownedPlanets.splice(ownedPlanet.index, 1);
        }

        if(data.dead && changedPlanet){

            worldObjects.planets.splice(changedPlanet.index, 1);
            delete hittableObjects[data.id];
        }
        else{
            var planet = data.newObject;
            var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, data.id);
              
            planetObject.owner = planet.owner;

            if(changedPlanet)
                worldObjects.planets[changedPlanet.index] = planetObject;
            else
                worldObjects.planets.push(planetObject);
        }
    }
    else{

        var changedSpaceMatter = findObjectWithId(worldObjects.asteroids, data.id);

        if(data.dead && changedSpaceMatter)
        {
            worldObjects.asteroids.splice(changedSpaceMatter.index, 1);
            delete hittableObjects[data.id];
        }
        else{
            var newSpaceMatter = new SpaceMatter(data.newObject.x, data.newObject.y, data.newObject.radius, data.newObject.color, data.newObject.maxHealth, data.newObject.health, data.newObject.type, data.id);

            if(changedSpaceMatter)
                worldObjects.asteroids[changedSpaceMatter.index] = newSpaceMatter;
            else
                worldObjects.asteroids.push(newSpaceMatter);
        }

    }

    allWorldObjects = getAllWorldObjects();
}
function receiveDamageSync(data){

    for (let i = 0; i < data.deadObjects.length; i++) {
        var localObj = hittableObjects[data.deadObjects[i]];

        if(localObj)
            delete hittableObjects[data.deadObjects[i]];
    }

    for (var id in data.hittableObjects) {
        if (data.hittableObjects.hasOwnProperty(id)) {
        
            var hittableObject = data.hittableObjects[id];

            if(hittableObject.health < healthDict[hittableObject.id]){            
                var ownPlanetAttacked = false;
    
                ownedPlanets.forEach(ownedPlanet => {
                    if(ownedPlanet.shield && ownedPlanet.shield.id == hittableObject.id)
                        damagedOwnPlanet(true, hittableObject.health, ownedPlanet.shield.id);
                    else if(ownedPlanet.id == hittableObject.id)
                        damagedOwnPlanet(false, hittableObject.health, ownedPlanet.id);
                });
            }
            
            healthDict[hittableObject.id] = hittableObject.health;
    
            if(clientId != hittableObject.id){
                var localObj = hittableObjects[hittableObject.id];
    
                if(localObj){
                    if(hittableObject.health > 0)
                        hittableObjects[hittableObject.id] = hittableObject;
                    else
                    {
                        delete hittableObjects[hittableObject.id];
    
                        var isStructure = false;
    
                        for (let i = 0; i < structureUpgradeables.length; i++) {
                            if(structureUpgradeables[i] == hittableObject.id){
                                structureUpgradeables.splice(i, 1);
                                isStructure = true;
                            }
                        }
                    }
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

    var ownedPlanet = findObjectWithId(ownedPlanets, id.object);

    if(attackOnShield)
        console.log("HALP WE ARE UNDER ATTACK. Shield Health Left: " + health);
    else
        console.log("HALP WE ARE UNDER ATTACK. Health Left: " + health);

    attackedPlanets[id] = true;
    
}

function showWorld(){

    imageArray.forEach(image => {
        getImage(image);
    });

    if(requestAnimationFrameId){
        location.reload();
    }
    
    animate();
}
function startLocalPlayer(data){

    var player = data.player;

    upgradeables.push(clientId);
    friendlyObjectIds = [clientId];

    //Spawn client player
    spaceShip = new SpaceShip(centerX, centerY, player.maxHealth, player.health, player.level, player.radius, player.speed, player.turningSpeed, player.fireRate, player.projectileSpeed, clientId);
    spaceShip.shopUpgrades = player.shopUpgrades;
    
    playerItems = {};
    allWorldObjects = getAllWorldObjects();

    if(data.planet)
    {
        var localPlanet = findObjectWithId(worldObjects.planets, data.planet);

        if(localPlanet)
        {
            currentPlanet = localPlanet.object;
            closestAvailablePlanet = null;
            landed = false;
            gridPos = new Vector(currentPlanet.coordX * -1, currentPlanet.coordY * -1);
            
            var newOwnedPlanets = [];

            ownedPlanets.forEach(planet => {
                planetObject = findObjectWithId(worldObjects.planets, planet.id);
                if(planetObject){
                    newOwnedPlanets.push(planetObject.object);
                    friendlyObjectIds.push(planetObject.object.id);

                    if(planetObject.object.shield)
                        friendlyObjectIds.push(planetObject.object.shield.id);
                }
            });

            
            ownedPlanets = newOwnedPlanets;

        }
    }
    else{
        gridPos = new Vector(player.x + gridSize / -2, player.y + gridSize / -2);
    }

}
function newPlayer(data){
    otherPlayers.push(new NetworkSpaceShip(data.x, data.y, data.maxHealth, data.health, data.rotation, data.level, data.radius, data.username, data.id));
}

var respawnCounter = 0;
var respawnInterval;

function respawnPlanet(){
    scale = 1;
    spaceShip = null;
    shopOpen = {shopRef: null, type: null, open: false};
    upgradeables = [];

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
    upgradeables = [];
    structureUpgradeables = [];
    ownedPlanets = [];
    shopOpen = {shopRef: null, type: null, open: false};

    caughtInBlackHole = false;

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();

    $("#preGameContent").fadeIn();
    $("canvas").css("filter", "blur(5px)");
    $('#playerNameInput').removeAttr("disabled");
    
}
function updatePlayerPosition(data){
    otherPlayer = findObjectWithId(otherPlayers, data.id);

    if(otherPlayer){
        var otherPlayerObj = otherPlayer.object;

        otherPlayerObj.coordX = data.x;
        otherPlayerObj.coordY = data.y;
        otherPlayerObj.targetRotation = data.rot;
    }
}
function spawnNetworkedProjectile(data){
    otherProjectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, data.bulletPenetration, true, data.id));
}
function destroyNetworkedProjectile(data){
    var deadProjOther = findObjectWithId(otherProjectiles, data.id);
    var deadProjOwn = findObjectWithId(projectiles, data.id);

    if(deadProjOther)
        otherProjectiles.splice(deadProjOther.index, 1);
    else if(deadProjOwn)
        projectiles.splice(deadProjOwn.index, 1);
}
function updatePlanetOccupier(data){
     worldObjects.planets.forEach(planet => {
        if(planet.id == data.planetId)
            planet.occupiedBy = data.playerId;
    });
}
function spawnNetworkedStructure(data)
{
    planet = findObjectWithId(worldObjects.planets, data.planetId)

    if(planet)
        planet.object.addStructure(planet.object, data.x, data.y, data.rotation, data.type, data.level, data.isFacade, data.ownerId, data.id);

    if(data.ownerId == clientId){
        for (var cost in data.costs) {
            if (data.costs.hasOwnProperty(cost)) {
                playerItems[cost] -= data.costs[cost];
            }
        }
    }

    allStructures = getAllStructures();
}
function receiveUpgradeInfo(data){
    structureUpgrades = data.structureUpgrades;
    playerUpgrades = data.playerUpgrades;
    shopUpgrades = data.shopUpgrades;
}
function returnMsg(data){
    displayMessage(data, 35, 5);
}
function upgradeSync(data){

    var allUpgradeables = allStructures.concat(allPlayers);

    upgradedObject = findObjectWithId(allUpgradeables, data.id).object;

    upgradedObject.level = data.level;

    for (var property in data.upgrade) {
        if (data.upgrade.hasOwnProperty(property)) {

            if(property == "maxHealth"){
                var precent = upgradedObject["health"] / upgradedObject[property];

                upgradedObject[property] = data.upgrade[property];
                upgradedObject["health"] = precent * data.upgrade[property];
            }
            else
                upgradedObject[property] = data.upgrade[property];
        }
    }

    if(data.playerId == clientId){
        for (var cost in data.costs) {
            if (data.costs.hasOwnProperty(cost)) {
                playerItems[cost] -= data.costs[cost];
            }
        }
    }
}
function shopUpgrade(data){

    var player = findObjectWithId(otherPlayers.concat(spaceShip), data.playerId).object;

    var isLocalPlayer = data.playerId == clientId

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

        if(localMine && localMine.object.planet.powered)
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
            if(playerItems[drop])
                playerItems[drop] += data.drops[drop];
            else
                playerItems[drop] = data.drops[drop];

            aquiredItems[drop] = {amount: data.drops[drop], time: aquireItemsFadeTime};
        }
    } 
}

function cloak(data){
    var player = findObjectWithId(otherPlayers.concat(spaceShip), data.playerId);
    var hittablePlayer = hittableObjects[data.playerId]

    if(player){

        player = player.object;

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
function playerExited(data){

    otherPlayer = findObjectWithId(otherPlayers, data.clientId);

    if(otherPlayer){

        worldObjects.planets.forEach(planet => {
            if(planet.occupiedBy == data.clientId)
                planet.occupiedBy = null;
        });

        otherPlayers.splice(otherPlayer.index, 1);

        var otherPlayerHittableObj = hittableObjects[data.clientId];

        if(otherPlayerHittableObj)
            delete hittableObjects[data.clientId];


        if(data.forGood)
        {
            var structureObejcts = [];
    
            allStructures.forEach(structure => {
                data.structureIds.forEach(id => {
                    if(id == structure.id){
                        planet = findObjectWithId(worldObjects.planets, structure.planet.id);
                        planet.object.owner = null;
                        planetStructureIndex = findObjectWithId(planet.object.structures, structure.id).index;
                        planet.object.structures.splice(planetStructureIndex, 1);
                    }
                });
            });
    
            allStructures = getAllStructures();
        }
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
function sendProjectileHit(projectileId, subjectId){
    var data = {
        id: subjectId,
        projectileId: projectileId,
        worldId: worldId
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
        if(e.keyCode == 104) // H
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
                case 108 : // L
                    requestStructureSpawn("landingPad");
                    break;
                case 115: // S
                    requestStructureSpawn("shield");
                    break;
                case 109: // M
                    requestStructureSpawn("mine");
                    break;
                case 116: // T
                    requestStructureSpawn("turret");
                    break;
                case 101: // E
                    requestStructureSpawn("electricity");
                    break;
                case 113: // Q
                    requestStructureSpawn("satellite");
                    break;
            }
        }
        
        
        if(e.keyCode == 32){ //SPACE
            socket.emit('planetOccupancy', {planetId: currentPlanet.id, playerId: null, worldId: worldId})

            currentPlanet.occupiedBy = null;
                
            landed = false;
            currentPlanet = null;

            checklist.landingPad.isActive = false;
            checklist.structures.isActive = false;

        }
    }
    else if(spaceShip){

        if(e.keyCode == 99 && !cloaked && cloakCoolDownTime >= cloakCoolDown) //C
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

        if(e.keyCode == 104) // H
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
                    shoot(-gridPos.x, -gridPos.y, spaceShip.rotation, spaceShip.projectileSpeed, spaceShip.radius / 4, spaceShip.shopUpgrades.bulletPenetration.value + 1, "#f45c42", clientId, 1 - playerReloadTimer / 1000);
                    shootCooldownTimer = 0;
                    playerReloadTimer = 1000;
                }
            }
            

            isHoldingShoot = true;
            
        } 
        if(e.keyCode == 106 && closestAvailablePlanet != null){ // J

            socket.emit('planetOccupancy', {planetId: closestAvailablePlanet.id, playerId: clientId, worldId: worldId})

            currentPlanet = closestAvailablePlanet;
            currentPlanet.occupiedBy = clientId;
            closestAvailablePlanet = null;

            if(playerHasResources(structureUpgrades["landingPad"][0].costs) && !ownedPlanets.contains(currentPlanet.id) && !checklist.landingPad.done)
            {
                checklist.landingPad.isActive = true;
            }

        } 
    }
    
    if(!showUpgradesPannel && !clickedUpgrade)
        showUpgradesPannel = e.keyCode == 102; //F


    if(e.keyCode == 59) // ;
        statsView = !statsView; 
    

}).keyup(function(e){

    showUpgradesPannel = false;
    clickedUpgrade = false;
});

$(document).on('keydown', function(e){
    
    if(spaceShip){

        if(shopOpen)
        {
            if(e.keyCode == 27){ // Escape
                shopOpen.open = false;
            }
        }

        if(e.keyCode == 83 && !currentPlanet){ // S

            if(!shopOpen.open){
                var shopInRange = false;

                worldObjects.shops.forEach(shop => {
    
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

function requestStructureSpawn(type){

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
        worldId: worldId
    }

    socket.emit("requestSpawnStructure", spawnData)
}

//------------------------------------------------------- Constructor Objects  ------------------------------------------------------
function Planet(coordX, coordY, radius, color, health, maxHealth, id){
    this.x;
    this.y;
    this.radius = radius;
    this.color = color;
    this.maxHealth = maxHealth;
    this.health = health;
    this.id = id;
    
    this.coordX = coordX;
    this.coordY = coordY;

    this.occupiedBy;
    this.owner;
    this.structures = [];

    this.shield = null;
    this.landingPad = null;

    this.powered = false;

    var healthBarWidth = 100;

    this.draw = function(){
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        c.fillStyle = this.color;
        c.fill();
        
        c.beginPath();
        c.arc(this.x, this.y, this.radius - 20, 0, Math.PI * 2, false);
        c.fillStyle = shadeColorHex(this.color, 10);
        c.fill();
    }
    this.update = function(){
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y


        var powerAvailable = 0;
        var powerNeeded = 0;

        this.structures.forEach(structure => {

            if(structure.type == "landingPad")
                return;

            if(structure.type == "electricity")
                powerAvailable += structure.power;
            else
                powerNeeded += structure.level + 1;
        });

        this.powered = powerAvailable >= powerNeeded;

        this.draw();
        this.updateStructures();

        if(!this.powered && this.owner == clientId)
        {
            var powerlessStructures = this.structures;

            powerlessStructures.forEach(structure => {

                if(structure.type == "landingPad" || structure.type == "electricity")
                    return;

                var size = 30;
                var distanceAboveStructure = size + 20;
                var distanceToStructure = Math.sqrt(Math.pow(this.x - structure.x, 2) + Math.pow(this.y - structure.y, 2));
                var hyp = distanceToStructure + distanceAboveStructure;
                var scalar = hyp / distanceToStructure * -1;

                var powerX = (this.x - structure.x) * scalar + this.x;
                var powerY = (this.y - structure.y) * scalar + this.y;

                if(electricityTimer.on)
                {
                    c.translate(powerX, powerY);
                    c.rotate((structure.rotation - 90) / -57.2958);
                    c.drawImage(getImage('charge'), -size / 2, -size / 2, size, size);
                    c.rotate(-(structure.rotation - 90) / -57.2958);
                    c.translate(-powerX, -powerY);
                }
            });

            if(electricityTimer.time < electricityTimer.duration)
                electricityTimer.time++;
            else
            {
                electricityTimer.time = 0;
                electricityTimer.on = !electricityTimer.on;
            }
            
        }

        healthBarWidth = 200;

        if(this.health != this.maxHealth)
        displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, healthBarWidth, 20, this.health / this.maxHealth, "green");
    }

    this.updateStructures = function(){
        for(var i = 0; i < this.structures.length; i++){
            if(this.powered)
                this.structures[i].update();
            else
            {
                if((this.structures[i].isFacade != null && !this.structures[i].isFacade))
                {
                    this.structures[i].isFacade = true;
                    this.structures[i].update();
                    this.structures[i].isFacade = false;
                }
                else if(this.structures[i].isFacade == undefined)
                    this.structures[i].update();
                    
            }
        } 
    }

    this.addStructure = function (planet, x, y, rotation, type, level, isFacade, ownerId, id){
        var shieldRadius = this.radius + 100;

        if(!isFacade)
        {
            if(checklist.landingPad.isActive && !checklist.landingPad.done)
            {
                checklist.landingPad.done = true;
                checklist.structures.isActive = true;
            }
            else
                checklist.structures.done = true;
        }

        if(type === "electricity"){
            var electricity = new Electricity(planet, x, y, rotation, level, ownerId, id);
            this.structures.push(electricity);
        }
        else if(type === "satellite"){
            var satellite = new Satellite(planet, x, y, rotation, level, ownerId, id);
            this.structures.push(satellite);
        }
        else if(type === "mine"){
            var mine = new Mine(planet, x, y, rotation, level, ownerId, id);
            this.structures.push(mine);

            if(!isFacade)
                producingMines.push(mine);
        }
        else if(type === "turret"){
            this.structures.push(new Turret(planet, x, y, rotation, level, isFacade, ownerId, id));
        }
        else if(type === "shield"){
            var shield = new Shield(planet, x, y, rotation, level, ownerId, id);
            this.shield = shield;
            this.structures.push(shield);

            if(!isFacade)
                friendlyObjectIds.push(id);
        }
        else if(type === "landingPad"){
            var landingPad = new LandingPad(planet, this.radius - 100, id);
            this.landingPad = landingPad
            this.structures.push(landingPad);
            this.owner = ownerId;
            
            if(!isFacade){
                friendlyObjectIds.push(planet.id);
                ownedPlanets.push(planet);
            }
        }
    }
}

function Shield(planet, x, y, rotation, level, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "shield";

    this.color = "#287aff"

    this.coordX = x;
    this.coordY = y;

    var healthBarWidth = 300;

    var addedShieldRadius = 100;

    this.draw = function(context){

        var ctx = c;
        if(context != null)
            ctx = context;    


        //Draw Shield
        if(planet.powered)
        {
            ctx.beginPath();
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 10;
            ctx.arc(this.planet.x, this.planet.y, this.planet.radius + addedShieldRadius+ c.lineWidth / 2, 0, Math.PI * 2, false);
            ctx.strokeStyle = this.color;
            ctx.stroke();
    
            ctx.globalAlpha = 0.1;
            ctx.beginPath();
            ctx.arc(this.planet.x, this.planet.y, this.planet.radius + addedShieldRadius, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        //Draw Generators
        var ctx = c;
        if(context != null)
            ctx = context;    


        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation - 90) / -57.2958);
        ctx.drawImage(getImage('shieldGenerator' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();

        // ctx.save();
        // ctx.translate(this.planet.x + (this.planet.x - this.x), this.planet.y + (this.planet.y - this.y));
        // ctx.rotate((this.rotation + 90) / -57.2958);
        // ctx.drawImage(getImage('shieldGenerator' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        // ctx.restore();

        var hittableObj = hittableObjects[this.id];
        if(hittableObj)
            displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, 300, 20, hittableObj.health / hittableObj.maxHealth, this.color);
    }
    this.update = function(){

        var pos = cordsToScreenPos(this.coordX, this.coordY);

        this.x = pos.x;
        this.y = pos.y;

        if(this.health <= 0){
            this.planet.structures.splice(findObjectWithId(this.planet.structures, this.id).index, 1);
            this.planet.shield = null;
            return;
        }

        this.draw();
    }
    
}
function LandingPad(planet, radius, id){
    this.planet = planet;
    this.x;
    this.y;
    this.radius = radius;
    this.id = id;
    this.type = "landingPad";
    this.level = 0;

    this.draw = function(context){

        var ctx = c;
        if(context != null)
            ctx = context;    

        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.arc(this.x, this.y, this.radius + c.lineWidth / 2, 0, Math.PI * 2, false);
        ctx.strokeStyle = "gray";
        ctx.stroke();

        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        ctx.fillStyle = "darkGray";
        ctx.fill();
    }
    this.update = function(){
        
        var pos = cordsToScreenPos(this.planet.coordX, this.planet.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.draw();
    }
}
function Mine(planet, x, y, rotation, level, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "mine";

    this.coordX = x;
    this.coordY = y;

    this.level = level;

    this.draw = function(context){

        var ctx = c;
        if(context != null)
            ctx = context;    

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation - 90) / -57.2958);
        ctx.drawImage(getImage('mine' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
    this.update = function(){ 
        
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.draw();
    }
    this.productionEffect = function(cost){
        //console.log(cost);
    }
}
function Electricity(planet, x, y, rotation, level, ownerId, id){

    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "electricity";

    this.power = 0;

    this.coordX = x;
    this.coordY = y;

    this.level = level;

    this.draw = function(context){

        var ctx = c;
        if(context != null)
            ctx = context;    

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation - 90) / -57.2958);
        ctx.drawImage(getImage('electricity' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }

    this.update = function(){ 
        
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.draw();
    }

}
function Satellite(planet, x, y, rotation, level, ownerId, id){

    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "satellite";

    this.distance = 150;

    this.coordX = x;
    this.coordY = y;

    this.level = level;

    this.draw = function(context){

        var ctx = c;
        if(context != null)
            ctx = context;    

        this.x = (this.planet.x + (this.planet.radius + this.distance) * Math.cos(-this.rotation*Math.PI/180));
        this.y = (this.planet.y + (this.planet.radius + this.distance) * Math.sin(-this.rotation*Math.PI/180));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation - 90) / -57.2958);
        ctx.drawImage(getImage('satellite' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }

    this.update = function(){ 
        
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.rotation += .1;

        this.draw();
    }

}
function Turret(planet, x, y, rotation, level, isFacade, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.headRotation = 0;
    this.size = 50;
    this.headLength = 40;
    this.headWidth = 10;
    this.type = "turret";
    this.isFacade = isFacade;
    this.ownerId = ownerId;
    this.id = id;

    this.coordX = x;
    this.coordY = y;

    this.shootRotation;
    this.headDistanceFromBase = 10;
    this.bulletRange = 10;
    this.range;
    this.target;

    this.level = level;

    this.shootInterval = 100;
    this.shootCounter = 0;
    this.projectileSpeed = 5;
    this.projectileSize = 5;

    this.shootPoint = new Vector();

    this.draw = function(context){

        var ctx = c;

        if(context != null)
            ctx = context;

        if(ctx == c)
        {

            var l = this.x - this.planet.x;
            var h = this.y - this.planet.y;

            var hyp = this.planet.radius;

            var cx = hyp + this.headDistanceFromBase;

            var x = l * (cx / hyp);
            var y = h * (cx / hyp);

            var headX = this.planet.x + x;
            var headY = this.planet.y + y;

            this.shootPoint = new Vector(headX, headY);
            this.shootRotation = 0;

       

            //Draw Head
            if(this.target)
            {
                var playerPos = cordsToScreenPos(this.target.coordX, this.target.coordY);

                this.shootRotation = Math.atan2(playerPos.y - headY, playerPos.x - headX);
                this.headRotation = this.shootRotation * 180 / Math.PI;
            }
            else{
                this.shootRotation = this.rotation * - Math.PI / 180;
                this.headRotation = this.shootRotation * 180 / Math.PI;
            }

            ctx.save();
            ctx.translate(headX, headY);
            ctx.rotate(this.shootRotation);
            ctx.fillStyle = planetColors[1];
            ctx.fillRect(-this.headLength / 2 + this.headLength / 4, -this.headWidth / 2, this.headLength, this.headWidth);
            ctx.restore();

        }

        //Draw Base
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation - 90) / -57.2958);
        ctx.drawImage(getImage(this.type + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
    this.update = function(){

        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.range = this.bulletRange * 100;

        this.updateTarget();

        this.draw();
         if(this.target && !this.isFacade){
            this.shootCounter += 1;

            if(this.shootCounter >= this.shootInterval){
                this.shootCounter = 0;

                var spawnPos = screenPosToCords(this.shootPoint.x, this.shootPoint.y);
                shoot(spawnPos.x, spawnPos.y, this.shootRotation + Math.PI / 180 * 90, this.projectileSpeed, this.projectileSize, this.bulletPenetration, "#f45c42", this.id);
            }
        }
    }
    this.updateTarget = function(){
        this.target = null;

        for(var i = 0; i < allPlayers.length; i++){

            player = allPlayers[i];
            
            if(player.id == ownerId || player.alpha < 1)
                continue;

            var playerPos = cordsToScreenPos(player.coordX, player.coordY);

            var distance = Math.sqrt(Math.pow(this.x - playerPos.x, 2) + Math.pow(this.y - playerPos.y, 2));

            if(this.target != null){
                var targetScreenPosition = cordsToScreenPos(this.target.coordX, this.target.coordY);
    
                var targetDistance = Math.sqrt(Math.pow(this.x - targetScreenPosition.x, 2) + Math.pow(this.y - targetScreenPosition.y, 2));
    
                if(distance < targetDistance && distance <= this.range)
                    this.target = player;
            }
            else if(distance <= this.range)
                this.target = player;
        }
    }



}

function Projectile(x, y, velocity, radius, color, hitsLeft, facade, id){
    this.pos = new Vector(0, 0);
    this.radius = radius;
    this.vel = velocity;
    this.id = id;
    this.color = color;
    this.hitObjects = [];

    this.hitsLeft = hitsLeft;
    this.facade = facade;
    this.hitAnimDuration = 5;
    this.hitAnimTime = this.hitAnimDuration;
    this.coord = new Vector(x, y);

    this.draw = function(){

        var color = shadeColorHex(this.color, 100 - this.hitAnimTime / this.hitAnimDuration * 100);

        c.fillStyle = color;
        c.beginPath();
        c.shadowBlur = 20;
        c.shadowColor = color;
        c.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2, false);
        c.fill();
        c.shadowBlur = 0;
    }
    this.update = function(){

        this.coord.add(this.vel);
        var localPos = cordsToScreenPos(this.coord.x, this.coord.y);

        this.pos = localPos;
        
        if(this.hitAnimTime < this.hitAnimDuration){
            this.hitAnimTime++;
        }

        if(!this.facade){
            if(this.checkForCollisions()){
                this.hitAnimTime = 0;
                this.hitsLeft--;
    
                if(this.hitsLeft <= 0)
                    return;
            }
        }
        
        this.draw();
    }

    this.checkForCollisions = function(){   //Check for collisions in Hittable Objects
        for (var id in hittableObjects) {
            if (hittableObjects.hasOwnProperty(id)) {

                var hittableObj = hittableObjects[id];

                if(this.isFriendly(hittableObj.id) || this.hitObjects.contains(hittableObj.id) || !hittableObj.active)
                    continue;

                var pos = cordsToScreenPos(hittableObj.x, hittableObj.y);
                var hitObject = {x: pos.x, y: pos.y, radius: hittableObj.radius} 

                if(isCollidingCircles(this, hitObject)){

                    var hitWorldObject = findObjectWithId(allWorldObjects, id);

                    if(hitWorldObject && hitWorldObject.object.type == "blackHole")
                        return;

                    sendProjectileHit(this.id, id);


                    if(hitWorldObject)
                    {
                        var colorRef = colorChangedHitObjects[id];

                        if(colorRef) //color is currently changing
                        {
                            colorRef.time = 20;
                        }
                        else{
                            colorChangedHitObjects[id] = {color: hitWorldObject.object.color, time: 20};
                        }   
                    }

                    this.hitObjects.push(id);
                    return true;
                }
            }
        }

        return false;
    }
    
    this.isFriendly = function(id){
        if(!friendlyObjectIds)
            return false;

        for(var i = 0; i < friendlyObjectIds.length; i++){
            if(id === friendlyObjectIds[i])
                return true;
        }

        return false;
    }
}
function FacadeProjectile(x, y, velocity, size, color, id){
    this.pos = new Vector(x, y);
    this.size = size;
    this.vel = velocity;
    this.color = color;
    this.id = id;

    this.draw = function(){
        c.fillStyle = this.color;
        c.beginPath();
        c.shadowBlur = 20;
        c.shadowColor = color;
        c.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2, false);
        c.fill();

        c.shadowBlur = 0;
    }
    this.update = function(){
        this.pos.add(this.vel);
        this.draw();
    }
}

function isCollidingCircles(projectile, subject) {
    a = projectile.pos.x - subject.x;
    b = projectile.pos.y - subject.y;
    var distance = Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2));

    return(distance < projectile.radius + subject.radius);
}
function SpaceMatter(coordX, coordY, radius, color, maxHealth, health, type, id){
    this.x;
    this.y;
    this.radius = radius;
    this.color = color;
    this.maxHealth = maxHealth;
    this.health = health;
    this.type = type;
    this.id = id;

    this.coordX = coordX;
    this.coordY = coordY;

    this.draw = function(){

        var healthBarWidth = 30;
        var healthBarHeight = 5;

        var yOffset = -10;

        switch(this.type)
        {
            case "crystal":
                c.beginPath();
                spikyBall(c, this.x, this.y, this.radius, 20, 0, -Math.PI/2, .75);
                c.fillStyle = this.color;
                c.fill();

                c.beginPath();
                spikyBall(c, this.x, this.y, this.radius - 5, 20, 0, -Math.PI/2, .75);
                c.fillStyle = shadeColorHex(this.color, 10);
                c.fill();
            break;
            case "asteroid":
                c.fillStyle = this.color;
                c.beginPath();
                c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                c.fill();

                c.beginPath();
                c.fillStyle = shadeColorHex(this.color, 10);
                c.arc(this.x, this.y, this.radius - 4, 0, Math.PI * 2, false);
                c.fill();
            break;
            case "sun":
                c.shadowBlur = 200 * scale;
                c.shadowColor = this.color;

                c.fillStyle = this.color;
                c.beginPath();
                c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                c.fill();
        
                c.beginPath();
                c.arc(this.x, this.y, this.radius - 4, 0, Math.PI * 2, false);
                c.fillStyle = shadeColorHex(this.color, 10);
                c.fill();

                c.shadowBlur = 0;
            break;
            case "moon":

                c.fillStyle = this.color;
                c.beginPath();
                c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                c.fill();

                c.beginPath();
                polygon(c, this.x, this.y, this.radius - 15, 6, this.radius * Math.PI / 180, -Math.PI/2);
                c.fillStyle = shadeColorHex(this.color, 10);
                c.fill();
            break;  
            case "blackHole":
                c.shadowBlur = 100 * scale;
                c.shadowColor = "white";

                c.fillStyle = "white";
                c.beginPath();
                c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
                c.fill();

                c.shadowBlur = 0;

                c.beginPath();
                c.fillStyle = this.color;
                c.arc(this.x, this.y, this.radius - 1, 0, Math.PI * 2, false);
                c.fill();
            break;
        }

        if(this.health != this.maxHealth)
            displayBar(this.x - healthBarWidth / 2, this.y - this.radius + yOffset, healthBarWidth, healthBarHeight, this.health / this.maxHealth, "#36a52c");

    }
    this.update = function(){
        var pos = cordsToScreenPos(this.coordX, this.coordY);

        this.x = pos.x;
        this.y = pos.y;
        this.draw();
    }
}
function SpaceShip(x, y, maxHealth, health, level, radius, speed, turningSpeed, fireRate, projectileSpeed, id){
    this.coordX = x;
    this.coordY = y;
    this.rotation = 0;
    this.radius = radius;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.speed = speed;
    this.fireRate = fireRate;
    this.turningSpeed = turningSpeed;
    this.projectileSpeed = projectileSpeed;
    this.level = level;
    this.id = id;

    this.alpha = 1;

    this.turret;

    this.oxygenRemaining;

    this.shopUpgrades = {
        bulletPenetration: {
            level: 0,
            value: 0
        },
        cloakTime: {
            level: 0,
            value: 0
        },
        boost: {
            level: 0,
            value: 0
        },
        shipTurret: {
            level: 0,
            value: 0
        }
    }

    this.level = level;

    this.draw = function(){

        var mouseRad = Math.atan2(mouse.y - centerY, mouse.x - centerX) + 90 * Math.PI / 180;
        
        var rad = this.rotation + shortAngleDist(this.rotation, mouseRad) * this.turningSpeed;

        c.globalAlpha = this.alpha;
        c.translate(centerX, centerY);
        c.rotate(rad);
        c.drawImage(getImage('spaceship' + this.level), -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.rotate(-rad);
        c.translate(-centerX, -centerY);
        c.globalAlpha = 1;
        this.rotation = rad;
    }
    this.update = function(){
        this.draw();

        if(this.oxygen)
            this.doOxygen();

        if(this.turret){
            var pos = screenPosToCords(centerX, centerY);
            this.turret.size = this.radius / 2;
            this.turret.headWidth =  this.radius / 6;
            this.turret.headLength =  this.radius / 2;

            this.turret.rotation = (this.rotation * -180 /  Math.PI) + 90;
            this.turret.coordX = pos.x;
            this.turret.coordY = pos.y;

            if(this.alpha < 1)
            {
                this.turret.shootCounter = 0;
                
            }

            c.globalAlpha = this.alpha;
            this.turret.update();
            c.globalAlpha = 1;
                
        }  
    }
    this.doOxygen = function(){
        if(this.oxygenRemaining == null)
            this.oxygenRemaining = this.oxygen;
        else
        {
            if(!currentPlanet)
                this.oxygenRemaining--;
            else if (this.oxygenRemaining < this.oxygen)
                this.oxygenRemaining++
        }

        displayBar(centerX, centerY, 100, 20,this.oxygenRemaining / this.oxygen, "#a3e1ff");
    }

}

function NetworkSpaceShip(coordX, coordY, maxHealth, health, targetRotation, level, radius, username, id){
    this.x;
    this.y;
    this.maxHealth = maxHealth;
    this.health = health;
    this.targetRotation = targetRotation;
    this.radius = radius;
    this.username = username;
    this.id = id;
    this.level = level;

    this.alpha = 1;

    this.coordX = coordX;
    this.coordY = coordY;

    this.coordChangeWatcher = new Vector();
    this.rotWatcher = 0;

    this.lastCoordX = 0;
    this.lastCoordY = 0;

    this.lastRot = 0;
    this.rotation = 0;
    this.rotLerpTime = 10;
    this.rotLerpAmount = 0;

    this.lerpAmount = 0;
    this.lerpTime = 10;

    this.displayPos = new Vector();

    var jumpDistance = 100000;

    this.turret;

    this.draw = function(){
        var healthBarWidth = 50;

        var testpos = cordsToScreenPos(this.lastCoordX, this.lastCoordY);
        var testpostarget = cordsToScreenPos(this.coordX, this.coordY);

        c.globalAlpha = this.alpha;
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.drawImage(getImage('spaceship' + this.level), -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.rotate(-this.rotation);
        c.translate(-this.x, -this.y);

        if(this.health != this.maxHealth)
            displayBar(this.x - healthBarWidth / 2, this.y - (this.radius + 10), healthBarWidth, 5, this.health / this.maxHealth, "#36a52c");

    }
    this.update = function(){
        var coords = new Vector(this.coordX, this.coordY);
        var lastCoords = new Vector(this.lastCoordX, this.lastCoordY);
        this.displayPos = coords;

        if(this.coordChangeWatcher.x != coords.x && this.coordChangeWatcher.y != coords.y)
        {
            this.lastCoordX = this.coordChangeWatcher.x;
            this.lastCoordY = this.coordChangeWatcher.y;
            lastCoords = new Vector(this.lastCoordX, this.lastCoordY);

            this.lerpTime = this.lerpAmount;
            this.lerpAmount = 0;
            this.coordChangeWatcher = coords;
        }

        if(this.rotWatcher != this.targetRotation)
        {
            this.lastRot = this.rotWatcher;

            this.rotLerpTime = this.rotLerpAmount;
            this.rotLerpAmount = 0;

            this.rotWatcher = this.targetRotation;
        }

        var distance = Math.abs(Math.pow(coords.x - lastCoords.x, 2) + Math.pow(coords.y - lastCoords.y, 2));

        if(distance > jumpDistance)
        {
            this.lastCoordX = coords.x;
            this.lastCoordY = coords.y
            this.displayPos = coords;
        }
        else if (this.lerpAmount <= this.lerpTime) {
            var t = Math.round(this.lerpAmount / this.lerpTime * 100) / 100;
            var subCoord = Vector.prototype.subtract(coords, lastCoords);
            this.displayPos = Vector.prototype.addition(lastCoords, new Vector(subCoord.x * t, subCoord.y * t));
            this.lerpAmount++;
        }
        else if(this.lerpAmount > this.lerpTime){
            this.lerpAmount++;
        }

        if(this.rotLerpAmount <= this.rotLerpTime){
            this.rotLerpAmount++;
            this.rotation = this.lastRot + (this.targetRotation - this.lastRot) * this.rotLerpAmount / this.rotLerpTime;
        }
        else{
            this.rotation = this.targetRotation;
        }
        // else if (this.rotLerpAmount / this.rotLerpTime > 1)
        // this.rotLerpAmount++;

        var pos = cordsToScreenPos(this.displayPos.x, this.displayPos.y);

        this.x = pos.x;
        this.y = pos.y;

        if(this.alpha > 0){
            this.draw();

            //Display username above person
            c.font = "20px Arial";
            c.fillStyle = "white";
            c.globalAlpha = .5;
            c.textAlign = "center"; 
            c.fillText(this.username, this.x, this.y - this.radius - 20);
    
            c.textAlign = "left"; 
            c.globalAlpha = 1;
        }

        if(this.turret){
            this.turret.size = this.radius / 2;
            this.turret.headWidth =  this.radius / 6;
            this.turret.headLength =  this.radius / 2;

            this.turret.rotation = (this.rotation * -180 /  Math.PI) + 90;
            this.turret.coordX = this.coordX;
            this.turret.coordY = this.coordY;

            c.globalAlpha = this.alpha;
            this.turret.update();
            c.globalAlpha = 1;
        }  
    }
}
function Shop(coordX, coordY, radius, upgradeType){
    this.x;
    this.y;
    this.radius = radius;
    this.upgradeType = upgradeType;
    this.coordX = coordX;
    this.coordY = coordY;

    this.isInRange = false;

    this.range = 100;

    this.ringColor = "#59616d";

    this.draw = function(){

        c.strokeStyle = this.ringColor;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        c.stroke();
        c.drawImage(getImage("shop"), this.x - this.radius / 2, this.y - this.radius / 2, this.radius, this.radius); 

        if(this.isInRange){

            var size = windowHeight / scale / 20;

            if(!shopOpen.open)
            {
                c.font = size + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('input#openShop').val(), centerX, (windowHeight - 80) / scale);
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
            else{
                c.font = size + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('input#closeShop').val(), centerX, (windowHeight - 80) / scale);
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
    
        }
    }

    this.update = function(){
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        if(spaceShip){
            if(isCollidingCircles({pos: {x: centerX, y: centerY}, radius: spaceShip.radius}, this))
            {
                this.isInRange = true;
                this.ringColor = "#7693bf"
            }
            else{
                this.isInRange = false;
                this.ringColor = "#59616d";
            }
        }

        this.draw();

        
    }
}

function shortAngleDist(a0,a1) {
    var max = Math.PI*2;
    var da = (a1 - a0) % max;
    return 2*da % max - da;
}

//------------------------------------------------------- ANIMATE ------------------------------------------------------

var time = 0;
var isScaling = true;

function animate() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;

    windowWidth =  $(window).width();
    windowHeight =  $(window).height();

    requestAnimationFrameId = requestAnimationFrame(animate);

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can)) {
            canvases[can].getContext('2d').clearRect(0, 0, innerWidth, innerHeight);
        }
    }

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
    
    if(spaceShip)
        allPlayers = otherPlayers.concat(spaceShip);
    else
        allPlayers = otherPlayers;


    otherPlayers.forEach(player => {
        if(player.displayPos)
        { 
            hittableObjects[player.id].x = player.displayPos.x;
            hittableObjects[player.id].y = player.displayPos.y;
        }
        else if(player.coordX && player.coordY){
            hittableObjects[player.id].x = player.coordX;
            hittableObjects[player.id].y = player.coordY;
        }
    });
    
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
            structureUpgradeables = [];

            if(mouse.clicked || boost){

                if(boost)
                    spaceShip.speed = spaceShip.shopUpgrades["boost"].value + playerUpgrades[spaceShip.level].speed;
                else
                    spaceShip.speed = playerUpgrades[spaceShip.level].speed;


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

        worldObjects.asteroids.forEach(function(spaceMatter){

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

        for(var i = 0; i < allStructures.length; i++){
            allStructures[i].health = healthDict[allStructures[i].id];
        }

        if(!currentPlanet)
            closestAvailablePlanet = findClosestUnoccupiedPlanet();

    }
    else{
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

    //Draw -----------------------------------------------------------------------------------------------------------
    for (var can in canvases) {
        if (canvases.hasOwnProperty(can)) {
            canvases[can].getContext('2d').scale(scale, scale);
        }
    }
    
    drawGrid(gridPos.x + centerX, gridPos.y +  centerY, gridSize, gridSize, gridBoxScale);
    
    var allMatter = allWorldObjects.concat(otherPlayers);

    allMatter.forEach(function(matter){

        var pos = cordsToScreenPos(matter.coordX, matter.coordY);
        var size = matter.radius + 50;

        if(matter.type == "sun"){
            size += 500;
        }

        if(matter.shield)
        {
            size += matter.shield.radius;
        }

        var isClosestAvaiblePlanet = (closestAvailablePlanet != null && (matter.id  == closestAvailablePlanet.id));
        var isOwnedPlanet = findObjectWithId(ownedPlanets, matter.id)

        //Out of screen Right                           || Left             || Up               || Down
        if(isOnScreen(pos.x, pos.y, size) || isClosestAvaiblePlanet || isOwnedPlanet != null){
            matter.health = healthDict[matter.id];
            matter.update();

            var shop = findObjectWithId(worldObjects.shops, matter.id);

            if(!shop)
            {
                var distanceToMouse = Math.sqrt(Math.pow(pos.x - mouse.x, 2) + Math.pow(pos.y - mouse.y, 2));

                if(distanceToMouse <= matter.radius)
                {
                    if(propertiesTimer[matter.id])
                    {
                        if(propertiesTimer[matter.id].time < propertiesHoldTime)
                        {
                            propertiesTimer[matter.id].time++;
                        }
                    }
                    else
                        propertiesTimer[matter.id] = {time: 0, fill: 0};
    
                    
                }
                else{
                    propertiesTimer[matter.id] = {time: 0, fill: 0};
                }
            }
        }
        else{
            propertiesTimer[matter.id] = {time: 0, fill: 0};
        }

    });

    if(spaceShip)
    {
        for (var timer in propertiesTimer) {
            if (propertiesTimer.hasOwnProperty(timer)) {
    
                if(propertiesTimer[clientId] && timer != clientId && propertiesTimer[clientId].time >= propertiesHoldTime)
                    continue;
    
                if(propertiesTimer[timer].time >= propertiesHoldTime){
                    if(propertiesTimer[timer].fill < 1)
                    {
                        propertiesTimer[timer].fill += .05;
                    }
    
                    var matter = findObjectWithId(allMatter, timer);
    
                    if(!matter)
                        delete propertiesTimer[timer];
                    else{
                        propertiesOverview(matter.object, propertiesTimer[timer].fill);
                    }
                    
                }
    
    
            }
        }
    }

    for (var id in hittableObjects) {
        if (hittableObjects.hasOwnProperty(id)) {

            var obj = hittableObjects[id];

            if(obj.radius && statsView && obj.active){
                var pos = cordsToScreenPos(obj.x, obj.y);

                //Out of screen Right                               || Left             || Up               || Down
                if(!(pos.x - size > (windowWidth + centerX) / scale || pos.x + size < 0 || pos.y + size < 0 || pos.y - size > (windowHeight + centerY) / scale) || isClosestAvaiblePlanet || isOwnedPlanet != null){
                    c.beginPath();
                    c.arc(pos.x, pos.y, obj.radius, 0, Math.PI * 2, false);
                    c.lineWidth = 2;
                    c.strokeStyle = "#f44242";
                    c.stroke();
                }
            }
        }
    }

    if(spaceShip){

        if(positionSendTime >= POSITION_SEND_DELAY)
        {
            positionSendTime = 0;
            var playerPos = new Vector(-gridPos.x, -gridPos.y);
            sendPlayerPosition(playerPos, spaceShip.rotation);
        }
        else{
            positionSendTime++;
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
    
    if(spaceShip && ownedPlanets.length > 0){

        //Draw arrows pointing to owned planets
        for (let i = 0; i < ownedPlanets.length; i++) {
            
            const planet = ownedPlanets[i];
            var size = planet.radius;

            if(planet.shield)
                size = planet.shield.radius;

            //Out of screen Right                                           || Left                || Up                  || Down
            if((planet.x + centerX - size > (windowWidth + centerX) / scale || planet.x + size < 0 || planet.y + size < 0 || planet.y + centerY - size > (windowHeight + centerY) / scale)){

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
                    arrowColor = planetArrowFlashColor;
                else
                    arrowColor = "#ffffff";

                drawArrow(arrowPos.x, arrowPos.y, arrowRotation, arrowColor, arrowSize);
            }
        }

    }

    var isInSun = false;
    
    c.scale(1 / scale, 1 / scale);

    if(spaceShip){

        if(currentPlanet){
            if(boughtStructure)
            {
                c.font = windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('input#placeStructue').val() + boughtStructure, windowWidth / 2, (windowHeight - 80));
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
            else{
                c.font = windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('input#takeOff').val(), windowWidth / 2, (windowHeight - 80));
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
           
        }
        else if(!currentPlanet && closestAvailablePlanet){

            var shopInRange = false;

            worldObjects.shops.forEach(shop => {
                if(shop.isInRange)
                    shopInRange = true;
            });

            if(!shopInRange)
            {
                c.font =  windowHeight / 17 + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('input#land').val(), windowWidth / 2, (windowHeight - 80));
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
    }

    worldObjects.asteroids.forEach(spaceMatter => {
        
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

        var checkItemY = windowHeight * .7;
        var checkPadding = windowHeight * .02;

        var width = windowHeight * .3;
        var height = width * .25;

        var yPositions = {};
        var i = 0;
        

        function getCardYPos(index)
        {
            return checkItemY + (checkPadding + height) * index;
        }

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
        
                        wrapText(c, $('input#' + check).val(), windowWidth / 2 - width * checkItem.size / 4, checkItem.yPos + fontsize * 2, width * .6, fontsize);
                    }
                

                    if(!checkItem.done)
                        i++;
                }
            }
        }
        c.globalAlpha = 1;

        
        if(spaceShip.health > 0){

            var xPadding = 10;
            var yPadding = 10;

            displayBar(xPadding, yPadding, 200, 50, spaceShip.health / spaceShip.maxHealth, "#36a52c");
            c.fillStyle = "white";
            displayResources();
            c.font = " 30px Helvetica";
            c.fillText(Math.round(spaceShip.health)+  "/" + Math.round(spaceShip.maxHealth), xPadding + 10, yPadding + 35);  
        }

        if(showUpgradesPannel && !clickedUpgrade)
            showUpgrades();
    
        if(playerDisplayMessage != ""){
            if(playerMessageTimer > 0)
                playerMessageTimer -= 1;
            else if(playerMessageAlpha > 0)
                playerMessageAlpha -= playerMessageFadeSpeed / 100;
            else
                playerDisplayMessage = "";
    
            if(playerMessageAlpha < 0)
                playerMessageAlpha= 0;
    
            c.globalAlpha = playerMessageAlpha;
            c.font = "50px Helvetica";
            c.fillStyle = "White";
            c.textAlign = "center";
            c.fillText(playerDisplayMessage, canvas.width/2, canvas.height/2); 
            c.globalAlpha = 1;
            c.textAlign = "left";
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
                        requestStructureSpawn(boughtStructure);
                        boughtStructure = null;

                        structureSpawnPosition = null;
                        structureSpawnRotation = null;
                    }
                }
            }
            else
            {
                var hoveredStructure = null;

                //Highlight Seleted Structures ----------------------------------------------------

                ownedPlanets.forEach(planet => { 
                    planet.structures.forEach(structure => {
                        
                        var distance = Math.sqrt(Math.pow(mouse.x - structure.x, 2) + Math.pow(mouse.y - structure.y, 2));
                        
                        if(distance < structure.size / 2)
                            hoveredStructure = structure;
                    });
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
                var numYButtons = 4;
                var numXButtons = 2;

                var buttonSizes = Math.sqrt(canvas.height * canvas.width) / 18;
                var padding = Math.sqrt(canvas.height * canvas.width) / 100;

                var selectedStructureImageSize = Math.sqrt(canvas.height * canvas.width) / 9;

                var yVal = canvas.height - (buttonSizes + padding) * numYButtons - padding * 2;
                var xVal = padding;

                //Box Label -----------------------------
                var backgroundWidth = (buttonSizes + padding) * numXButtons + padding;
                var backgroundHeight = (buttonSizes + padding) * numYButtons + padding;

                var cornerRadius = Math.sqrt(canvas.height * canvas.width) / 70;
                var fontsize = Math.sqrt(canvas.height * canvas.width) / 45;
                
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
                c.fillText("Structures", backgroundWidth / 2 + padding, yVal - padding);

                c.globalAlpha = .2;
                c.fillRect(xVal, yVal, backgroundWidth, backgroundHeight);

                //Draw Buttons ------------------------------
                c.globalAlpha = 1;

                var buttonY = yVal;
                var buttonX = xVal;

                var mouseX = mouse.x * scale;
                var mouseY = mouse.y * scale;

                var buttonTypes = ["spaceShip", "landingPad", "mine", "turret", "shield", "electricity", "satellite"];

                var typeI = 0;

                for (let ix = 0; ix < numXButtons; ix++) {

                    for (let iy = 0; iy < numYButtons; iy++) {
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
                    var level = 0;
        
                    if(typeof planetShopSelection == "object")
                    {
                        type = planetShopSelection.type;
                        level = planetShopSelection.level;
                    }
                    else if(type == "spaceShip")
                        level = spaceShip.level;

                    var upgrades = structureUpgrades[type];

                    if(upgrades == undefined)
                        upgrades = playerUpgrades;

                    var pannelWidth = selectedStructureImageSize * 8/7 + padding * 2;
                    var pannelHeight = backgroundHeight;

                    var panelX = xVal + backgroundWidth
                    var panelY = canvas.height - pannelHeight - padding;


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

                    var upperasedType = type.charAt(0).toUpperCase() + type.slice(1);

                    c.fillText(upperasedType, headerX + pannelWidth / 2, yVal - padding);

                    //Background
                    c.globalAlpha = .2;
                    c.fillRect(panelX, panelY, pannelWidth, pannelHeight);

                    //Division Line
                    c.globalAlpha = .5;
                    c.fillRect(panelX - 2, panelY + 10, 4, pannelHeight - 20);

                    //Image
                    c.globalAlpha = 1;

                    var fullyUpgraded = false;
                    var upgrading = typeof planetShopSelection == "object";

                    if(type == "spaceShip")
                    {
                        if(spaceShip.level > 0)
                        {
                            upgrading = true;
                            fullyUpgraded = upgrades[level + 1] == null
                        }
                        else{
                            level = 1;
                        }
                    }

                    if(upgrading)
                        fullyUpgraded = upgrades[level + 1] == null
                    
                    var imageLevel = level;

                    if(upgrading && !fullyUpgraded)
                        imageLevel = level + 1;

                    var imageName = type + imageLevel;

                    if(type == "shield")
                        imageName = "shieldGenerator" + imageLevel;

                    

                    c.drawImage(getImage(imageName), panelX + pannelWidth / 2 - selectedStructureImageSize / 2, panelY + padding, selectedStructureImageSize, selectedStructureImageSize);

                    //Buy / Upgrade button
                    var shopButtonWidth = pannelWidth * 2 / 3;
                    var shopButtonHeight = pannelHeight / 10;

                    var shopButtonX = panelX + pannelWidth / 2 - shopButtonWidth / 2;
                    var shopButtonY = panelY + padding * 2 + selectedStructureImageSize;

                    var label = "Buy";

                    fontsize = Math.sqrt(canvas.height * canvas.width) / 60;

                    if(upgrading)
                    {
                        if(fullyUpgraded){
                            label = "Fully Upgraded";
                            fontsize = Math.sqrt(canvas.height * canvas.width) / 80;
                        }
                        else{
                            label = "Upgrade";
                            upgrading = true;
                        }
                    }
                    if (!fullyUpgraded && mouseY > shopButtonY && mouseY < shopButtonY + shopButtonHeight && mouseX > shopButtonX && mouseX < shopButtonX + shopButtonWidth) {
                        c.fillStyle = "#e2e2e2";

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
                    }
                    else{
                        c.fillStyle = "#ffffff";
                    }

                    c.fillRect(shopButtonX, shopButtonY, shopButtonWidth, shopButtonHeight);

                    c.globalAlpha = .8;
                    c.fillStyle = "black";
                    c.font = "bold " + fontsize + "px Helvetica";
                    c.textAlign = "center";
                    c.fillText(label, shopButtonX + shopButtonWidth / 2, shopButtonY + shopButtonHeight - padding);

                    // Cost
                    if(!fullyUpgraded)
                    {
                        if(upgrading)
                            level++;
                        var upgradeCosts = upgrades[level].costs

                        var costX = panelX + padding;
                        var startCostY = shopButtonY + shopButtonHeight + padding;
                        var costY = startCostY;
                        
                        var costSize = Math.sqrt(canvas.height * canvas.width) / 45;
    
                        if(upgradeCosts){
                            for (var cost in upgradeCosts) {
                                if (upgradeCosts.hasOwnProperty(cost)) {
                                    var color = "white";
    
                                    if(!playerItems[cost] || playerItems[cost] < upgradeCosts[cost])
                                        color = "#ff9696";
                
                                    c.drawImage(getImage(cost), costX, costY, costSize, costSize);
                                    c.font = costSize / 1.5 + "px Helvetica";
                                    c.fillStyle = color;
                                    c.textAlign = "left";
                                    c.fillText(upgradeCosts[cost], costX + costSize + padding, costY + costSize / 1.3);
                    
                                    costY += costSize + padding;
                                }
                            }
                        }
                    }
                    
                    // Description
                    if(typeof planetShopSelection == "string" && !(type == "spaceShip" && level > 0) )
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
                        wrapText(c, $('input#' + type).val(), descBoxX + padding / 2, descBoxY + fontsize + padding / 5, descBoxWidth - padding / 2, fontsize);
                    } 
                }

                c.textAlign = "left";
            }

        }
        
        var miniMapSize = windowHeight / 8;
        var minimapPadding = windowHeight / 60;

        minimap(miniMapSize, windowWidth - miniMapSize - minimapPadding, windowHeight - miniMapSize - minimapPadding);
    
        if(statsView){
            c.font = "20px Arial";
            c.fillText("x: " + Math.round(spaceShip.coordX) + " y: " + Math.round(spaceShip.coordY), 5, canvas.height - 5);
        }
    
        var cloakedBarDisplayed = false;

        if(cloaked)
        {
            cloakedBarDisplayed = true;
            
            var width = canvas.width / 3;
            displayBar(centerX * scale - width / 2, 10, width, 20, (spaceShip.shopUpgrades.cloakTime.value - cloakTime) / spaceShip.shopUpgrades.cloakTime.value, "#77e3ff");

            if(cloakTime < spaceShip.shopUpgrades.cloakTime.value)
                cloakTime += 16;
        }
        else if(cloakCoolDownTime < cloakCoolDown){
            cloakedBarDisplayed = true;

            cloakCoolDownTime++;

            var width = canvas.width / 3;
            displayBar(centerX * scale - width / 2, 10, width, 20, cloakCoolDownTime / cloakCoolDown, "#2fc4a8");
        }

        var boostLegnth = spaceShip.shopUpgrades.boost.value;
        var boostRechargeLegnth = spaceShip.shopUpgrades.boost.value * 6;

        var boostBarY = 10;

        if(cloakedBarDisplayed)
            boostBarY = 40;

        if(boostReady && boostAmount <= boostLegnth)
        {
            if(boostLegnth != boostAmount){
                var width = canvas.width / 3;
                displayBar(centerX * scale - width / 2, boostBarY, width, 20, boostAmount / boostLegnth, "#f9dd6b");
            }

            if(boost){
                if(boostAmount > 0)
                    boostAmount--;
                else{
                    boostReady = false;
                    boost = false;
                    boostAmount = 0;
                }
            }
            
        }
        else if (boostRechargeLegnth > 0 && !boostReady){
            if(boostAmount < boostRechargeLegnth)
                boostAmount++;
            else{
                boostAmount = boostLegnth;
                boostReady = true;
            }

            var width = canvas.width / 3;
            displayBar(centerX * scale - width / 2, boostBarY, width, 20, boostAmount / boostRechargeLegnth, "#937f2a");
        }


        if(shootCooldownTimer < shootCooldownTime){
            shootCooldownTimer++;
        }

        if(playerReloadTimer > 0){
            if(playerReloadTimer - spaceShip.fireRate > 0)
                playerReloadTimer -= spaceShip.fireRate;
            else
                playerReloadTimer = 0;
        }

        if(!currentPlanet){
            var width = canvas.width / 5;
            displayBar(centerX * scale - width / 2, canvas.height - 30, width, 20, (1000 - playerReloadTimer) / 1000, "#ff5a51");
        }

    }

    if(spaceShip)
        drawLeaderBoard();
    
    for (var changed in colorChangedHitObjects) {
        if (colorChangedHitObjects.hasOwnProperty(changed)) {
           
            var worldObject = findObjectWithId(allWorldObjects, changed);

            if(worldObject)
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

    for (var can in canvases) {
        if (canvases.hasOwnProperty(can) && can != "mainCanvas") {
            canvases[can].getContext('2d').scale(1 / scale, 1 / scale);
        }
    }

    if(mouse.clickDown)
        mouse.clickDown = false;

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
    c.fillText($('input#leaderboard').val(), windowWidth - width / 2 - padding, padding * 2.8);
    c.textAlign = "left";

    c.globalAlpha = .25;
    c.fillStyle = "#898989";
    c.fillRect(windowWidth - width - padding, padding, width, height);

    var playerY = padding * 4.5;

    c.font = height / 15 + "px Helvetica";
    c.globalAlpha = .75;

    var IMAGE_SIZE =  windowHeight / 35;

    var topPlayers = otherPlayers.concat(spaceShip);

    topPlayers.sort(function (player1, player2) {
        if (player1.level > player2.level) return -1;
	    if (player1.level < player2.level) return 1;
    });

    topPlayers = topPlayers.slice(0, PLAYERS_ON_BOARD);

    if(!topPlayers.includes(spaceShip))
        topPlayers.push(spaceShip);

    var num = 0;
    var placement = {};

    topPlayers.forEach(player => {

        if(num >= PLAYERS_ON_BOARD)
        {
            playerY = height + padding * 3.6;

            c.globalAlpha = .25;
            c.fillStyle = "#898989";
            c.fillRect(windowWidth - width - padding, height + padding * 2, width, height / 5);
            c.globalAlpha = 1;
        }

        var name;
        if(player == spaceShip)
        {
            name = username;
        }
        else
            name = player.username;

        c.save();
        c.translate(windowWidth - width + padding * 1.4 + IMAGE_SIZE / 2, playerY);
        c.rotate(Math.PI/2);
        c.drawImage(getImage("spaceship" + player.level), IMAGE_SIZE / -2, IMAGE_SIZE / -2, IMAGE_SIZE, IMAGE_SIZE);
        c.restore();

        if(player == spaceShip)
            c.globalAlpha = 1;
        else 
            c.globalAlpha = .5;

        c.fillStyle = "#e0ecff";
        c.fillText(num + 1 + ")", windowWidth - width, playerY);
        c.fillText(name, windowWidth - width + padding * 2 + IMAGE_SIZE, playerY);
        c.globalAlpha = 1;
        playerY += IMAGE_SIZE + padding;
        

        placement[player.id] = num;

        num++;
    });

    // if(!playerOnBoard)
    // {

        

    //     c.globalAlpha = 1;
        
    //     c.save();
    //     c.translate(windowWidth - width + padding * 1.4 + IMAGE_SIZE / 2, playerY);
    //     c.rotate(Math.PI/2);
    //     c.drawImage(getImage("spaceship" + player.level), IMAGE_SIZE / -2, IMAGE_SIZE / -2, IMAGE_SIZE, IMAGE_SIZE);
    //     c.restore();
        
    //     c.globalAlpha = .5;
    //     c.fillStyle = "white";
    //     c.fillText(placement[clientId] + 1 + ")", windowWidth - width - padding / 1.3, playerY);
    //     c.fillText(username, windowWidth - width + padding * 2.1, playerY);
        

    //     playerY += IMAGE_SIZE;

    // }

    c.globalAlpha = 1;
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
            name = $('input#bulletPenetration').val();
            description = $('input#bulletPenetrationDescription').val();
        break;
        case "boost":
            name = $('input#boost').val();
            description = $('input#boostDescription').val();
        break;
        case "cloakTime":
            name = $('input#cloakTime').val();
            description = $('input#cloakTimeDescription').val();
        break;
        case "shipTurret":
            name = $('input#shipTurret').val();
            description = $('input#shipTurretDescription').val();
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
        c.fillText("Fully Upgraded", windowWidth / 2, (windowHeight - height) / 2 + height * .8);
        c.textAlign = "left";
    }
    else{
        if(currentLevel > 0){

            var arrowSize = height / 20;

            label = "Upgrade";
            c.fillRect((windowWidth - width) / 2 + imageSize / 2 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
            c.drawImage(getImage(type + (currentLevel - 1)), (windowWidth - width) / 2 + imageSize / 2, imageY, imageSize, imageSize);
            
            c.fillRect((windowWidth - width) / 2 + width - imageSize * 1.5 - padding / 2, imageY - padding / 2, imageSize + padding, imageSize + padding);
            c.drawImage(getImage(type + (currentLevel)), (windowWidth - width) / 2 + width - imageSize * 1.5, imageY, imageSize, imageSize);

            c.globalAlpha = 1;
            drawArrow(windowWidth / 2 + arrowSize, imageY + imageSize / 2, 135 * Math.PI / 180, "white", arrowSize);
            c.globalAlpha = .9;
        }
        else{
            label = "Buy";
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

var expandedUpgrades = [];
var canClickArrow = true;

function showUpgrades(){

    if(currentPlanet)
    {
        currentPlanet.structures.forEach(structure => {
            if(!structureUpgradeables.contains(structure.id))
                structureUpgradeables.push(structure.id);
        });
    }

    numberOfUpgrades = upgradeableObjects().length;
    size = windowHeight / 10;
    padding = windowHeight / 10;

    var groupedUpgrades = {};
    var numberOfGroups = 0;

    for(var i = 0; i < numberOfUpgrades; i++){
    
        var upgradeeId = upgradeableObjects()[i];
        var upgrade = Object.assign({}, findUpgrade(upgradeeId));

        if(!upgrade || upgrade.identifier == "landingPad")
            continue;

        upgrade.id = upgradeeId;

        var alreadyInside = false;

        for (var group in groupedUpgrades) {

            if (groupedUpgrades.hasOwnProperty(group)) {

                if(group == upgrade.identifier){
                    groupedUpgrades[group].push(upgrade);
                    alreadyInside = true;
                }
            }
        }

        if(!alreadyInside){
            if(upgrade.identifier){
                groupedUpgrades[upgrade.identifier] = [upgrade];
                numberOfGroups++;
            }
        }

    }

    var width = numberOfGroups * size + (numberOfGroups - 1) * padding;
    var x = 0;

    for (var group in groupedUpgrades) {
        if (groupedUpgrades.hasOwnProperty(group)) {

            var buttonX = x / scale + (centerX - width / scale / 2)
            var buttonY = centerY - size / scale / 2;
    
            var drawx = x + (centerX * scale - .5 * width)
            var drawy = scale + size;

            var upgrade = null;
            var upgradeCosts = {};
            var groupIndex = 0;
            
            var costSize = windowHeight / 40;
            var costPadding = windowHeight / 100;
            var costX = 0;
            var costY = size + 10;

            var upgradeButtons = [];

            var mouseX = mouse.x * scale;
            var mouseY = mouse.y * scale;

            var numberInGroup = groupedUpgrades[group].length;

            if(numberInGroup == 1){
                upgrade = groupedUpgrades[group][0];

                if(!upgrade.fullyUpgraded)
                    upgradeCosts = upgrade.costs;
            }
            else
            {
                upgrade = groupedUpgrades[group][groupIndex];

                while(upgrade.fullyUpgraded && groupIndex < numberInGroup)
                {
                    upgrade = groupedUpgrades[group][groupIndex];
                    groupIndex++;
                }
            }

            if(numberInGroup == 1){
                c.globalAlpha = .5;
                c.fillStyle = planetColors[0];
                c.fillRect(drawx, drawy, size, size);
                c.globalAlpha = 1;

                c.drawImage(getImage(upgrade.identifier + upgrade.upgradeToLevel), drawx, drawy, size, size);

                if(!upgrade.fullyUpgraded){

                    for (var cost in upgradeCosts) {
                        if (upgradeCosts.hasOwnProperty(cost)) {

                            var color = "white";
                            if(!playerItems[cost] || playerItems[cost] < upgradeCosts[cost])
                                color = "#ff9696";

                            c.drawImage(getImage(cost), drawx + costX, drawy + costY, costSize, costSize);
                            c.font = size / 4 + "px Helvetica";
                            c.fillStyle = color;
                            c.fillText(upgradeCosts[cost], drawx + costX + costSize * 1.2, drawy + costY + costSize / 1.3);
            
                            costY += costSize + costPadding;
                        }
                    }

                    upgradeButtons.push({x: drawx, y: drawy, upgrades: [upgrade.id]});
                }
                else{
                    c.font = size / 7 + "px Helvetica";
                    c.fillStyle = "white"; 
                    c.fillText("Fully Upgraded", drawx, drawy - costPadding);
                }
            } 
            else{
                var arrowSize = size / 8;
                var arrowX = drawx + size / 2;
                var arrowY = drawy - arrowSize - costPadding * 3;

                var arrowButtonSize = size / 2;

                var arrowbuttonX = arrowX - arrowButtonSize / 2;
                var arrowbuttonY = arrowY - arrowButtonSize / 2;

                c.fillStyle = planetColors[1];
                c.fillRect(arrowbuttonX, arrowbuttonY, arrowButtonSize, arrowButtonSize);

                if(expandedUpgrades.contains(upgrade.identifier)){

                    var groupY = drawy;
                    var groupCostY = size + costPadding + drawy;

                    for (let i = 0; i < numberInGroup; i++) {

                        var upgradeInGroup = groupedUpgrades[group][i];
                        var numberOfCosts = 0;

                        for (var cost in upgradeInGroup.costs) {
                            if (upgradeInGroup.costs.hasOwnProperty(cost)) {

                                var color = "white";
                                if(!playerItems[cost] || playerItems[cost] < upgradeInGroup.costs[cost])
                                    color = "#ff9696";

                                c.drawImage(getImage(cost), drawx + costX, groupCostY, costSize, costSize);
                                c.font = size / 4 + "px Helvetica";
                                c.fillStyle = color;
                                c.fillText(upgradeInGroup.costs[cost], drawx + costX + costSize * 1.2, groupCostY + costSize / 1.3);
                
                                groupCostY += costSize + costPadding;
                                numberOfCosts++;
                            }
                        }

                        c.globalAlpha = .5;
                        c.fillStyle = planetColors[0];
                        c.fillRect(drawx, groupY, size, size);
                        c.globalAlpha = 1;

                        c.globalAlpha = .8;
                        c.drawImage(getImage(upgradeInGroup.identifier + upgradeInGroup.upgradeToLevel), drawx, groupY, size, size);

                        if(upgradeInGroup.fullyUpgraded){
                            c.globalAlpha = 1;
                            c.font = size / 7 + "px Helvetica";
                            c.fillStyle = "white"; 
                            c.fillText("Fully Upgraded", drawx, groupY + size / 2);
                        }
                        else{
                            upgradeButtons.push({x: drawx, y: groupY, upgrades: [upgradeInGroup.id]});
                        }

                        numberOfUpgrades++;
                        groupCostY += size + costPadding;
                        groupY += numberOfCosts * (costPadding + costSize) + size + costPadding;
                    }
                    
                }
                else
                {
                    var insertedCosts = [];
                    var buttonUpgrades = [];
                    var numFullyUpgraded = 0;

                    for(var i = 0; i < numberInGroup; i++){
    
                        var upgradeInGroup = groupedUpgrades[group][i];

                        if(!upgradeInGroup.fullyUpgraded){
                            
                            buttonUpgrades.push(upgradeInGroup.id);

                            for (var cost in upgradeInGroup.costs) {
                                if (upgradeInGroup.costs.hasOwnProperty(cost)) {
                                    if(!insertedCosts.contains(cost)){
                                        insertedCosts.push(cost);
                                        upgradeCosts[cost] = upgradeInGroup.costs[cost];
                                    }
                                    else{
                                        upgradeCosts[cost] += upgradeInGroup.costs[cost];
                                    }
                                
                                }
                            }
                        }
                        else
                            numFullyUpgraded++;
                    }

                    c.globalAlpha = .5;
                    c.fillStyle = planetColors[0];
                    c.fillRect(drawx, drawy, size, size);

                    c.drawImage(getImage(upgrade.identifier + upgrade.upgradeToLevel), drawx, drawy, size, size);
                    c.globalAlpha = 1;

                    if(numFullyUpgraded < numberInGroup)
                    {
                        upgradeButtons.push({x: drawx, y: drawy, upgrades: buttonUpgrades});

                        for (var cost in upgradeCosts) {
                            if (upgradeCosts.hasOwnProperty(cost)) {

                                var color = "white";
                                if(!playerItems[cost] || playerItems[cost] < upgradeCosts[cost])
                                    color = "#ff9696";

                                c.drawImage(getImage(cost), drawx + costX, drawy + costY, costSize, costSize);
                                c.font = size / 4 + "px Helvetica";
                                c.fillStyle = color;
                                c.fillText(upgradeCosts[cost], drawx + costX + costSize * 1.2, drawy + costY + costSize / 1.3);
                
                                costY += costSize + costPadding;
                            }
                        }
                        
                        c.font = size / 7 + "px Helvetica";
                        c.textAlign = "center";
                        c.fillStyle = "white";
                        c.fillText("Upgrade all (" + (numberInGroup - numFullyUpgraded) + ")", drawx + size / 2, drawy + size  / 2);
                        c.textAlign = "left";
                    }
                    else{
                        c.font = size / 7 + "px Helvetica";
                        c.fillStyle = "white"; 
                        c.fillText("Fully Upgraded", drawx, drawy - costPadding);
                    }

                    
                }
                
                var arrowRotation = Math.PI * 1.25;
                arrowY = drawy - arrowSize - costPadding * 3;

                if(expandedUpgrades.contains(upgrade.identifier))
                {
                    arrowRotation = Math.PI / 4;
                    arrowY = drawy - arrowSize * 3.5 - costPadding * 3;
                }

                if (mouseY > arrowbuttonY && mouseY < arrowbuttonY + arrowButtonSize && mouseX > arrowbuttonX && mouseX < arrowbuttonX + arrowButtonSize) {

                    var arrowIncreasedSize = arrowSize * 1.2;

                    c.globalAlpha = 1;
                    drawArrow(arrowX, arrowY + arrowIncreasedSize, arrowRotation, "white", arrowIncreasedSize);

                    if(mouse.clicked && canClickArrow){
                        canClickArrow = false;

                        if(expandedUpgrades.contains(upgrade.identifier))
                        {
                            for (let i = 0; i < expandedUpgrades.length; i++) {
                                const identifier = expandedUpgrades[i];
                                
                                if(expandedUpgrades[i] == upgrade.identifier){
                                    expandedUpgrades.splice(i, 1);
                                    break;
                                }
                            }
                        }
                        else
                        {
                            expandedUpgrades.push(upgrade.identifier);
                        }
                    }
                }
                else
                {
                    c.globalAlpha = 1;
                    drawArrow(arrowX, arrowY + arrowSize, arrowRotation, "white", arrowSize);
                }
            }

            for (let i = 0; i < upgradeButtons.length; i++) {
                const button = upgradeButtons[i];

                if (mouseY > button.y && mouseY < button.y + size && mouseX > button.x && mouseX < button.x + size) {

                    c.globalAlpha = .5;
                    c.fillStyle = "fffffff";
                    c.fillRect(button.x, button.y, size, size);
                    c.globalAlpha = 1;

                    button.upgrades.forEach(upgradeId => {
                        var object = findObjectWithId(allStructures.concat(spaceShip), upgradeId).object;
    
                        var circleX = object.x * scale;
                        var circleY = object.y * scale;
        
                        if(object != spaceShip){
                            c.beginPath();
                            c.lineWidth = 3;
                            c.strokeStyle = "#9ef442";
                            c.arc(circleX, circleY, 10,0,2*Math.PI);
                            c.stroke();
                        }
                        if(mouse.clicked){
                            var data = {id: upgradeId, worldId: worldId}
                            socket.emit('upgradeRequest', data);
                            clickedUpgrade = true;
                        }
                    });
                }
                
            }
        
            x += size + padding;
            
        }

        if (!mouse.clicked)
            canClickArrow = true;
    }
    
}

function playerHasResources(costs)
{
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

    worldObjects.shops.forEach(shop => {
        
        c.globalAlpha = 0.75;
        c.beginPath();
        c.arc(x + shop.coordX / gridSize * size, y + shop.coordY / gridSize * size, size / 50, 0, Math.PI * 2, false);
        c.fillStyle = "#7fb0ff";
        c.fill();

    });

    ownedPlanets.forEach(planet => {
        
        c.globalAlpha = 0.75;
        c.beginPath();
        c.arc(x + planet.coordX / gridSize * size, y + planet.coordY / gridSize * size, size / 40, 0, Math.PI * 2, false);
        c.fillStyle = "#5fd867";
        c.fill();

    });

    c.globalAlpha = 0.75; 
    c.beginPath();
    c.arc(x + spaceShip.coordX / gridSize * size, y + spaceShip.coordY / gridSize * size, size / 30, 0, Math.PI * 2, false);
    c.fillStyle = "white";
    c.fill();    
}

function propertiesOverview(object, fill){

    var size = 100 / scale;
    var dropSize = size / 3;
    var dropPadding = size / 10;
    var pos = cordsToScreenPos(object.coordX, object.coordY);
    var flipX = 1;

    if(pos.x - 10 > centerX && object.id != clientId)
    {
        flipX = -1;
    }

    if(!isOnScreen(pos.x, pos.y, -20))
    {
        pos = {x: mouse.x, y: mouse.y};
    }

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
            otherPlayers.forEach(player => {
                if(player.id == object.owner)
                    name = player.username;
            });
        }

        c.font = size / 5 + "px Arial";
        c.fillStyle = "white";
        c.fillText("Owner: " + (name), pos.x + (size / 1.8) * flipX, pos.y - size / 2 - size / 20);

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
                c.fillText(playerItems[item].toString(), pos.x + size + padding + shadowX, pos.y + size / 1.3 + shadowY);

                c.fillStyle = "white";
                c.globalAlpha = 1;
                c.fillText(playerItems[item].toString(), pos.x + size + padding, pos.y + size / 1.3);

                if(aquiredItems[item])
                {
                    if(aquiredItems[item].time > 0)
                    {
                        c.globalAlpha = aquiredItems[item].time / aquireItemsFadeTime;
                        c.fillStyle = "white";
                        c.font = windowHeight / 50 + "px Arial";
                        c.fillText("+ " + aquiredItems[item].amount.toString(), pos.x + size + padding + 50 + 20 * playerItems[item].toString().length, pos.y + size / 1.3);
    
                        aquiredItems[item].time--;
                    }
                    else
                        delete aquiredItems[item];
                    
                    c.globalAlpha = 1;
                }
                

                
            }
        }
        pos.y += size + padding;
    }

}

function displayBar(x, y, width, height, fillPrecentage, color) {
    c.globalAlpha = 0.75;
    c.fillStyle = "#bababa";
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
    var planetArray = worldObjects.planets;

    for(var i = 0; i < planetArray.length; i++){

        if(planetArray[i].owner && planetArray[i].owner != clientId)
            continue;

        var distance = Math.sqrt(Math.pow(centerX - planetArray[i].x, 2) + Math.pow(centerY - planetArray[i].y, 2));

        distance -= planetArray[i].radius;

        if(closestPlanet != null){
            var targetDistance = Math.sqrt(Math.pow(centerX - closestPlanet.x, 2) + Math.pow(centerY - closestPlanet.y, 2));
            
            targetDistance -= closestPlanet.radius;

            if(distance < targetDistance && !planetArray[i].occupiedBy && distance <= LANDING_DISTANCE){
                closestPlanet = planetArray[i];
            }
        }
        else if(!planetArray[i].occupiedBy && distance <= LANDING_DISTANCE){
            closestPlanet = planetArray[i];
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
        xpos = x;
        c.beginPath();
        c.moveTo(x, ypos);
        c.lineTo(x + width,  ypos);
        c.strokeStyle = color;
        c.stroke();

    }
    
    //Draw Vertical Lines
    for(var i = 0; i <= gridScale; i++){

        xpos = width - width / gridScale * i + (x);

        c.beginPath();
        c.moveTo(xpos, y);
        c.lineTo(xpos, y + height);
        c.strokeStyle = color;
        c.stroke();

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

function structureSpawnPoint(structureSize, img, addedDist){

    var positionAviable = true;

    var rad = Math.atan2(mouse.y - currentPlanet.y, mouse.x - currentPlanet.x) * -57.2958;
    structureSpawnRotation = rad;

    var dist = 0

    if(addedDist)
        dist += addedDist;

    var x = currentPlanet.x * scale + ((currentPlanet.radius + dist) * scale + structureSize / 2) * Math.cos(-rad*Math.PI/180);
    var y = currentPlanet.y * scale + ((currentPlanet.radius + dist) * scale + structureSize / 2) * Math.sin(-rad*Math.PI/180);

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
        //c.fillStyle = "#42aaf4";
        //c.fillRect(-rectWidth/2+20,-rectHeight/2,rectWidth,rectHeight);
        c.restore();
    }

    return positionAviable;
}

function isOnScreen(x, y, size){
    return (!(x - size > (windowWidth + centerX) / scale || x + size < 0 || y + size < 0 || y - size > (windowHeight + centerY) / scale));
}

function getRndInteger(min, max) {
    return (Math.random() * (max - min) ) + min;
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
};

function findUpgrade(id){

        var upgrade = {};
        var upgrades;

        var upgradee = findObjectWithId(allWorldObjects.concat(allStructures).concat(spaceShip), id);
            
        if(upgradee){
            upgradee = upgradee.object;
        }
        else
            return false;

        if(upgradee.type){
            upgrades = structureUpgrades[upgradee.type];
        }
        else
        {
            upgrades = playerUpgrades;
        }

        if(upgrades.length > upgradee.level + 1){
            upgrade = upgrades[upgradee.level + 1];
            upgrade.upgradeToLevel = upgradee.level + 1;
            upgrade.fullyUpgraded = false;
        }
        else {
            upgrade = {identifier: upgrades[upgradee.level].identifier};
            upgrade.upgradeToLevel = upgradee.level;
            upgrade.fullyUpgraded = true;
        }
        
        return upgrade;
}

setup();


