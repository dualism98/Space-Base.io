//Canvas
var canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var c = canvas.getContext('2d');

var mouse = {
    x :undefined,
    y: undefined,
    clicked: false
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

    for (let i = 0; i  < this.length; i++) {
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
var hittableObjects = [];
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

var PLANET_GRAVITY = 0;//.0025;
var PLANET_GRAVITY_EXPONENT = 2.5;

var MAX_GRAVITATIONAL_DISTACNE = 600;
var planetDist;

var LANDING_DISTANCE = 200;
var SPACESHIP_DECELERATION_TIME = 20;
var PROJECTIILE_SPEED = 20;

var mousePullx = 0;
var mousePully = 0;

var spaceshipVelocity = new Vector();

var playerReloadTimer = 0;

var projectiles = [];
var otherProjectiles = [];

var healthBarColor = "#36a52c";

var currentPlanet;
var closestAvailablePlanet;
var planetEditMode = false;

var healthDict = {};

var playerItems = {};

var images = {};

var imageArray = ["NF", "asteroidBits", "backX", "boost0", "boost1", "boost2", "boost3", "bulletPenetration0", "bulletPenetration1", "bulletPenetration2", "bulletPenetration3", "cloakTime0", "cloakTime1", "cloakTime2", "cloakTime3", "cloakTime4", "crystal", "E", "earth", "gem", "iron", "landingPad0", "mine0", "mine1", "mine2", "mine3", "mine4", "mine5", "mine6", "mine7", "mine8", "mine9", "mine10", "S", "shield0", "shield1", "shield2", "shield3", "shield4", "shield5", "shield6", "shipTurret0", "shipTurret1", "shipTurret2", "shipTurret3", "shipTurret4", "shipTurretBase0", "shipTurretBase1", "shipTurretBase2", "shipTurretBase3", "shipTurretBase4", "shop", "spaceship0", "spaceShip1", "spaceShip2", "spaceShip3", "spaceShip4", "spaceShip5", "spaceShip6", "spaceShip7", "spaceShip8", "spaceShip9", "spaceShip10", "spaceShip11", "spaceShip12", "spaceShip13", "spaceShip14", "stardust", "startGameButton", "turret0", "turret1", "turret2", "turret3", "turret4", "turret5", "turret6", "turret7", "water"];

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

function setup(){
    //socket = io.connect('http://localhost:8080');
    //socket = io.connect('http://iogame-iogame.193b.starter-ca-central-1.openshiftapps.com/');
    socket = io.connect('https://shielded-chamber-23023.herokuapp.com/');
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
    socket.on("newWorldObjectSync", newWorldObjectSync);
    socket.on("syncItem", syncItem);
    socket.on('shopUpgrade', shopUpgrade);
    socket.on('cloak', cloak);

    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);

    planetEditMode = false;
}

//Receive Data Functions
function setupLocalWorld(data){

    socket.emit('upgradeInfo');

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
            var player = new NetworkSpaceShip(client.x, client.y, client.maxHealth, client.health, 0, client.level, client.radius, client.username, client.id)
            if(client.shipTurret){
                player.turret = new Turret(player, client.x, client.y, 0, client.shipTurret.level - 1, true, player.id, client.shipTurret.id);
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

        if(asteroid.health <= 0)
            continue;

        var asteroidObject = new SpaceMatter(asteroid.x, asteroid.y, asteroid.radius, asteroid.color, asteroid.maxHealth, asteroid.health, asteroid.type, asteroid.id);
        worldObjects.asteroids.push(asteroidObject);
    }

    //Planets
    for(var i = 0; i < data.worldObjects.planets.length; i++){

        var planet = data.worldObjects.planets[i];

        if(planet.health <= 0)
            continue;

        var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, planet.id);
        planetObject.occupiedBy = planet.occupiedBy;
        planetObject.owner = planet.owner; 

        //Add all existing structures
        for (let i = 0; i < planet.structures.length; i++) {
            const structure = planet.structures[i];
            planetObject.addStructure(planetObject, structure.x, structure.y, structure.rotation, structure.type, structure.level, true, structure.ownerId, structure.id);
        }

        worldObjects.planets.push(planetObject);
    }

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();
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

            var changedHitableObject = findObjectWithId(hittableObjects, data.id);

            worldObjects.planets.splice(changedPlanet.index, 1);
            hittableObjects.splice(changedHitableObject.index, 1);
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
            var changedHitableObject = findObjectWithId(hittableObjects, data.id);

            worldObjects.asteroids.splice(changedSpaceMatter.index, 1);
            hittableObjects.splice(changedHitableObject.index, 1);
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
        var localObj = findObjectWithId(hittableObjects, data.deadObjects[i]);

        if(localObj)
            hittableObjects.splice(localObj.index);
    }

    for (let i = 0; i < data.hittableObjects.length; i++) {
        const sentHittableObject = data.hittableObjects[i];
        
        if(sentHittableObject.health < healthDict[sentHittableObject.id]){            
            var ownPlanetAttacked = false;

            ownedPlanets.forEach(ownedPlanet => {
                if(ownedPlanet.shield && ownedPlanet.shield.id == sentHittableObject.id)
                    damagedOwnPlanet(true, sentHittableObject.health, ownedPlanet.shield.id);
                else if(ownedPlanet.id == sentHittableObject.id)
                    damagedOwnPlanet(false, sentHittableObject.health, ownedPlanet.id);
            });
        }
        
        healthDict[sentHittableObject.id] = sentHittableObject.health;

        if(clientId != sentHittableObject.id){
            var localObj = findObjectWithId(hittableObjects, sentHittableObject.id);

            if(localObj){
                if(sentHittableObject.health > 0)
                    hittableObjects[localObj.index] = sentHittableObject;
                else
                {
                    hittableObjects.splice(localObj.index, 1);

                    var isStructure = false;

                    for (let i = 0; i < structureUpgradeables.length; i++) {
                        if(structureUpgradeables[i] == sentHittableObject.id){
                            structureUpgradeables.splice(i, 1);
                            isStructure = true;
                        }
                    }
                }
            }
            else{
                if(sentHittableObject.health > 0)
                    hittableObjects.push(sentHittableObject);
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

//cancelAnimationFrame(requestAnimationFrameId);

    if(requestAnimationFrameId){
        location.reload();
    }
    animate();
}
function startLocalPlayer(data){
    gridPos = new Vector(data.x + gridSize / -2, data.y + gridSize / -2);
    upgradeables.push(clientId);
    friendlyObjectIds = [clientId];

    //Spawn client player
    spaceShip = new SpaceShip(centerX, centerY, data.maxHealth, data.health, data.level, data.radius, data.speed, data.turningSpeed, data.fireRate, clientId);
    playerItems = {};
    allWorldObjects = getAllWorldObjects();
}
function newPlayer(data){
    otherPlayers.push(new NetworkSpaceShip(data.x, data.y, data.maxHealth, data.health, data.rotation, data.level, data.radius, data.username, data.id));
}
function respawn(){

    scale = 1;
    spaceShip = null;
    upgradeables = [];
    structureUpgradeables = [];
    ownedPlanets = [];
    shopOpen = {shopRef: null, type: null, open: false};

    allWorldObjects = getAllWorldObjects();
    allStructures = getAllStructures();

    $("#preGameContent").fadeIn();
    $("canvas").css("filter", "blur(5px)");

}
function updatePlayerPosition(data){
    otherPlayer = findObjectWithId(otherPlayers, data.id);

    if(otherPlayer){
        var otherPlayerObj = otherPlayer.object;

        otherPlayerObj.coordX = data.x;
        otherPlayerObj.coordY = data.y;
        otherPlayerObj.rotation = data.rot;

        for(var i = 0; i < hittableObjects.length; i++){
            if(hittableObjects[i].id == data.id){
                hittableObjects[i].x = otherPlayerObj.coordX;
                hittableObjects[i].y = otherPlayerObj.coordY;
            }
        }
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
    displayMessage(data, 10, 5);
}
function upgradeSync(data){

    var allUpgradeables = allWorldObjects.concat(allStructures.concat(otherPlayers));

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
        player.turret.shootInterval = Math.round(1000 / data.value);
        player.turret.projectileSpeed = Math.round(data.value * 10);
        player.turret.projectileSize = player.radius / 4;
    }

    allStructures = getAllStructures();
}
function mineProduce(data){
    data.forEach(mine => {
        localMine = findObjectWithId(producingMines, mine.id);

        if(localMine)
            localMine.object.productionEffect(mine.amount);
    
        if(playerItems[mine.item])
            playerItems[mine.item] += mine.amount;
        else 
        {
            playerItems[mine.item] = mine.amount;
        }

    });
    
}
function onAquiredItems(data){
    for (var drop in data.drops) {
        if (data.drops.hasOwnProperty(drop)) {
            if(playerItems[drop])
                playerItems[drop] += data.drops[drop];
            else
                playerItems[drop] = data.drops[drop];
        }
    } 
}
function cloak(data){
    var player = findObjectWithId(otherPlayers.concat(spaceShip), data.playerId);
    var hittablePlayer = findObjectWithId(hittableObjects, data.playerId);

    if(player){

        player = player.object;

        if(data.cloaked)
        {
            if(clientId != player.id && hittablePlayer)
                hittablePlayer.object.active = false;
            player.alpha = 0;
        }
        else{
            if(clientId != player.id && hittablePlayer)
                hittablePlayer.object.active = true;
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

        var otherPlayerHittableObj = findObjectWithId(hittableObjects, data.clientId);

        if(otherPlayerHittableObj)
            hittableObjects.splice(otherPlayerHittableObj.index, 1);

        hittableObjects.splice()

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
function forceDisconnect(data){
    location.reload();
} 

//Send Data Functions
function sendPlayerPosition(pos, rotation){
    var data = {
        x: pos.x, 
        y: pos.y,
        rot: rotation,
        worldId: worldId
    }

    socket.emit('playerPos', data);
}
function sendProjectile(x, y, vel, size, color, id, shooterId){
    var data = {
        x: x, 
        y: y,
        vel: vel,
        size: size,
        color: color,
        id: id,
        senderId: clientId,
        shooterId: shooterId,
        worldId: worldId
    }

    socket.emit('spawnProj', data);
}
function sendProjectileHit(projectileId, subjectId){
    var data = {
        id: subjectId,
        senderId: clientId,
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
        mouse.clicked = true;
})

window.addEventListener('mouseup', 
    function(event){
        mouse.clicked = false;
});

window.addEventListener('resize', 
    function(event){

    windowWidth =  $(window).width();
    windowHeight =  $(window).height();

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);
});

$("#startGame").click(function(){

    var username = "unnamed"

    if($("#playerNameInput").val() != ""){
        username = $("#playerNameInput").val().toString();
        username = username.slice(0, 15);
    }

    socket.emit("playerStartGame", {username: username, worldId: worldId});

    $("#preGameContent").fadeOut();
    $("canvas").css("filter", "none");
});

$("#help").click(function(){
    $("#mainContent").fadeOut(250);
    $("#helpContent").fadeIn(250);
});

$("#backHelp").click(function(){

    $("#mainContent").fadeIn(250);
    $("#helpContent").fadeOut(250);

});

$(document).ready(function() {

    imageArray.forEach(image => {
        getImage(image);
    });

    $("#mainContent").fadeIn(0);
    $("#helpContent").fadeOut(0);
    $("#helpContent").css('display', '');
});

$(document).keypress(function(e){

    if(currentPlanet && spaceShip){
        if(e.keyCode == 104) // H
        {
            if(currentPlanet.health < currentPlanet.maxHealth)
                socket.emit("heal", {id: currentPlanet.id, worldId: worldId});
            else
                socket.emit("heal", {id: clientId, worldId: worldId});
        }

        if(planetEditMode){
            if(e.keyCode == 108) // L
                requestStructureSpawn(currentPlanet, currentPlanet.x, currentPlanet.y, 0, "landingPad", false, clientId);
            if(e.keyCode == 115) // S
                requestStructureSpawn(currentPlanet, currentPlanet.x, currentPlanet.y, 0, "shield", false, clientId);
            if(e.keyCode == 109) // M
                requestStructureSpawn(currentPlanet, structureSpawnPosition.x, structureSpawnPosition.y, structureSpawnRotation, "mine", false, clientId);
            if(e.keyCode == 116) // T
                requestStructureSpawn(currentPlanet, structureSpawnPosition.x, structureSpawnPosition.y, structureSpawnRotation, "turret", false, clientId);
        }
        
        if(e.keyCode == 101) // E
            planetEditMode = !planetEditMode;

        if(e.keyCode == 32){ //SPACE
            socket.emit('planetOccupancy', {planetId: currentPlanet.id, playerId: null, worldId: worldId})

            currentPlanet.occupiedBy = null;
                
            landed = false;
            currentPlanet = null;
            planetEditMode = false;
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
            if(playerReloadTimer <= 0){
                shoot(-gridPos.x, -gridPos.y, spaceShip.rotation, PROJECTIILE_SPEED, spaceShip.radius / 4, spaceShip.shopUpgrades.bulletPenetration.value + 1, "#f45c42", clientId);
                playerReloadTimer = 1000;
            }
        } 
        if(e.keyCode == 106 && closestAvailablePlanet != null){ // J

            socket.emit('planetOccupancy', {planetId: closestAvailablePlanet.id, playerId: clientId, worldId: worldId})

            currentPlanet = closestAvailablePlanet;
            currentPlanet.occupiedBy = clientId;
            closestAvailablePlanet = null;
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

function requestStructureSpawn(planet, x, y, rotation, type, isFacade, ownerId){
    var globalPos = screenPosToCords(x, y);

    var spawnData = {
        planetId: currentPlanet.id,
        x: globalPos.x, 
        y: globalPos.y,
        rotation: rotation,
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

        this.draw();
        this.updateStructures();


        healthBarWidth = 200;

        if(this.health != this.maxHealth)
        displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, healthBarWidth, 20, this.health / this.maxHealth, "green");

        if(planetEditMode && currentPlanet == this){
            var rad = Math.atan2(mouse.y - this.y, mouse.x - this.x) * -57.2958;
            structureSpawnRotation = rad;
            drawPointAroundCircle(this.x, this.y, radius + 20, rad, 1);
        }
    }

    this.updateStructures = function(){
        for(var i = 0; i < this.structures.length; i++){
            this.structures[i].update();
        } 
    }

    this.addStructure = function (planet, x, y, rotation, type, level, isFacade, ownerId, id){
        var shieldRadius = this.radius + 100;

        if(type === "mine"){
            var mine = new Mine(planet, x, y, rotation, level, ownerId, id);
            this.structures.push(mine);

            if(!isFacade)
                producingMines.push(mine);
        }
        else if(type === "turret"){
            this.structures.push(new Turret(planet, x, y, rotation, level, isFacade, ownerId, id));
        }
        else if(type === "shield"){
            var shield = new Shield(planet, shieldRadius, level, id);
            this.shield = shield;
            this.structures.push(shield);

            if(!isFacade)
                friendlyObjectIds.push(id);
        }
        else if(type === "landingPad"){
            var landingPad = new LandingPad(planet, this.radius - 100, id);
            this.landingPad = landingPad
            this.structures.push(landingPad);
            this.owner = this.occupiedBy;
            
            if(!isFacade){
                friendlyObjectIds.push(planet.id);
                ownedPlanets.push(planet);
            }
        }
    }
}
function Shield(planet, radius, level, id){
    this.planet = planet;
    this.x;
    this.y;
    this.radius = radius;
    this.color = "blue";
    this.id = id;
    this.type = "shield";
    this.level = level;

    this.draw = function(){
        c.beginPath();
        c.globalAlpha = 0.3;
        c.lineWidth = 10;
        c.arc(this.x, this.y, this.radius + c.lineWidth / 2, 0, Math.PI * 2, false);
        c.strokeStyle = "blue";
        c.stroke();

        c.globalAlpha = 0.1;
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        c.fillStyle = this.color;
        c.fill();
        c.globalAlpha = 1;

        healthBarWidth = 300;

        var hittableObj = findObjectWithId(hittableObjects, this.id);

        if(hittableObj)
            displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, 300, 20, hittableObj.object.health / hittableObj.object.maxHealth, "blue");
    }
    this.update = function(){

        var pos = cordsToScreenPos(this.planet.coordX, this.planet.coordY);

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

    this.draw = function(){
        c.beginPath();
        c.lineWidth = 10;
        c.arc(this.x, this.y, this.radius + c.lineWidth / 2, 0, Math.PI * 2, false);
        c.strokeStyle = "gray";
        c.stroke();

        c.lineWidth = 1;

        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        c.fillStyle = "darkGray";
        c.fill();
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

    this.color = "#a0a7b2";

    var test = false;

    this.level = level;

    this.draw = function(){
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation - 90) / -57.2958);
        c.drawImage(getImage('mine' + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
        c.restore();
    }
    this.update = function(){ 
        
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

        this.draw();
    }
    this.productionEffect = function(){
        if(test)
            this.color = "#a0a7b2";
        else
            this.color = "#71767f";

        test = !test;
    }
}
function Turret(planet, x, y, rotation, level, isFacade, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.headRotation = 0;
    this.baseSize = 50;
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
    this.range = 1000;
    this.target;

    this.level = level;

    this.shootInterval = 100;
    this.shootCounter = 0;
    this.projectileSpeed = 5;
    this.projectileSize = 5;

    this.shootPoint = new Vector();

    this.draw = function(){
        //Draw Base
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation - 90) / -57.2958);
        c.drawImage(getImage(this.type + this.level), -this.baseSize / 2, -this.baseSize / 2, this.baseSize, this.baseSize);
        c.restore();

        var l = this.x - this.planet.x;
        var h = this.y - this.planet.y;

        var hyp = this.planet.radius;

        var cx = hyp + this.headDistanceFromBase;

        var x = l * (cx / hyp);
        var y = h * (cx / hyp);

        var headX = this.planet.x + x;
        var headY = this.planet.y + y

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

        c.save();
        c.translate(headX, headY);
        c.rotate(this.shootRotation);
        c.fillStyle = planetColors[1];
        c.fillRect(-this.headLength / 2 + this.headLength / 4, -this.headWidth / 2, this.headLength, this.headWidth);
        c.restore();
    }
    this.update = function(){

        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y;

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
        var allPlayers;

        if(spaceShip)
            allPlayers = otherPlayers.concat(spaceShip);
        else
            allPlayers = otherPlayers;

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
        for(var i = 0; i < hittableObjects.length; i++){

            if(this.isFriendly(hittableObjects[i].id) || this.hitObjects.contains(hittableObjects[i].id) || !hittableObjects[i].active)
                continue;

            var pos = cordsToScreenPos(hittableObjects[i].x, hittableObjects[i].y);
            var hitObject = {x: pos.x, y: pos.y, radius: hittableObjects[i].radius} 

            if(isCollidingCircles(this, hitObject)){
                    sendProjectileHit(this.id, hittableObjects[i].id);

                this.hitObjects.push(hittableObjects[i].id);
                return true;
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
                c.shadowBlur = 500;
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
function SpaceShip(x, y, maxHealth, health, level, radius, speed, turningSpeed, fireRate, id){
    this.coordX = x;
    this.coordY = y;
    this.rotation = 0;
    this.radius = radius;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.speed = speed;
    this.fireRate = fireRate;
    this.turningSpeed = turningSpeed;
    this.id = id;

    this.alpha = 1;

    this.turret;

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

        if(this.turret){
            var pos = screenPosToCords(centerX, centerY);
            this.turret.baseSize = this.radius / 2;
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

}
function NetworkSpaceShip(coordX, coordY, maxHealth, health, rotation, level, radius, username, id){
    this.x;
    this.y;
    this.maxHealth = maxHealth;
    this.health = health;
    this.rotation = rotation;
    this.radius = radius;
    this.username = username;
    this.id = id;
    this.level = level;

    this.alpha = 1;

    this.coordX = coordX;
    this.coordY = coordY;
    
    this.turret;

    this.draw = function(){
        var healthBarWidth = 50;

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
        var pos = cordsToScreenPos(this.coordX, this.coordY);
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
            this.turret.baseSize = this.radius / 2;
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
            var size = windowHeight / scale / 8;
            var padding = windowHeight / scale / 40;
            
            c.globalAlpha = .5;
            c.drawImage(getImage("S"), padding, windowHeight / scale - size - padding, size, size); 
            c.globalAlpha = 1;
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
    c.clearRect(0, 0, innerWidth, innerHeight);

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
                landed = true;
                targetScale = 120 / currentPlanet.radius;
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


        worldObjects.planets.forEach(function(planet){
            var x = planet.x - centerX;
            var y = planet.y - centerY;

            planetDist = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)); 

            if(planetDist <= MAX_GRAVITATIONAL_DISTACNE){
                var planetScaleFactor = (1 - planetDist / MAX_GRAVITATIONAL_DISTACNE) * PLANET_GRAVITY * planet.radius / 100; //Math.pow((1 - planetDist / MAX_GRAVITATIONAL_DISTACNE) * PLANET_GRAVITY, PLANET_GRAVITY_EXPONENT);

                if(planetScaleFactor > 0){
                    spaceshipVelocity.x += x * planetScaleFactor;
                    spaceshipVelocity.y += y * planetScaleFactor;
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
    
    //Draw -----------------------------------------------------------------------------------------------------------
    c.scale(scale, scale);

    drawGrid(gridPos.x + centerX, gridPos.y +  centerY, gridSize, gridSize, gridBoxScale);
    
    var allMatter = allWorldObjects.concat(otherPlayers);
    allMatter.forEach(function(matter){

        var pos = cordsToScreenPos(matter.coordX, matter.coordY);
        var size = matter.radius;

        if(matter.type == "sun"){
            size += 500;
        }

        var isClosestAvaiblePlanet = (closestAvailablePlanet != null && (matter.id  == closestAvailablePlanet.id));
        var isOwnedPlanet = findObjectWithId(ownedPlanets, matter.id)

        //Out of screen Right                           || Left             || Up               || Down
        if(!(pos.x - size > (windowWidth + centerX) / scale || pos.x + size < 0 || pos.y + size < 0 || pos.y - size > (windowHeight + centerY) / scale) || isClosestAvaiblePlanet || isOwnedPlanet != null){
            matter.health = healthDict[matter.id];
            matter.update();
        }

    });

    hittableObjects.forEach(function(obj){
        if(obj.radius && statsView && obj.active){
            var pos = cordsToScreenPos(obj.x, obj.y);

            c.beginPath();
            c.arc(pos.x, pos.y, obj.radius, 0, Math.PI * 2, false);
            c.lineWidth = 2;
            c.strokeStyle = "#f44242";
            c.stroke();
        }
    });

    if(spaceShip){
        var playerPos = new Vector(-gridPos.x, -gridPos.y);
        sendPlayerPosition(playerPos, spaceShip.rotation);
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
    
    if(closestAvailablePlanet && !currentPlanet && spaceShip){
        var size = Math.round(50 / scale);

        c.font = size + "px Arial";
        c.fillStyle = "white";
        c.globalAlpha = .2;
        c.textAlign="center"; 
        c.fillText("Press J to land", centerX, (canvas.height - 80) / scale);
        c.textAlign="left"; 

        c.globalAlpha = .5;

        c.beginPath();
        c.setLineDash([5, 15]);
        c.moveTo(centerX, centerY);
        c.strokeStyle = "gray";
        c.lineWidth = 5;
        c.lineTo(closestAvailablePlanet.x, closestAvailablePlanet.y);
        c.stroke();

        c.setLineDash([]);
        c.globalAlpha = 1;
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
                var arrowSize = 10 / scale;

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

        if(spaceShip.health > 0){

            var xPadding = 10;
            var yPadding = 10;

            displayBar(xPadding, yPadding, 200, 50, spaceShip.health / spaceShip.maxHealth, healthBarColor);
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
    
        if(currentPlanet && !planetEditMode){
            var size = windowHeight / 8;
            var padding = 20;
            c.globalAlpha = .5;
            c.drawImage(getImage("E"), padding, windowHeight - size - padding, size, size); 
            c.globalAlpha = 1;
        }

        if(planetEditMode){
    
            //Draw the structures aviable for placement on a planet w/ their costs
            var imageSizes = canvas.height / 7.5;
            var padding = canvas.height / 20;

            var xValue = canvas.width - imageSizes - padding;
    
            c.drawImage(getImage('turret0'), xValue, padding, imageSizes, imageSizes); 
            c.drawImage(getImage('mine0'), xValue, padding * 2 + imageSizes, imageSizes, imageSizes);
            c.drawImage(getImage('shield0'), xValue, padding * 3 + imageSizes * 2, imageSizes, imageSizes);     
            c.drawImage(getImage('landingPad0'), xValue, padding * 4 + imageSizes * 3, imageSizes, imageSizes);  
    
            //Display HotKeys
            var keyX = xValue + imageSizes / 2;

            c.textAlign = "center"; 
            c.fillStyle = "white";
            c.font = windowHeight / 15 + "px Helvetica";
            c.fillText("T", keyX, padding + imageSizes * .75);
            c.fillText("M", keyX, padding * 2 + imageSizes * 1.75);
            c.fillText("S", keyX, padding * 3 + imageSizes * 2.75);
            c.fillText("L", keyX, padding * 4 + imageSizes * 3.75);

            c.textAlign = "left"; 

            //Display Costs
            var structureCosts = [structureUpgrades["turret"][0].costs, structureUpgrades["mine"][0].costs, structureUpgrades["shield"][0].costs, structureUpgrades["landingPad"][0].costs];

            var costSize = canvas.height / 45;
            var costPadding = canvas.height / 75;
            var costY = padding + imageSizes + costPadding;

            structureCosts.forEach(costs => {
                
                var costX = 5;
                

                for (var cost in costs) {
                    if (costs.hasOwnProperty(cost)) {
                        c.drawImage(getImage(cost), xValue + costX, costY, costSize, costSize);
                        c.font = windowHeight / 50 + "px Helvetica";
                        c.fillStyle = "white";
                        c.fillText(costs[cost], xValue + costX + costSize * 1.2, costY + costSize / 1.3);
        
                        costX += costSize + costPadding * 3;
                    }
                }
                
                costY += padding + imageSizes;
            
            });
        }
        
    
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

}

function displayMessage(text, timeToFade, fadeSpeed){
    playerDisplayMessage = text
    playerMessageAlpha = 1;
    playerMessageFadeSpeed = fadeSpeed;
    playerMessageTimer = timeToFade;
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
            name = "Bullet Penetration"
            description = "Bullets go through multiple objects, damaging each one.";
        break;
        case "boost":
            name = "Speed Boost"
            description = "Press and hold Shift to get a temoporaty speed boost.";
        break;
        case "cloakTime":
            name = "Invisibility"
            description = "Press C to get temporaty invisibility";
        break;
        case "shipTurret":
            name = "Ship Turret"
            description = "Mounts an auto firing and aiming turret onto your ship."
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
                    c.drawImage(getImage(cost), costX, costY, costSize, costSize);
                    c.font = costSize / 1.5 + "px Helvetica";
                    c.fillStyle = "white";
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
                            c.drawImage(getImage(cost), drawx + costX, drawy + costY, costSize, costSize);
                            c.font = size / 4 + "px Helvetica";
                            c.fillStyle = "white";
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
                                c.drawImage(getImage(cost), drawx + costX, groupCostY, costSize, costSize);
                                c.font = size / 4 + "px Helvetica";
                                c.fillStyle = "white";
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
                                c.drawImage(getImage(cost), drawx + costX, drawy + costY, costSize, costSize);
                                c.font = size / 4 + "px Helvetica";
                                c.fillStyle = "white";
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
                            var data = {id: upgradeId, senderId: clientId, worldId: worldId}
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

function displayResources(){
    c.font = "30px Arial";
    pos = new Vector(10, 70);
    size = 50;
    padding = 25;

    
    for (var item in playerItems) {
        if (playerItems.hasOwnProperty(item)) {
            if(getImage(item)){
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

function shoot(x, y, rotation, speed, size, bulletPenetration, color, shooterId){
    velocity = new Vector();
    velocity.setMagnitude(speed);
    velocity.setDirection(rotation - 1.5708);
    var projId = uniqueId();
    
    projectile = new Projectile(x, y, velocity, size, color, bulletPenetration, false, projId);
    projectiles.push(projectile);
    sendProjectile(x, y, velocity, size, color, projId, shooterId);
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

function drawPointAroundCircle(startx, starty, radius, angle, distance){
    var x = startx + radius * Math.cos(-angle*Math.PI/180) * distance;
    var y = starty + radius * Math.sin(-angle*Math.PI/180) * distance;

    structureSpawnPosition = new Vector(x, y);

    rectWidth = 30;
    rectHeight = 30;

    c.save();
    c.translate(x, y);
    c.rotate(angle / -57.2958);
    c.fillStyle = "#42aaf4";
    c.fillRect(-rectWidth/2+20,-rectHeight/2,rectWidth,rectHeight);
    c.restore();
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


