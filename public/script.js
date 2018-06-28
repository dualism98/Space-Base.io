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
var hittableStructures = [];
var gridSize;
var gridBoxScale;
var gridPos;
var worldId;

function allWorldObjects(){
    var objects = [];
    for (var matterArray in worldObjects) {
        if (worldObjects.hasOwnProperty(matterArray)) {
            if(matterArray != "players"){
                worldObjects[matterArray].forEach(matter => {
                    if(matter.health > 0 )
                    objects.push(matter);
                });
            }
        }
    }

    if(spaceShip)
        objects.push(spaceShip);

    return objects;
}

function allStructures(){
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
    return structures;
}

//Variables
var centerX;
var centerY;
var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var spaceShip;

var PLANET_GRAVITY = .0025;
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

function getImage(item){
    var img = new Image();
        img.src = item + '.png';
        
        return img;
}

var upgradeables = [];
var structureUpgradeables = [];

var structureUpgrades;
var playerUpgrades;

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

function setup(){
    //socket = io.connect('http://localhost:8080');
    //socket = io.connect('http://iogame-iogame.193b.starter-ca-central-1.openshiftapps.com/');
    socket = io.connect('https://desolate-wave-85781.herokuapp.com/');
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
    socket.on("unsuccessfulUpgrade", unsuccessfulUpgrade);
    socket.on("serverDisconect", forceDisconnect);
    socket.on("planetOccupancy", updatePlanetOccupier);
    socket.on("mineProduce", mineProduce);
    socket.on("respawn", respawn);
    socket.on("newWorldObjectSync", newWorldObjectSync);

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
    gridPos = new Vector(gridSize / -2, gridSize / -2);

    //Spawn other players
    otherPlayers = [];

    for(var i = 0; i < data.existingPlayers.length; i++){
        client = data.existingPlayers[i];

        if(client.id != clientId){
            otherPlayers.push(new NetworkSpaceShip(client.coordX, client.coordY, client.maxHealth, client.health, 0, client.level, client.radius, client.username, client.id));
        }
        
    }

    //Spawn World Objects
    worldObjects = {astroids: [], planets: []};// = data.worldObjects;

    //Astroids
    for(var i = 0; i < data.worldObjects.astroids.length; i++){

        var astroid = data.worldObjects.astroids[i];

        if(astroid.health <= 0)
            continue;

        var astroidObject = new SpaceMatter(astroid.x, astroid.y, astroid.radius, astroid.color, astroid.maxHealth, astroid.health, astroid.type, astroid.id);
        worldObjects.astroids.push(astroidObject);
    }

    //Planets
    for(var i = 0; i < data.worldObjects.planets.length; i++){

        var planet = data.worldObjects.planets[i];

        if(planet.health <= 0)
            continue;

        var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, planet.id);
        planetObject.occupiedBy = planet.occupiedBy;

        //Add all existing structures
        for (let i = 0; i < planet.structures.length; i++) {
            const structure = planet.structures[i];
            planetObject.addStructure(planetObject, structure.x, structure.y, structure.rotation, structure.type, structure.level, true, structure.ownerId, structure.id);
        }

        worldObjects.planets.push(planetObject);
    }
}

function newWorldObjectSync(data){
    
    if(data.newObject.type == "planet"){
        var planet = data.newObject;
        var planetObject = new Planet(planet.x, planet.y, planet.radius, planet.color, planet.health, planet.maxHealth, data.id);
        planetObject.occupiedBy = planet.occupiedBy;

        var changedPlanet = findObjectWithId(worldObjects.planets, data.id)
        worldObjects.planets[changedPlanet.index] = planetObject;
    }
    else{
        var newSpaceMatter = new SpaceMatter(data.newObject.x, data.newObject.y, data.newObject.radius, data.newObject.color, data.newObject.maxHealth, data.newObject.health, data.newObject.type, data.id);
        var changedSpaceMatter = findObjectWithId(worldObjects.astroids, data.id)
        worldObjects.astroids[changedSpaceMatter.index] = newSpaceMatter;
    }

}

function receiveDamageSync(data){

    for (let i = 0; i < data.hittableObjects.length; i++) {
        const sentHittableObject = data.hittableObjects[i];
        
        healthDict[sentHittableObject.id] = sentHittableObject.health;

        if(clientId != sentHittableObject.id){
            var localObj = findObjectWithId(hittableObjects, sentHittableObject.id);

            if(localObj){
                if(sentHittableObject.health > 0)
                    hittableObjects[localObj.index] = sentHittableObject;
                else
                    hittableObjects.splice(localObj.index, 1);
            }
            else{
                if(sentHittableObject.health > 0)
                    hittableObjects.push(sentHittableObject);
            }
        }
    }
}

function showWorld(){

//cancelAnimationFrame(requestAnimationFrameId);

    if(requestAnimationFrameId){
        location.reload();
    }
    animate();
}

function startLocalPlayer(data){
    gridPos = new Vector(gridSize / -2 - data.x, gridSize / -2 - data.y);//new Vector(gridSize / -2, gridSize / -2);
    upgradeables.push(clientId);
    friendlyObjectIds = [clientId];

    //Spawn client player
    spaceShip = new SpaceShip(centerX, centerY, data.maxHealth, data.health, data.level, data.radius, data.speed, data.turningSpeed, data.fireRate, clientId);
}
function newPlayer(data){
    otherPlayers.push(new NetworkSpaceShip(data.x, data.y, data.maxHealth, data.health, data.rotation, data.level, data.radius, data.username, data.id));
}

function respawn(){

    scale = 1;
    spaceShip = null;
    upgradeables = [];
    structureUpgradeables = [];

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
    var pos = cordsToScreenPos(data.x, data.y);
    otherProjectiles.push(new FacadeProjectile(pos.x, pos.y, data.vel, data.size, data.color, data.id));
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
}

function receiveUpgradeInfo(data){

    structureUpgrades = data.structureUpgrades;
    playerUpgrades = data.playerUpgrades;

    // for (var upgrade in data) {
    //     if (data.hasOwnProperty(upgrade)) {
    //         upgrades[upgrade] = data[upgrade];
    //     }
    // }
}

function unsuccessfulUpgrade(data){
    displayMessage(data, 10, 5);
}

function upgradeSync(data){

    var allUpgradeables = allWorldObjects().concat(allStructures()).concat(otherPlayers);

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

function mineProduce(data){
    data.forEach(mine => {
        localMine = findObjectWithId(producingMines, mine.id);

        if(localMine)
            localMine.object.productionEffect(mine.ammount);
    
        if(playerItems[mine.item])
            playerItems[mine.item] += mine.ammount;
        else 
        {
            playerItems[mine.item] = mine.ammount;
        }

    });
    
}

function onAquiredItems(data){
    console.log("received ", data);

    for (var drop in data.drops) {
        if (data.drops.hasOwnProperty(drop)) {
            if(playerItems[drop])
                playerItems[drop] += data.drops[drop];
            else
                playerItems[drop] = data.drops[drop];
        }
    }
}

function playerExited(data){

    otherPlayer = findObjectWithId(otherPlayers, data.clinetId);

    if(otherPlayer){
        otherPlayers.splice(otherPlayer.index, 1);

        var structureObejcts = [];
    
        allStructures().forEach(structure => {
            data.structureIds.forEach(id => {
                if(id == structure.id){
                    planet = findObjectWithId(worldObjects.planets, structure.planet.id);
                    planetStructureIndex = findObjectWithId(planet.object.structures, structure.id).index;
                    planet.object.structures.splice(planetStructureIndex, 1);
                }
            });
        });
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

function sendDamage(projectileId, subjectId){
    var data = {
        id: subjectId,
        senderId: clientId,
        projectileId: projectileId,
        worldId: worldId
    }

    socket.emit('damage', data);
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

$(document).keypress(function(e){
    if(currentPlanet && spaceShip){

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
                
            currentPlanet = null;
            planetEditMode = false;
        }
    }
    else{

        if(e.keyCode == 32){ //SPACE
            if(playerReloadTimer <= 0){
                shoot(-gridPos.x, -gridPos.y, spaceShip.rotation, PROJECTIILE_SPEED, spaceShip.radius / 4, "red", clientId);
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

        if(this.shield == null){
            healthBarWidth = 100;
            if(this.health != this.maxHealth)
                displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, healthBarWidth, 20, this.health / this.maxHealth, "green");
        }

        if(planetEditMode && currentPlanet == this){
            var rad = Math.atan2(mouse.y - this.y, mouse.x - this.x) * -57.2958;
            structureSpawnRotation = rad;
            drawPointAroundCircle(this.x, this.y, radius, rad, 1);
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
            
            if(!isFacade)
                friendlyObjectIds.push(planet.id);
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

        var hittableObj = findObjectWithId(hittableObjects, this.id).object;

        displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, 300, 20, hittableObj.health / hittableObj.maxHealth, "blue");
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

    this.distanceFromPlanet = 20;

    var test = false;

    this.level = level;

    this.draw = function(){

        c.save();
        c.translate(this.x, this.y);
        c.rotate((rotation - 90) / -57.2958);
        c.fillStyle = this.color ;
        c.drawImage(getImage('mine' + this.level), -this.size + this.distanceFromPlanet, -this.size, this.size, this.size);

        
        //c.fillRect(-this.size/2 + this.distanceFromPLanet,-this.size/2,this.size,this.size);
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

    this.distanceFromPlanet = 20;
    this.range = 500;
    this.target;

    this.level = level;

    this.shootInterval = 100;
    this.shootCounter = 0;
    this.projectileSpeed = 5;

    this.shootPoint = new Vector();

    this.draw = function(){

        //Draw Base
        c.save();
        c.translate(this.x, this.y);
        c.rotate((this.rotation - 90) / -57.2958);
        //c.fillStyle = planetColors[2];
        c.drawImage(getImage('turret' + this.level), -this.baseSize + this.distanceFromPlanet, -this.baseSize, this.baseSize, this.baseSize);
        //c.fillRect(-this.baseSize/2 + this.distanceFromPlanet,-this.baseSize/2,this.baseSize,this.baseSize);
        c.restore();

        var distanceFromBase = 30;

        var l = this.x - this.planet.x;
        var h = this.y - this.planet.y;

        var hyp = this.planet.radius;

        var cx = hyp + distanceFromBase;

        var x = l * (cx / hyp);
        var y = h * (cx / hyp);

        var headX = this.planet.x + x;
        var headY = this.planet.y + y

        this.shootPoint = new Vector(headX, headY);
        
        var rad = 0;

        //Draw Head
        if(this.target)
            var rad = Math.atan2(this.target.y - headY, this.target.x - headX);
            this.headRotation = rad * 180 / Math.PI;

        c.save();
        c.translate(headX, headY);
        c.rotate(rad);
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

                var angle = Math.atan2((this.shootPoint.y - this.target.y), (this.shootPoint.x - this.target.x)) - 1.5708;

                shoot(spawnPos.x, spawnPos.y, angle, this.projectileSpeed, 5, "#d87927", this.id);
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
            
            if(player.id == ownerId)
                continue;


            var distance = Math.sqrt(Math.pow(this.x - player.x, 2) + Math.pow(this.y - player.y, 2));

            if(this.target != null){
                var x = (this.target.x - this.planet.x + gridPos.x) * -1;
                var y = (this.target.y - this.planet.y + gridPos.y) * -1;
    
                this.target.screenPosition = new Vector(x, y)
    
                var targetDistance = Math.sqrt(Math.pow(this.x - this.target.screenPosition.x, 2) + Math.pow(this.y - this.target.screenPosition .y, 2));
    
                if(distance < targetDistance && distance <= this.range)
                    this.target = player;
            }
            else if(distance <= this.range)
                this.target = player;
            
            
                
        }
    }
}
function Projectile(x, y, velocity, radius, color, id){
    this.pos = new Vector(x, y);
    this.radius = radius;
    this.vel = velocity;
    this.id = id;
    this.color = color;

    this.hit = false;

    this.draw = function(){
        c.fillStyle = this.color;
        c.beginPath();
        c.shadowBlur = 20;
        c.shadowColor = color;
        c.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2, false);
        c.fill();
        c.shadowBlur = 0;
    }
    this.update = function(){
        this.pos.add(this.vel);

        if(!this.checkForCollisions()){
            this.draw();
        }
    }

    this.checkForCollisions = function(){   //Check for collisions in Hittable Objects
        for(var i = 0; i < hittableObjects.length; i++){

            if(this.isFriendly(hittableObjects[i].id))
                continue;

            var pos = cordsToScreenPos(hittableObjects[i].x, hittableObjects[i].y);
            var hitObject = {x: pos.x, y: pos.y, radius: hittableObjects[i].radius} 

            if(isCollidingCircles(this, hitObject)){
                sendDamage(this.id, hittableObjects[i].id);
                this.hit = true;

                var data = {id: this.id, worldId: worldId}
                socket.emit('projDestroy', data);
                return true;
            }
        }
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
    //var distance = Math.sqrt(Math.pow(projectile.pos.x - subject.x, 2) + Math.pow(projectile.pos.y - subject.y, 2));
    return(distance < projectile.radius + subject.radius);
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

    this.coordX = coordX;
    this.coordY = coordY;
    

    this.draw = function(){
        var healthBarWidth = 50;

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

        this.draw();

        //Display username above person
        c.font = "20px Arial";
        c.fillStyle = "white";
        c.globalAlpha = .5;
        c.textAlign = "center"; 
        c.fillText(this.username, this.x, this.y - radius - 20);

        c.textAlign = "left"; 
        c.globalAlpha = 1;
    }
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

        if(this.type == "crystal"){
    
            c.beginPath();
            spikyBall(c, this.x, this.y, this.radius, 20, 0, -Math.PI/2, .75);
            c.fillStyle = this.color;
            c.fill();

            c.beginPath();
            spikyBall(c, this.x, this.y, this.radius - 5, 20, 0, -Math.PI/2, .75);
            c.fillStyle = shadeColorHex(this.color, 10);
            c.fill();
        }
        else if(this.type == "astroid"){
            c.fillStyle = this.color;
            c.beginPath();
            c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            c.fill();
    
            c.beginPath();
            c.arc(this.x, this.y, this.radius - 4, 0, Math.PI * 2, false);
            c.fillStyle = shadeColorHex(this.color, 10);
            c.fill();
        }
        else if(this.type == "sun"){
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
        }
        else if(this.type == "moon"){

            c.fillStyle = this.color;
            c.beginPath();
            c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
            c.fill();

            c.beginPath();
            polygon(c, this.x, this.y, this.radius - 5, 11, 0, -Math.PI/2);
            c.fillStyle = shadeColorHex(this.color, 10);
            c.fill();
            
        }

        if(this.health != this.maxHealth)
            displayBar(this.x - healthBarWidth / 2, this.y - this.radius + yOffset, healthBarWidth, healthBarHeight, this.health / this.maxHealth, "#36a52c");

    
        c.shadowBlur = 0;
    }
    this.update = function(){
        var pos = cordsToScreenPos(this.coordX, this.coordY);

        this.x = pos.x;
        this.y = pos.y;
        this.draw();
    }
}

function SpaceShip(x, y, maxHealth, health, level, radius, speed, turningSpeed, fireRate, id){

    this.pos = new Vector(x, y);
    this.rotation = 0;
    this.radius = radius;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.speed = speed;
    this.fireRate = fireRate;
    this.turningSpeed = turningSpeed;
    this.id = id;

    this.level = level;

    this.draw = function(){

        var mouseRad = Math.atan2(mouse.y - centerY, mouse.x - centerX) + 90 * Math.PI / 180;
        
        var rad = this.rotation + shortAngleDist(this.rotation, mouseRad) * this.turningSpeed;

        c.translate(centerX, centerY);
        c.rotate(rad);
        c.drawImage(getImage('spaceship' + this.level), -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.rotate(-rad);
        c.translate(-centerX, -centerY);

        this.rotation = rad;
    }
    this.update = function(){
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

    centerX = (canvas.width / 2 / scale);
    centerY = (canvas.height / 2 / scale);

    requestAnimationFrameId = requestAnimationFrame(animate);
    c.clearRect(0, 0, innerWidth, innerHeight);


    if(spaceShip){

        var targetScale = 50 / spaceShip.radius;
        var scaleTime = 50;
        var scaleSpeed = 3;

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

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        centerX = (canvas.width / 2 / scale);
        centerY = (canvas.height / 2 / scale);


        var mousePullxTarget = 0;
        var mousePullyTarget = 0;

        if(currentPlanet){
            currentPlanet.structures.forEach(structure => {
                if(!structureUpgradeables.contains(structure.id))
                    structureUpgradeables.push(structure.id);
            });

            mousePullxTarget = currentPlanet.x - centerX;
            mousePullyTarget = currentPlanet.y - centerY;
        }
        else {

            structureUpgradeables = [];

            if(mouse.clicked){

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
        if(forceVector.getMagnitude() > 10){
            forceVector.setMagnitude(10);
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
                //var planetScaleFactor = (PLANET_GRAVITY) / Math.pow(planetDist / 10, PLANET_GRAVITY_EXPONENT);

                var planetScaleFactor = (1 - planetDist / MAX_GRAVITATIONAL_DISTACNE) * PLANET_GRAVITY * planet.radius / 100; //Math.pow((1 - planetDist / MAX_GRAVITATIONAL_DISTACNE) * PLANET_GRAVITY, PLANET_GRAVITY_EXPONENT);

                spaceshipVelocity.x += x * planetScaleFactor;
                spaceshipVelocity.y += y * planetScaleFactor;
            }
            
            
        });

        spaceShip.x = (gridPos.x + gridSize / 2) * -1;
        spaceShip.y = gridPos.y + gridSize / 2;
    
        //Screen Bounds
        //Left 
        if(spaceShip.x <= gridSize/2 * -1 && spaceshipVelocity.x < 0){
            spaceshipVelocity.x = 0;
        }
        //Right 
        if(spaceShip.x >= gridSize/2 && spaceshipVelocity.x > 0){
            spaceshipVelocity.x = 0;
        }
        //Top 
        if(spaceShip.y <= gridSize/2 * -1 && spaceshipVelocity.y > 0){
            spaceshipVelocity.y = 0;
        }
        //Bottom 
        if(spaceShip.y >= gridSize/2 && spaceshipVelocity.y < 0){
            spaceshipVelocity.y = 0;
        }
        
        gridPos.x -= spaceshipVelocity.x;
        gridPos.y -= spaceshipVelocity.y;
    
    
        worldObjects.planets.forEach(function(planet){
            planet.structures.forEach(function(structure){
                structure.health = healthDict[structure.id];
            });
        });
    
    
        if(!currentPlanet)
            closestAvailablePlanet = findClosestUnoccupiedPlanet();
    }
    else{
        spaceshipVelocity.x = 0;
        spaceshipVelocity.y = 0;
    }
    
    //Draw -----------------------------------------------------------------------------------------------------------
    c.scale(scale, scale);

    drawGrid(gridPos.x + centerX, gridPos.y +  centerY, gridSize, gridSize, gridBoxScale);


    allWorldObjects().concat(otherPlayers).forEach(function(matter){

        var pos = cordsToScreenPos(matter.coordX, matter.coordY);
        var size = matter.radius;

        if(matter.type == "sun"){
            size += 500;
        }

        //Out of screen Right                           || Left             || Up               || Down
        if(!(pos.x - size > ($(window).width() + centerX) / scale || pos.x + size < 0 || pos.y + size < 0 || pos.y - size > ($(window).height() + centerY) / scale)){
            matter.health = healthDict[matter.id];
            matter.update();
        }


    });

    hittableObjects.forEach(function(obj){

        if(obj.radius && statsView){

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
        spaceShip.update();
    }

    for(var i = projectiles.length - 1; i >= 0; i--){
        var projectile = projectiles[i];

        projectile.pos.x -= spaceshipVelocity.x;
        projectile.pos.y -= spaceshipVelocity.y;

        projectile.update();

        if(projectile.hit)
            projectiles.splice(i, 1);
    }

    //NetworkedProjectiles
    for(var i = 0; i < otherProjectiles.length; i++){
        proj = otherProjectiles[i];
        proj.pos.x -= spaceshipVelocity.x;
        proj.pos.y -= spaceshipVelocity.y;
        proj.update();
    }
    
    if(closestAvailablePlanet && !currentPlanet){

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

    var isInSun = false;

    c.scale(1 / scale, 1 / scale);

    worldObjects.astroids.forEach(spaceMatter => {
        
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
            var size = 100;
            var padding = 20;
            c.globalAlpha = .5;
            c.drawImage(getImage("E"), padding, canvas.height - size - padding, size, size); 
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
            c.font = $(window).height() / 15 + "px Helvetica";
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
                        c.font = $(window).height() / 50 + "px Helvetica";
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
            c.fillText("x: " + Math.round(spaceShip.x) + " y: " + Math.round(spaceShip.y), 5, canvas.height - 5);
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


var expandedUpgrades = [];
var canClickArrow = true;

function showUpgrades(){
    numberOfUpgrades = upgradeableObjects().length;
    size = $(window).height() / 10;
    padding = $(window).height() / 10;

    var groupedUpgrades = {};
    var numberOfGroups = 0;

    for(var i = 0; i < numberOfUpgrades; i++){
    
        var upgradeeId = upgradeableObjects()[i];
        var upgrade = Object.assign({}, findUpgrade(upgradeeId));

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

            
            var costSize = $(window).height() / 40;
            var costPadding = $(window).height() / 100;
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
                var arrowSize = size / 4;
                var arrowX = drawx + size / 2;
                var arrowY = drawy - arrowSize - costPadding;

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
                        //groupCostY = size + 10;

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

                        upgradeButtons.push({x: drawx, y: groupY, upgrades: [upgradeInGroup.id]});
                        c.drawImage(getImage(upgradeInGroup.identifier + upgradeInGroup.upgradeToLevel), drawx, groupY, size, size);

                        c.fillStyle = planetColors[0];
                        c.fillRect(drawx, groupY, size, size);
                        c.globalAlpha = 1;

                        numberOfUpgrades++;
                        groupCostY += size + costPadding;
                        groupY += numberOfCosts * (costPadding + costSize) + size + costPadding;
                    }
                    
                }
                else
                {
                    var insertedCosts = [];
                    var buttonUpgrades = [];

                    for(var i = 0; i < numberInGroup; i++){
    
                        var upgradeInGroup = groupedUpgrades[group][i];

                        buttonUpgrades.push(upgradeInGroup.id);

                        if(!upgradeInGroup.fullyUpgraded){
                            
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
                    }

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

                    c.globalAlpha = .5;
                    c.fillStyle = planetColors[0];
                    c.fillRect(drawx, drawy, size, size);

                    c.drawImage(getImage(upgrade.identifier + upgrade.upgradeToLevel), drawx, drawy, size, size);


                    c.globalAlpha = 1;
                    
                    c.font = size / 7 + "px Helvetica";
                    c.textAlign = "center";
                    c.fillStyle = "white";
                    c.fillText("Upgrade all (" + numberInGroup + ")", drawx + size / 2, drawy + size  / 2);
                    c.textAlign = "left";

                }
                
                var arrowRotation = Math.PI * 1.25;

                if(expandedUpgrades.contains(upgrade.identifier))
                {
                    arrowRotation = Math.PI / 4;
                }

                if (mouseY > arrowbuttonY && mouseY < arrowbuttonY + arrowButtonSize && mouseX > arrowbuttonX && mouseX < arrowbuttonX + arrowButtonSize) {

                    var arrowIncreasedSize = arrowSize * 1.2;

                    c.translate(arrowX, arrowY);
                    c.rotate(arrowRotation);
                    c.drawImage(getImage('downArrow'), -arrowIncreasedSize / 2, -arrowIncreasedSize / 2, arrowIncreasedSize, arrowIncreasedSize);
                    c.rotate(-arrowRotation);
                    c.translate(-arrowX, -arrowY);

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
                    c.translate(arrowX, arrowY);
                    c.rotate(arrowRotation);
                    c.drawImage(getImage('downArrow'), -arrowSize / 2, -arrowSize / 2, arrowSize, arrowSize);
                    c.rotate(-arrowRotation);
                    c.translate(-arrowX, -arrowY);
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
                        var object = findObjectWithId(allStructures().concat(spaceShip), upgradeId).object;
    
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


            // if(numberInGroup == 1)
            // {
            //     if(!upgrade.fullyUpgraded){

            //         var upgradeCosts = upgrade.costs
            //         var costX = 0;
            //         var costY = size + 10;
            //         var costSize = 25;
            //         var costPadding = 10;
                    
            //         for (var cost in upgradeCosts) {
            //             if (upgradeCosts.hasOwnProperty(cost)) {
            //                 c.drawImage(getImage(cost), drawx + costX, drawy + costY, costSize, costSize);
            //                 c.font = " 20px Helvetica";
            //                 c.fillStyle = "white";
            //                 c.fillText(upgradeCosts[cost], drawx + costX + costSize * 1.2, drawy + costY + costSize / 1.3);
            
            //                 costY += costSize + costPadding;
            //             }
            //         }
            
            //         if (mouse.y > buttonY && mouse.y < buttonY + size / scale && mouse.x > buttonX && mouse.x < buttonX + size / scale) {
            //             if(mouse.clicked){
            //                 var data = {id: upgradeableObjects()[i], senderId: clientId, worldId: worldId}
            //                 socket.emit('upgradeRequest', data);
            //                 clickedUpgrade = true;
            //             }
                        
            //             var object = findObjectWithId(upgrade.id).object;
        
            //             var circleX = object.x * scale;
            //             var circleY = object.y * scale;
        
            //             c.globalAlpha = .5;
            //             c.fillStyle = planetColors[i];
            //             c.fillRect(drawx, drawy, size, size);
            //             c.globalAlpha = 1;
        
            //             if(object != spaceShip){
            //                 c.beginPath();
            //                 c.lineWidth = 3;
            //                 c.strokeStyle = "#9ef442";
            //                 c.arc(circleX, circleY, 10,0,2*Math.PI);
            //                 c.stroke();
            //             }
            //         }
            //     }
            //     else //fully upgraded
            //     {
            //         c.font = " 15px Helvetica";
            //         c.fillStyle = "white";
            //         c.rotate(45);
            //         c.fillText("Fully Upgraded", drawx, drawy - 20);
            //     }
            // }
            // else{
            //     //c.translate(drawx, drawy);
            //     //c.rotate(Math.PI / 4);
            //     c.drawImage(getImage('downArrow'), drawx, drawy, size, size);
            //     //c.rotate(-Math.PI / 4);
            //     //c.translate(-drawx, -drawy);
            // }
        
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

    c.fillStyle = "white";

    for (var item in playerItems) {
        if (playerItems.hasOwnProperty(item)) {
            if(getImage(item)){
                c.drawImage(getImage(item), pos.x, pos.y, size, size);
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

function shoot(x, y, rotation, speed, size, color, shooterId){
    velocity = new Vector();
    velocity.setMagnitude(speed);
    velocity.setDirection(rotation - 1.5708);
    var projId = uniqueId();

    var localPos = cordsToScreenPos(x, y);

    projectile = new Projectile(localPos.x, localPos.y, velocity, size, color, projId);
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
    x = x - gridPos.x - centerX;
    y = y - gridPos.y - centerY;

    return new Vector(x,y)
}

function cordsToScreenPos(x, y){
    x = x + centerX + gridPos.x;
    y = y + centerY + gridPos.y;

    return new Vector(x,y)
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

        var upgradee = findObjectWithId(allWorldObjects().concat(allStructures()), id).object;

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


