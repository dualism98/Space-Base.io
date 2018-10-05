var express = require('express');
var socket = require('socket.io');

var app = express();

//var server = app.listen(process.env.PORT, "0.0.0.0");
var server = app.listen(8080, "0.0.0.0");
app.use(express.static('public'));
var io = require('socket.io').listen(server);   //socket(server);

var worldsData = {};
var worldIds = [];

console.log("server started");

//Server Config Options
var numOfasteroids = 4000;
var numOfPlanets = 50;
var numOfMoons = 200;
var numOfSuns = 10;
var numOfCrystals = 150;
var numOfBlackHoles = 8;
var numOfWormHoles = 6;
var gridSize = 15000;
var gridBoxScale = 200;
var spawnTries = 5;

// var numOfasteroids = 0;
// var numOfPlanets = 0;
// var numOfMoons = 0;
// var numOfSuns = 0;
// var numOfCrystals = 0;
// var numOfBlackHoles = 0;
// var numOfWormHoles = 6;
// var gridSize = 2000;
// var gridBoxScale = 10;
// var spawnTries = 5;

var edgeSpawnPadding = 2000;
var precentItemKillBoost = .5;

var mineProductionRate = 2500;
var despawnProjectilesRate = 100;
var shieldHealRate = 1000;
var sunDamageRate = 1000;

var unspawnedObjects = [];

var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var crystalColors = ["#5b94ef", "#d957ed", "#f9f454", "#85f954"];
var moonColors = ["#929aa8", "#758196", "#758196", "#2d3c56"];

var clientsPerWorld = 30;
var numberOfWorlds = 0;

var levelsLostOnDeath = 2;
var maxNumberOwnedPlanets = 1;

var maxPlanetObjects = {
    mine: 5,
    turret: 5,
    shield: 1,
    landingPad: 1
};

function positonAviable(size, x, y, hittableObjectsRef) {

    for(var i = 0; i < hittableObjectsRef.length; i++){
        var distance = Math.sqrt(Math.pow((hittableObjectsRef[i].x - x), 2) + Math.pow((hittableObjectsRef[i].y - y), 2));

        if(distance < hittableObjectsRef[i].radius + size)
            return false;
    }

    return true;
}

function generatePlanet(size, color, health, drops, worldObjectsRef, hittableObjectsRef, id = uniqueId()){

    var position = {};
    var reptitions = 0;

    do {
        position = randGenPoint(size);

        if(reptitions > spawnTries){
            console.log("not spawned, too many itterations");
            return false;
        }

        reptitions++;
    } while (!positonAviable(size, position.x, position.y, hittableObjectsRef));

    var structures = [];
    var planet = new Planet(position.x , position.y , size, structures, color, health, drops, id);

    hittableObjectsRef.push(planet);
    worldObjectsRef.planets.push(planet);
    
    return planet;
}

function generateSpaceMatter(size, color, health, drops, worldObjectsRef, hittableObjectsRef, type, id = uniqueId()){
    var position = {};
    var reptitions = 0;

    var objectId;

    do {
        position = randGenPoint(size);

        if(reptitions > spawnTries){
            console.log("not spawned, too many itterations");
            return false;
        }

        reptitions++

    } while (!positonAviable(size, position.x, position.y, hittableObjectsRef));

    var spaceMatter = new SpaceMatter(position.x, position.y, size, color, health, drops, type, id);
    
    hittableObjectsRef.push(spaceMatter);
    worldObjectsRef.asteroids.push(spaceMatter);

    return spaceMatter;
}

function addWorld(){
    var objects = generateWorld();
    var worldId = uniqueId();

    worldsData[worldId] = {
        clients: [],
        lobbyClients: [],
        worldObjects: objects.worldObjects,
        hittableObjects: objects.hittableObjects,
        projectiles: []
    }

    worldIds.push(worldId);

    numberOfWorlds++;
    console.log('generated new world. total: ', numberOfWorlds);

    return worldId;
}

function removeWorld(worldId){

    for(var i = 0; i < worldIds.length; i++){
        if(worldIds[i] == worldId)
            worldIds.splice(i, 1);
    }

    delete worldsData[worldId];

    numberOfWorlds--;
    console.log('deleted world. total: ', numberOfWorlds, "worldIds: ", worldIds.length);
}

function generateWorld(){

    var generatedWorldObjects = {
        planets: [],
        asteroids: [],
        shops: []
    };

    var generatedHittableObjects = [];

    var shopSize = 200;
    var shop1 = new Shop(gridSize / 4, gridSize / 4, shopSize, "bulletPenetration"); //TOP LEFT
    var shop2 = new Shop(gridSize / 4 * 3, gridSize / 4, shopSize, "cloakTime"); //TOP RIGHT
    var shop3 = new Shop(gridSize / 4, gridSize / 4 * 3, shopSize, "boost"); //BOTTOM LEFT
    var shop4 = new Shop(gridSize / 4 * 3, gridSize / 4 * 3, shopSize, "shipTurret"); //BOTTOM RIGHT

    generatedWorldObjects.shops.push(shop1, shop2, shop3, shop4);
    generatedHittableObjects.push(shop1, shop2, shop3, shop4);

    for(var i = 0; i < numOfSuns; i++){

        var sunColors = ["#ffd13f", "#fffc70", "#ff7023", "#d6fff6"];

        var colorindex = getRndInteger(0, sunColors.length - 1);
        var color = sunColors[colorindex];
        var type = "sun";
        var size = getRndInteger(500, 700);
        var health = size / 4;

        var drops = {stardust: 25};
        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }
    for(var i = 0; i < numOfPlanets; i++){

        var colorindex = Math.round(getRndInteger(0, planetColors.length - 1));
        var color = planetColors[colorindex];
        var planetSize = getRndInteger(100, 300);
        var planetHealth = planetSize * 40;
        
        var drops = {asteroidBits: Math.round(planetSize * 12), water: Math.round(planetSize * 4), earth: Math.round(planetSize * 6), iron: Math.round(planetSize * 5)};

        generatePlanet(planetSize, color, planetHealth, drops, generatedWorldObjects, generatedHittableObjects);
    }

    for(var i = 0; i < numOfMoons; i++){
        var colorindex = getRndInteger(0, moonColors.length - 1);
        var color = moonColors[colorindex];
        var size = getRndInteger(50, 75);
        var health = size * 5;
        var type = "moon";
        var drops = {asteroidBits: Math.round(size * 2.4), water: Math.round(size / 2), iron: Math.round(size * 1.6)};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfasteroids; i++){

        var asteroidSize = getRndInteger(10, 30);
        var asteroidColor = getRandomGray();
        var asteroidHealth = asteroidSize * .4;
        var type = "asteroid";
        var drops = {asteroidBits: Math.round(asteroidSize / 2.5), water: Math.round(asteroidSize / 10)};

        generateSpaceMatter(asteroidSize, asteroidColor, asteroidHealth, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfCrystals; i++){

        var colorindex = getRndInteger(0, crystalColors.length - 1);
        var color = crystalColors[colorindex];
        var type = "crystal";
        var size = getRndInteger(10, 20);
        var health = size * 15;
        var drops = {crystal: Math.round(size / 1.8)};

        var gems = getRndInteger(1, 3);

        if(gems > 0)
            drops.gem = gems;

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfBlackHoles; i++){

        var color = "black";
        var type = "blackHole";
        var size = getRndInteger(80, 100);
        var health = size;
        var drops = {};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    console.log('world generation complete: /n', generatedWorldObjects.asteroids.length, ' asteroids spawned /n', generatedWorldObjects.planets.length, ' planets spawned');

    return {worldObjects: generatedWorldObjects, hittableObjects: generatedHittableObjects};
}

function SpaceMatter(x, y, radius, color, maxHealth, drops, type, id){
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.drops = drops;
    this.type = type;
    this.id = id;
}

function Player(x, y, rotation, level, id, worldId){
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.id = id;
    this.worldId = worldId;
    this.level = level;
    this.drops = {gem: 10000, iron: 100000, asteroidBits: 1000000, earth: 100000, water: 100000, crystal: 100000};

    this.shipTurret;

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

    this.bulletRange = playerUpgrades[level].bulletRange;
    this.turningSpeed = playerUpgrades[level].turningSpeed;
    this.radius = playerUpgrades[level].radius;
    this.damage = playerUpgrades[level].damage;
    this.maxHealth = playerUpgrades[level].maxHealth;
    this.health = playerUpgrades[level].maxHealth;
    this.speed = playerUpgrades[level].speed;
    this.fireRate = playerUpgrades[level].fireRate;
    this.projectileSpeed = playerUpgrades[level].projectileSpeed;
    
    this.structures = [];
}

function Planet(x, y, radius, structures, color, maxHealth, drops, id){
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.structures = structures;
    this.color = color;
    this.health = maxHealth;
    this.maxHealth = maxHealth;
    this.drops = drops;
    this.id = id;

    this.hasMaxStructure = function(type, maxCanHave){
        var counter = 0;

        for(var i = 0; i < this.structures.length; i++){
            if(this.structures[i].type === type){
                counter++;
            }
        }
    
        return (counter >= maxCanHave);
    }

    this.occupiedBy = null;
    this.owner = null;
}

function Shop(x, y, radius, upgradeType){
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.upgradeType = upgradeType;
}

function Projectile(x, y, velocity, size, color, damage, bulletRange, bulletPenetration, worldId, id){
    this.x = x;
    this.y = y;
    this.size = size;
    this.vel = velocity;
    this.color = color;
    this.damage = damage;
    this.worldId = worldId;
    this.bulletRange = bulletRange;
    this.bulletPenetration = bulletPenetration;
    this.id = id;
}

function Structure(planetId, x, y, rotation, type, ownerId, level, worldId, id){
    this.planetId = planetId;
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.type = type;
    this.ownerId = ownerId;
    this.level = level;
    this.worldId = worldId;
    this.id = id;
}

var playerUpgrades = [
        {   
            speed: 50,
            fireRate: 15,
            maxHealth: 10,
            damage: 1,
            radius: 10,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5},
            speed: 48,
            fireRate: 16,
            maxHealth: 20,
            damage: 2,
            radius: 15,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 20},
            speed: 46,
            fireRate: 17,
            maxHealth: 30,
            damage: 3,
            radius: 20,
            turningSpeed: .1,
            bulletRange: 2,
            projectileSpeed: 19,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50},
            speed: 44,
            fireRate: 18,
            maxHealth: 50,
            damage: 5,
            radius: 25,
            turningSpeed: .09,
            bulletRange: 2,
            projectileSpeed: 19,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100, iron: 5},
            speed: 42,
            fireRate: 19,
            maxHealth: 80,
            damage: 8,
            radius: 30,
            turningSpeed: .085,
            bulletRange: 3,
            projectileSpeed: 18,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 300, iron: 10},
            speed: 40,
            fireRate: 20,
            maxHealth: 130,
            damage: 13,
            radius: 35,
            turningSpeed: .08,
            bulletRange: 4,
            projectileSpeed: 18,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 750, iron: 50},
            speed: 38,
            fireRate: 21,
            maxHealth: 210,
            damage: 21,
            radius: 40,
            turningSpeed: .075,
            bulletRange: 5,
            projectileSpeed: 17,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 1200, iron: 100, earth: 10},
            speed: 36,
            fireRate: 25,
            maxHealth: 340,
            damage: 34,
            radius: 45,
            turningSpeed: .07,
            bulletRange: 6,
            projectileSpeed: 17,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 2000, iron: 300, earth: 50, crystal: 5},
            speed: 34,
            fireRate: 30,
            maxHealth: 500,
            damage: 55,
            radius: 50,
            turningSpeed: .065,
            bulletRange: 7,
            projectileSpeed: 16,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5000, iron: 800, earth: 300, crystal: 10},
            speed: 32,
            fireRate: 35,
            maxHealth: 890,
            damage: 89,
            radius: 55,
            turningSpeed: .06,
            bulletRange: 8,
            projectileSpeed: 16,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 10000, iron: 2500, earth: 500, crystal: 20},
            speed: 30,
            fireRate: 40,
            maxHealth: 1440,
            damage: 144,
            radius: 60,
            turningSpeed: .055,
            bulletRange: 9,
            projectileSpeed: 15,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50000, iron: 5000, earth: 800, crystal: 50},
            speed: 28,
            fireRate: 45,
            maxHealth: 2330,
            damage: 233,
            radius: 65,
            turningSpeed: .05,
            bulletRange: 10,
            projectileSpeed: 15,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100000, iron: 10000, earth: 1200, crystal: 75, gem: 5},
            speed: 26,
            fireRate: 50,
            maxHealth: 3000,
            damage: 300,
            radius: 70,
            turningSpeed: .045,
            bulletRange: 11,
            projectileSpeed: 14,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 250000, iron: 20000, earth: 2500, crystal: 100, gem: 10},
            speed: 24,
            fireRate: 60,
            maxHealth: 4000,
            damage: 400,
            radius: 75,
            turningSpeed: .04,
            bulletRange: 12,
            projectileSpeed: 14,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 500000, iron: 50000, earth: 5000, crystal: 130, gem: 25},
            speed: 22,
            fireRate: 70,
            maxHealth: 5000,
            damage: 500,
            radius: 80,
            turningSpeed: .035,
            bulletRange: 13,
            projectileSpeed: 13,
            identifier: "spaceship"
        }
        
];

var structureUpgrades = {
    landingPad: [
    {
        costs: {gem: 1},
        identifier: "landingPad"
    }
    ],
    turret: [
        {
            costs: {iron: 20},
            bulletRange: 14,
            projectileSpeed: 12,
            shootInterval: 100,
            damage: 5,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 40},
            bulletRange: 14,
            projectileSpeed: 14,
            shootInterval: 95,
            damage: 10,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 100},
            bulletRange: 14,
            projectileSpeed: 16,
            shootInterval: 90,
            damage: 15,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 500},
            bulletRange: 14,
            projectileSpeed: 18,
            shootInterval: 85,
            damage: 20,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 1000},
            bulletRange: 14,
            projectileSpeed: 20,
            shootInterval: 80,
            damage: 30,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 5000, crystal: 5},
            bulletRange: 14,
            projectileSpeed: 22,
            shootInterval: 75,
            damage: 45,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 10000, crystal: 20},
            bulletRange: 14,
            projectileSpeed: 24,
            shootInterval: 70,
            damage: 65,
            bulletpenetration: 0,
            identifier: "turret"
        },
        {
            costs: {iron: 20000, crystal: 50, gem: 1},
            bulletRange: 14,
            projectileSpeed: 26,
            shootInterval: 65,
            damage: 80,
            bulletpenetration: 0,
            identifier: "turret"
        }
    ],
    mine: [
        {
            costs: {asteroidBits: 50},
            amount: 2,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 100},
            amount: 5,
            identifier: "mine"
        } ,
        {
            costs:  {asteroidBits: 200},
            amount: 10,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 400},
            amount: 15,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 1000},
            amount: 20,
            identifier: "mine"
        } ,
        {
            costs: {asteroidBits: 2000},
            amount: 50,
            identifier: "mine"
        }  ,
        {
            costs: {asteroidBits: 4000},
            amount: 100,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 10000},
            amount: 200,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 20000},
            amount: 500,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 50000},
            amount: 1000,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 100000},
            amount: 2500,
            identifier: "mine"
        } 
    ],
    shield: [
        {
            costs: {water: 20},
            maxHealth: 100,
            drops: {crystal: 10, iron: 10, water: 10},
            identifier: "shield"
        },
        {
            costs: {water: 50},
            maxHealth: 250,
            drops: {crystal: 25, iron: 25, water: 25},
            identifier: "shield"
        },
        {
            costs: {water: 100},
            maxHealth: 750,
            drops: {crystal: 75, iron: 75, water: 75},
            identifier: "shield"
        },
        {
            costs: {water: 200},
            maxHealth: 1250,
            drops: {crystal: 125, iron: 125, water: 125},
            identifier: "shield"
        },
        {
            costs: {water: 500, crystal: 1},
            maxHealth: 2500,
            drops: {crystal: 250, iron: 250, water: 250},
            identifier: "shield"
        },
        {
            costs: {water: 1000, crystal: 5},
            maxHealth: 4000,
            drops: {crystal: 400, iron: 400, water: 400},
            identifier: "shield"
        },
        {
            costs: {water: 2000, crystal: 20},
            maxHealth: 7500,
            drops: {crystal: 750, iron: 750, water: 750},
            identifier: "shield"
        },
        {
            costs: {water: 3000, crystal: 50},
            maxHealth: 10000,
            drops: {crystal: 1000, iron: 1000, water: 1000},
            identifier: "shield"
        },
        {
            costs: {water: 5000, crystal: 75},
            maxHealth: 15000,
            drops: {crystal: 1500, iron: 1500, water: 1500},
            identifier: "shield"
        },
        {
            costs: {water: 10000, crystal: 100},
            maxHealth: 25000,
            drops: {crystal: 2500, iron: 2500, water: 2500},
            identifier: "shield"
        },
    ]
}

var shopUpgrades = {

    bulletPenetration: [
        {
            value: 0
        },
        {
            costs: {crystal: 10},
            value: 1
        },
        {
            costs: {crystal: 20, gem: 1},
            value: 2
        },
        {
            costs: {crystal: 30, gem: 5},
            value: 3
        },
        {
            costs: {crystal: 50, gem: 10},
            value: 4
        }
    ],
    cloakTime: [
        {
            value: 0
        },
        {
            costs: {crystal: 10},
            value: 3000
        },
        {
            costs: {crystal: 20, gem: 1},
            value: 4000
        },
        {
            costs: {crystal: 30, gem: 5},
            value: 5000
        },
        {
            costs: {crystal: 50, gem: 10},
            value: 6000
        },
    ],
    boost: [
        {
            value: 0
        },
        {
            costs: {crystal: 10},
            value: 40
        },
        {
            costs: {crystal: 20, gem: 1},
            value: 60
        },
        {
            costs: {crystal: 30, gem: 5},
            value: 90
        },
        {
            costs: {crystal: 50, gem: 10},
            value: 110
        },
    ],
    shipTurret: [
        {
            value: 0
        },
        {
            costs: {crystal: 10},
            value: 1
        },
        {
            costs: {crystal: 20, gem: 1},
            value: 2
        },
        {
            costs: {crystal: 30, gem: 5},
            value: 3
        },
        {
            costs: {crystal: 50, gem: 10},
            value: 5
        },
        {
            costs: {crystal: 100, gem: 25},
            value: 7
        }
    ]

    
}

io.sockets.on('connection', newConnetcion);

function newConnetcion(socket){

    var worldId = null;

    for(var i = 0; i < worldIds.length; i++){
        if(worldsData[worldIds[i]].clients.length + worldsData[worldIds[i]].lobbyClients.length < clientsPerWorld){
            worldId = worldIds[i];
            break;
        }
    }

    if(worldId == null){
        worldId = addWorld();
    }

    var spawnSize = (gridSize - edgeSpawnPadding) / 2;
    //var playerPosition = {x: getRndInteger(-spawnSize, spawnSize), y: getRndInteger(-spawnSize, spawnSize)};
    var playerPosition = playerSpawnPoint(-spawnSize, spawnSize, -spawnSize, spawnSize, worldId);
    
    playerObject = {id: socket.id, worldId: worldId, x: playerPosition.x, y: playerPosition.y};

    var playerData = newPlayerData(worldId, playerObject.x, playerObject.y);
    
    if(!playerData)
    {
        worldId = addWorld();
        playerObject.worldId = worldId;
        playerData = newPlayerData(worldId, playerObject.x, playerObject.y);
    }

    playerObject.planet = playerData.planet;

    socket.join(worldId);
        
    socket.emit("setupLocalWorld", playerData);
    syncDamage(worldId);
    socket.emit("showWorld");

    worldsData[worldId].lobbyClients.push(playerObject);

    console.log('\x1b[36m%s\x1b[0m', "player connected  : ", socket.id , " clients connected: ", worldsData[worldId].clients.length +  worldsData[worldId].lobbyClients.length, "In loby: ", worldsData[worldId].lobbyClients.length);

    socket.on("playerStartGame", function(data){

        data.username = data.username.slice(0, 15);

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        var lobbyClient = findObjectWithId(worldsData[data.worldId].lobbyClients, socket.id);

        var level = 0;
        var position = {x: 0, y: 0};
        var structures = [];
        var playerShopUpgrades = false;
        var shipTurret = false;

        if(lobbyClient){
            position.x = lobbyClient.object.x;
            position.y = lobbyClient.object.y;

            if(lobbyClient.object.shopUpgrades){
                playerShopUpgrades = lobbyClient.object.shopUpgrades;     
                
                if(lobbyClient.object.shipTurret){
                    shipTurret = lobbyClient.object.shipTurret;                
                }
            }
                
            
            if(lobbyClient.object.level)
                level = lobbyClient.object.level;

            if(lobbyClient.object.structures)
                structures = lobbyClient.object.structures;

            worldsData[data.worldId].lobbyClients.splice(lobbyClient.index, 1);   
        }
        else
        {
            console.log("Lobby client not found");
            return;
        }

        player = new Player(position.x, position.y, 0, level, socket.id, data.worldId); 
        worldsData[data.worldId].clients.push(player);
        player.structures = structures;
        player.shipTurret = shipTurret;

        if(playerShopUpgrades)
            player.shopUpgrades = playerShopUpgrades;

        player.username = data.username;
        worldsData[data.worldId].hittableObjects.push(player);

        socket.emit("setupLocalWorld", newPlayerData(data.worldId, player.x, player.y));

        socket.broadcast.to(data.worldId).emit('newPlayer', player);
        socket.emit("newPlayerStart", {player: player, planet: lobbyClient.object.planet});

        if(shipTurret)
        {
            var shipTurretData = {
                playerId: socket.id,
                level: playerShopUpgrades.shipTurret.level,
                type: "shipTurret",
                value: playerShopUpgrades.shipTurret.value,
                costs: {},
                turretId: shipTurret.id
            }

            io.to(data.worldId).emit('shopUpgrade', shipTurretData);
            
        }

        syncDamage(data.worldId);
    });

    socket.on('blackHoleDeath', function(data){

        if(!worldsData[data.worldId].clients)
            return;

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id);
        
        if(player)
        {
            damageObject(data.worldId, socket.id, socket.id, player.object.health * 2);
        }
    });

    socket.on('projectileHit', function(data) {

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        var projectile = findObjectWithId(worldsData[data.worldId].projectiles, data.projectileId);
        if(!projectile){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","projectile not found.");
            return;
        }

        if(projectile.hitObjects && projectile.hitObjects.contains(data.id)){
            return;
        }

        var damageDealt = projectile.object.damage;
        var worldHittableObjects = worldsData[data.worldId].hittableObjects;
        var target = findObjectWithId(worldHittableObjects, data.id);

        if(target != null && (target.type == "blackHole" || target.type == "wormHole"))
            return;

        damageObject(data.worldId, data.id, socket.id, damageDealt);

        if(projectile.object.hitObjects)
            projectile.object.hitObjects.push(data.id);
        else
            projectile.object.hitObjects = [data.id];


        
        if(projectile.object.bulletPenetration > 0 && target && target.object.type && !target.object.structure && target.object.type != "planet"){
            projectile.object.bulletPenetration--;
        }
        else{
            worldsData[data.worldId].projectiles.splice(projectile.index, 1);
            io.to(data.worldId).emit('destroyProjectile', {id: data.projectileId});
        }

    });

    socket.on('playerPos', function(data){
        data.id = socket.id;

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id);

        if(player)
            player = player.object;
        else
            return;

        player.x = data.x;
        player.y = data.y;

        socket.broadcast.to(data.worldId).emit('playerPos', data);
    });

    socket.on('heal', function(data){

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id).object;
        var healed = findObjectWithId(worldsData[data.worldId].hittableObjects, data.id).object;

        var addamount = Math.round(healed.maxHealth / 15);
        var costType = "stardust";
        var healCost = addamount;

        if(!healed.worldId) //Thing being healed is not a player (planet)
        {
            healCost = Math.round(healCost / 5);
        }

        if(healed.health != healed.maxHealth){

            var stardust = player.drops[costType];

            if(stardust && stardust >= healCost)
            {
                player.drops[costType] -= healCost;

                if(healed.health + addamount < healed.maxHealth)
                healed.health += addamount;
                else
                    healed.health = healed.maxHealth;

                syncDamage(data.worldId, [healed.id]);
                io.sockets.connected[socket.id].emit("syncItem", {item: costType, amount: player.drops[costType]});
            }
            else
                io.sockets.connected[socket.id].emit("returnMsg", "Not enough " + costType);
        }
        else
            io.sockets.connected[socket.id].emit("returnMsg", "Already full health");

    });
    
    socket.on('spawnProj', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        var playerShooter = findObjectWithId(worldsData[worldId].clients, data.shooterId);
        var structureShooter = findObjectWithId(allStructures(worldId), data.shooterId);

        var bulletPenetration;
        var shooter;

        if(structureShooter)
        {
            bulletPenetration = structureShooter.object.bulletPenetration;
            shooter = structureShooter;
        }
        else if(playerShooter)
        {
            bulletPenetration = playerShooter.object.shopUpgrades.bulletPenetration.value;
            shooter = playerShooter;
        }
        else 
        {
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "shooter not found");
            return;
        }

        if(data.percentDamage && data.percentDamage > 1)
        {
            data.percentDamage = 1;
        }
        else if(data.percentDamage < 0)
        {
            data.percentDamage = 0;
        }

        socket.broadcast.to(data.worldId).emit('spawnProj', data);
        worldsData[data.worldId].projectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, shooter.object.damage * data.percentDamage, shooter.object.bulletRange, bulletPenetration, data.worldId, data.id));

        //console.log('\x1b[33m%s\x1b[0m', "spawned projectile with id: ", data.id, " total: ", worldsData[data.worldId].projectiles.length);
    });

    socket.on('requestSpawnStructure', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        player = findObjectWithId(worldsData[data.worldId].clients, data.ownerId).object;

        var enoughResources = false;
        data.id = uniqueId();

        planet = findObjectWithId(worldsData[data.worldId].worldObjects.planets, data.planetId).object;
        
        //Check if planet has a landing pad first
        if(data.type != "landingPad"){
            var hasLandingPad = false;

            planet.structures.forEach(structure => {
                if(structure.type == "landingPad")
                    hasLandingPad = true;
            });

            if(!hasLandingPad){
                io.sockets.connected[data.ownerId].emit("returnMsg", "Place landing pad first");
                return;
            }
        }

        if(planet.hasMaxStructure(data.type, maxPlanetObjects[data.type]))
        {
            io.sockets.connected[data.ownerId].emit("returnMsg", "Planet aready has max " + data.type + 's');
            return;
        }

        if(data.type == "landingPad"){
            var numberOwnedPlanets = 0;

            worldsData[data.worldId].worldObjects.planets.forEach(planet => {
                if(planet.owner == data.ownerId)
                    numberOwnedPlanets++
            });

            if(numberOwnedPlanets >= maxNumberOwnedPlanets)
            {
                var s = "";

                if(maxNumberOwnedPlanets > 1)
                    s = "s";

                io.sockets.connected[data.ownerId].emit("returnMsg", "Can only own " + maxNumberOwnedPlanets + " planet" + s);
                return;
            }
        }

        if(structureUpgrades[data.type]){

            var costsForNextLvl = structureUpgrades[data.type][0].costs;
            var hasResourceCounter = 0;
            var neededResources = 0; 

            for (var cost in costsForNextLvl) {
                if (costsForNextLvl.hasOwnProperty(cost)) {
                    if(player.drops[cost] && costsForNextLvl[cost] <= player.drops[cost]){
                        hasResourceCounter++;
                    }
                    neededResources++;
                }
            }

            enoughResources = hasResourceCounter == neededResources;

            if(enoughResources){
                for (var cost in costsForNextLvl) {
                    if (costsForNextLvl.hasOwnProperty(cost)) {
                        player.drops[cost] -= costsForNextLvl[cost];
                    }
                }

                data.costs = costsForNextLvl;
            }
           
        }
        else
            enoughResources = true;


        if(enoughResources){
            var structure;
            data.level = 0;

            if(planet){
                structure = new Structure(planet.id, data.x, data.y, data.rotation, data.type, data.ownerId, data.level, data.worldId, data.id);
                planet.structures.push(structure);

                if(data.type == "landingPad"){
                    planet.owner = socket.id;
                }

                socket.emit("spawnStructure", data);
                data.isFacade = true;
                socket.broadcast.to(data.worldId).emit("spawnStructure", data);
        
                if(structureUpgrades[data.type]){
                    var upgrades = structureUpgrades[data.type][structure.level];
                    
                    for (var upgrade in upgrades) {
                        if (upgrades.hasOwnProperty(upgrade)) {
                            
                            structure[upgrade] = upgrades[upgrade];

                        }
                    }

                    var upgradeData = {
                        upgrade: upgrades,
                        id: structure.id,
                        costs: {},
                        playerId: data.ownerId,
                        level: structure.level
                    }
            
                    io.to(worldId).emit('upgradeSync', upgradeData);

                    if(data.type == "shield"){
                        var shieldRadius = planet.radius + 100;  
                        var newHittableObj = {x: data.x, y: data.y, radius: shieldRadius, health: upgrades.maxHealth, maxHealth: upgrades.maxHealth, id: data.id, structure: true, planet: planet};
                        newHittableObj.drops = upgrades.drops;
                        worldsData[data.worldId].hittableObjects.push(newHittableObj);

                        syncDamage(data.worldId, [data.id]);
                    }
        
                    if(data.type == "mine"){
                        structure.amount = upgrades.amount;
                    }
                }
        
                var owner = findObjectWithId(worldsData[data.worldId].clients, data.ownerId).object;
                owner.structures.push(structure);
        
                console.log('\x1b[37m%s\x1b[0m', "spawned structure on planet with id: ", data.planetId, " type: ", data.type, " id:", data.id, " owner: ", data.ownerId);
            }
            else{
                console.log("Planet not found. Failed to build structure on server");
                return;
            }
            
        }
        else
            io.sockets.connected[data.ownerId].emit("returnMsg", "Not enough resources");
        

    });

    socket.on('upgradeInfo', function(data){

        var returnInfo = {
            structureUpgrades: structureUpgrades,
            playerUpgrades: playerUpgrades,
            shopUpgrades: shopUpgrades
        }

        socket.emit("upgradeInfo", returnInfo);

    });

    socket.on('shopUpgrade', function(data){
        var worldId = data.worldId;

        if(!worldIds.contains(worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
            return;
        }

        var player = findObjectWithId(worldsData[worldId].clients, socket.id);

        if(player)
            player = player.object;
        else
            return;

        var level = player.shopUpgrades[data.type].level;

        if(level + 1 >= shopUpgrades[data.type].length){
            console.log("Shop upgrades past fully upgraded. skipping");
            return;
        }

        var costsForNextLvl = shopUpgrades[data.type][level + 1].costs;
        var hasResourceCounter = 0;
        var neededResources = 0; 

        for (var cost in costsForNextLvl) {
            if (costsForNextLvl.hasOwnProperty(cost)) {
                if(player.drops[cost] && costsForNextLvl[cost] <= player.drops[cost]){
                    hasResourceCounter++;
                }
                neededResources++;
            }
        } 

        if(hasResourceCounter == neededResources){
            
            for (var cost in costsForNextLvl) {
                if (costsForNextLvl.hasOwnProperty(cost)) {
                    player.drops[cost] -= costsForNextLvl[cost];
                }
            }

            player.shopUpgrades[data.type].level++;
            level = player.shopUpgrades[data.type].level;
            player.shopUpgrades[data.type].value = shopUpgrades[data.type][level].value;

            var turretId;

            if(data.type == "shipTurret"){
                if(player.shipTurret){
                    upgrade(player.shipTurret, structureUpgrades.turret[shopUpgrades[data.type][level].value], {}, {id: socket.id}, worldId);
                }
                else{
                    turretId = uniqueId();
                    shipTurret = new Structure(socket.id, 0, 0, 0, "turret", socket.id, level, worldId, turretId);

                    var upgrades = structureUpgrades["turret"][shopUpgrades[data.type][level].value];

                    for (var turretUpgrade in upgrades) {
                        if (upgrades.hasOwnProperty(turretUpgrade)) {
                            shipTurret[turretUpgrade] = upgrades[turretUpgrade];
                        }
                    }

                    player.shipTurret = shipTurret;
                }
            }

            var data = {
                playerId: socket.id,
                level: level,
                type: data.type,
                value: shopUpgrades[data.type][level].value,
                costs: shopUpgrades[data.type][level].costs,
                turretId: turretId
            }
            
            io.to(worldId).emit('shopUpgrade', data);
        }
        else{
            io.sockets.connected[socket.id].emit("returnMsg", "Not enough resources");
        }

    });

    socket.on('upgradeRequest', function(data){
        var allUpgradeableObjects = allWorldObjects(data.worldId).concat(allStructures(data.worldId).concat(worldsData[data.worldId].clients));

        var playerUpgrading = findObjectWithId(worldsData[data.worldId].clients, socket.id);

        if(playerUpgrading)
            playerUpgrading = playerUpgrading.object;
        else
        {
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "playerUpgrading not found");
            return;
        }
            
            
        var upgradee = findObjectWithId(allUpgradeableObjects, data.id).object;
        var upgrades;

        if(upgradee.type)
            upgrades = structureUpgrades[upgradee.type];
        else
            upgrades = playerUpgrades;
        
        if(!upgrades[upgradee.level + 1]){
            console.log("upgrade not found");
            return;
        }

        var costsForNextLvl = upgrades[upgradee.level + 1].costs;
        var hasResourceCounter = 0;
        var neededResources = 0; 

        for (var cost in costsForNextLvl) {
            if (costsForNextLvl.hasOwnProperty(cost)) {
                if(playerUpgrading.drops[cost] && costsForNextLvl[cost] <= playerUpgrading.drops[cost]){
                    hasResourceCounter++;
                }
                neededResources++;
            }
        }

        if(hasResourceCounter == neededResources){
            upgrade(upgradee, upgrades[upgradee.level + 1], costsForNextLvl, playerUpgrading, data.worldId);
            syncDamage(data.worldId, [data.id]);
        }
        else{
            io.sockets.connected[socket.id].emit("returnMsg", "Not enough resources");
        }
        
    });

    function upgrade(thing, upgrade, costs, playerUpgrading, worldId){

        for (var property in upgrade) {
            if (upgrade.hasOwnProperty(property)) {

                if(property == "maxHealth"){
                    var hittableThingObject = findObjectWithId(worldsData[worldId].hittableObjects, thing.id).object;

                    var precent = hittableThingObject["health"] / hittableThingObject[property];

                    hittableThingObject.maxHealth = upgrade[property];
                    hittableThingObject.health = precent * upgrade[property];
                }
                else
                    thing[property] = upgrade[property];
            }
        }

        for (var cost in costs) {
            if (costs.hasOwnProperty(cost)) {
                playerUpgrading.drops[cost] -= costs[cost];
            }
        }

        thing.level++;

        var data = {
            upgrade: upgrade,
            id: thing.id,
            costs: costs,
            playerId: playerUpgrading.id,
            level: thing.level
        }

        io.to(worldId).emit('upgradeSync', data);
    }

    socket.on('planetOccupancy', function(data){

        worldsData[data.worldId].worldObjects.planets.forEach(planet => {
            if(planet.id == data.planetId)
                planet.occupiedBy = data.playerId;
        });

        socket.broadcast.to(data.worldId).emit('planetOccupancy', data);

    });

    socket.on('cloak', function(data){

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id);

        if(!player){
            console.log('\x1b[31m%s\x1b[0m', "cloaked player not found");
            return;
        }

        var cloakLevel = player.object.shopUpgrades["cloakTime"].level;

        if(cloakLevel > 0)
        {

            var rtrnData = {
                playerId: socket.id,
                cloaked: true
            }

            socket.broadcast.to(data.worldId).emit('cloak', rtrnData);

            setTimeout(function() {
                rtrnData.cloaked = false;
                io.to(data.worldId).emit('cloak', rtrnData);

            }, player.object.shopUpgrades["cloakTime"].value);
            
        }
        else{
            io.sockets.connected[socket.id].emit("returnMsg", "Purchase cloak ability at shop first.");
        }


    });

    socket.on('disconnect', function (data) {
        
        var worldId;

        allClients(true).forEach(client => {
            if(client.id == socket.id)
                worldId = client.worldId;
        });

        disconnectPlayer(socket.id, socket, worldId);

        if(worldsData[worldId])
        {
            console.log('\x1b[31m%s\x1b[0m', "player disconected: ", socket.id,  " clients connected: ", worldsData[worldId].clients.length, "In loby: ", worldsData[worldId].lobbyClients.length);

            if(worldsData[worldId].clients.length + worldsData[worldId].lobbyClients.length == 0){
                removeWorld(worldId);
            }
        }

    });
}

function disconnectPlayer(id, socket, worldId){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
        return;
    }

    var lobbyClient = findObjectWithId(worldsData[worldId].lobbyClients, id);
    var client = findObjectWithId(worldsData[worldId].clients, id);
    var structureIds = [];


    if(lobbyClient)
        worldsData[worldId].lobbyClients.splice(lobbyClient.index, 1);
    else if(client)
    {
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.occupiedBy == client.object.id)
                planet.occupiedBy = null;
        });
    
        var data = {
            clientId: client.object.id,
            structureIds: structureIds
        }
     
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.owner == client.object.id)
            {
                respawnPlanet = planet;
            }
        });
    
        if((!respawnPlanet || id == socket.id))
        {
            //destroy players structures on planets
            if(client.object.structures){
                client.object.structures.forEach(structure => {
                    structureIds.push(structure.id);
    
                    var planet = findObjectWithId(worldsData[worldId].worldObjects.planets, structure.planetId);
    
                    if(planet){
                        planet = planet.object;
    
                        planet.owner = null;
                        planet.occupiedBy = null;
    
                        var planetStructure = findObjectWithId(planet.structures, structure.id);
    
                        if(planetStructure){
                            if(planetStructure.object.type == "shield")
                            {
                                var shield = findObjectWithId(worldsData[worldId].hittableObjects, structure.id);
    
                                if(shield)
                                {
                                    worldsData[worldId].hittableObjects.splice(shield.index, 1);
                                    syncDamage(worldId, [structure.id]);
                                }
                            }
    
                            planet.structures.splice(planetStructure.index, 1);
                        }
                    }
                    
                });
            }
        }

        if(id != socket.id){ //Player was killed

            if(!io.sockets.connected[id]){
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "Player killed not found");
                return;
            }

            data.forGood = false;
            io.sockets.connected[id].broadcast.to(worldId).emit('playerExited', data);
            
            var level = 0;

            if(client.object.level - levelsLostOnDeath > 0)
                level = client.object.level - levelsLostOnDeath;

            var spawnSize = (gridSize - edgeSpawnPadding) / 2

            var respawnPlanet = false;

            worldsData[worldId].worldObjects.planets.forEach(planet => {
                if(planet.owner == client.object.id)
                {
                    respawnPlanet = planet;
                }
            });


            var playerPosition;

            if(respawnPlanet) //Respawn player on their owned planet
            {
                playerPosition = {x: respawnPlanet.x - gridSize / 2, y: respawnPlanet.y - gridSize / 2};
                io.sockets.connected[id].emit("respawnPlanet");
            }
            else{ //Respawn player normaly
                playerPosition = playerSpawnPoint(-spawnSize, spawnSize, -spawnSize, spawnSize, worldId);
                io.sockets.connected[id].emit("respawn");
            }

            playerObject = {id: id, worldId: worldId, x: playerPosition.x, y: playerPosition.y, level: level, planet: respawnPlanet.id, structures: client.object.structures, shopUpgrades: client.object.shopUpgrades, shipTurret: client.object.shipTurret};
            worldsData[worldId].lobbyClients.push(playerObject);

        } 
        else //Player disconneted
        {
            data.forGood = true;
            socket.broadcast.to(worldId).emit('playerExited', data);
        }
    
        var hittableClient = findObjectWithId(worldsData[worldId].hittableObjects, id);
    
        if(hittableClient){
            worldsData[worldId].hittableObjects.splice(hittableClient.index, 1);
        }
    
        worldsData[worldId].clients.splice(client.index, 1);
    }
    
}

function damageObject(worldId, id, senderId, damage){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
        return;
    }

    var worldWorldObjects = worldsData[worldId].worldObjects;
    var worldHittableObjects = worldsData[worldId].hittableObjects;

    var target = findObjectWithId(worldHittableObjects, id);
    
    if(!target){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]","target not found.");
        return;
    }

    if(target.object){

        //If the thing attacked was a player
        var possibleClient = findObjectWithId(worldsData[worldId].clients, target.object.id);

        //If the thing attacked was a planet
       var possiblePlanet = findObjectWithId(worldWorldObjects.planets, target.object.id);

        //If the thing attacked was space matter
       var possibleSpaceMatter = findObjectWithId(worldWorldObjects.asteroids, target.object.id);

       if(possibleClient)
       {
            worldsData[worldId].worldObjects.planets.forEach(planet => {
                if(planet.occupiedBy == target.object.id)
                {

                    var shieldRef = false;

                    planet.structures.forEach(structure => {
                        if(structure.type == "shield")
                            shieldRef = structure;
                    });

                    if(shieldRef)
                    {
                        var shield = findObjectWithId(worldHittableObjects, shieldRef.id);

                        if(shield){
                            target = shield;
                            possibleClient = false;
                            //console.log("damaging Shield Instead of player");
                        }
                    }
                    else{
                        var planetHittableObject = findObjectWithId(worldHittableObjects, planet.id);

                        if(planetHittableObject)
                            target = planetHittableObject;

                        //console.log("damaging Planet Instead of player");
                    }
                }

            });
       }
    
       if(possiblePlanet)
       {
            var shieldRef = false;

            possiblePlanet.object.structures.forEach(structure => {
                if(structure.type == "shield")
                    shieldRef = structure;
            });

            if(shieldRef)
            {
                var shield = findObjectWithId(worldHittableObjects, shieldRef.id);
                if(shield && shield.object.health > 0){
                    target = shield;
                    possiblePlanet = false;
                }
            }
       }

        if(target.object.drops && senderId && !possibleClient){

            if(possiblePlanet && possiblePlanet.object.structures)
            {
                possiblePlanet.object.structures.forEach(structure => {
                    var structureDrops = structureUpgrades[structure.type][structure.level].costs;

                    for (var drop in structureDrops) {
                        if (structureDrops.hasOwnProperty(drop)) {

                            var amount = Math.round(structureDrops[drop] / 750);

                            if(target.object.drops[drop])
                                target.object.drops[drop] += amount;
                            else
                                target.object.drops[drop] = amount;
                        }
                    }
                });
            }

            if(target.object.type == 'crystal')
            {   
                if(target.object.health - damage <= 0)
                    itemDropped(target.object.drops, senderId, worldId, 1); 
            }
            else
            {
                var precentDamage = 0;

                if(damage > target.object.maxHealth)
                    precentDamage = 1;
                else
                    precentDamage = damage / target.object.maxHealth;
    
                if(target.object.health - damage <= 0)
                    precentDamage += precentItemKillBoost;


                itemDropped(target.object.drops, senderId, worldId, precentDamage); 
            }
        }   

        if(target.object.type == 'sun'){
            return;
        }

        if(target.object.health - damage > 0){
            target.object.health -= damage;
        }
        else {
            target.object.health = 0;

            if(target.object.structure){ //Is a structure (shield)
                worldWorldObjects.planets.forEach(function(planet){
                    var possibleStructure = findObjectWithId(planet.structures, target.object.id);

                    if(possibleStructure){
                        planet.structures.splice(possibleStructure.index, 1);
                    }
                });
            }
            else {
                if(possibleClient){
                    disconnectPlayer(target.object.id, socket, worldId);

                    if(!target.object.drops["gem"])
                        target.object.drops["gem"] = 1;

                    if(target.object.drops && senderId)
                        itemDropped(target.object.drops, senderId, worldId, 1); 
                    
                }
                else{

                    var newObject;
                    var dead = false;

                    if(possiblePlanet){
                        var radius = possiblePlanet.object.radius
                        var color = possiblePlanet.object.color;
                        var health = possiblePlanet.object.maxHealth;
                        var drops = possiblePlanet.object.drops;

                        if(possiblePlanet.object.shield)
                        {
                            var shieldIndex = findObjectWithId(worldHittableObjects, possiblePlanet.object.shield.id).index;
                            worldHittableObjects.splice(shieldIndex, 1);
                        }

                        if(possiblePlanet.object.owner){
                            var planetOwner = findObjectWithId(worldsData[worldId].clients, possiblePlanet.object.owner);
                        
                            if(planetOwner){
                                planetOwner.object.structures = [];
                            }
                        }

                        worldHittableObjects.splice(target.index, 1);
                        worldWorldObjects.planets.splice(possiblePlanet.index, 1);

                        newObject = generatePlanet(radius, color, health, drops, worldWorldObjects, worldHittableObjects, target.object.id);

                        if(!newObject){
                            newObject = {};
                            unspawnedObjects.push({radius: radius, color: color, health: health, drops: drops, worldId: worldId, id: target.object.id});
                            dead = true;
                        }

                        newObject.type = "planet";
                    }
                    else if(possibleSpaceMatter){
                        var radius = possibleSpaceMatter.object.radius;
                        var color = possibleSpaceMatter.object.color;
                        var health = possibleSpaceMatter.object.maxHealth;
                        var drops = possibleSpaceMatter.object.drops;
                        var type = possibleSpaceMatter.object.type;

                        worldHittableObjects.splice(target.index, 1);
                        worldWorldObjects.asteroids.splice(possibleSpaceMatter.index, 1);

                        newObject = generateSpaceMatter(radius, color, health, drops, worldWorldObjects, worldHittableObjects, type, target.object.id);

                        if(!newObject){
                            unspawnedObjects.push({radius: radius, color: color, health: health, drops: drops, type: type, worldId: worldId, id: target.object.id});
                            newObject = {type: type};
                            dead = true;
                        }
                            
                    }
                    else{
                        console.log("object type of damaged object is not accounted for on the server");
                        return;
                    }

                    if(newObject){
                        var changedWorldObject = 
                        {
                            id: target.object.id,
                            newObject: newObject,
                            dead: dead
                        }
                    }

                    io.to(worldId).emit('newWorldObjectSync', changedWorldObject);

                    if(unspawnedObjects.length > 0)
                    {
                        var newUnspawnedObject;

                        for(var i = unspawnedObjects.length - 1; i >= 0; i--){
                            var obj = unspawnedObjects[i];

                            if(!worldsData[obj.worldId])
                            {
                                unspawnedObjects.splice(i, 1);
                                continue;
                            }
                                

                            worldHittableObjects = worldsData[obj.worldId].hittableObjects;
                            worldWorldObjects = worldsData[obj.worldId].worldObjects;
                            
                            if(obj.type)
                                newUnspawnedObject = generateSpaceMatter(obj.radius, obj.color, obj.health, obj.drops, worldWorldObjects, worldHittableObjects, obj.type, obj.id);
                            else{
                                newUnspawnedObject = generatePlanet(obj.radius, obj.color, obj.health, obj.drops, worldWorldObjects, worldHittableObjects, obj.id);
                            }
                                
                                
                            if(newUnspawnedObject){

                                if(!obj.type)
                                    newUnspawnedObject.type = "planet";

                                unspawnedObjects.splice(i, 1);

                                var changedWorldObject = 
                                {
                                    id: obj.id,
                                    newObject: newUnspawnedObject,
                                    dead: false
                                }
                            
                                io.to(worldId).emit('newWorldObjectSync', changedWorldObject);
                                syncDamage(worldId, [obj.id]);
                            }
                        }
                        
                    }
                }
            }
        }

        syncDamage(worldId, [target.object.id]);
    }
    else
        console.log(id, " is not accounted for on the sever");
}

function itemDropped(drops, playerRecivingId, worldId, precent){

    var player = findObjectWithId(worldsData[worldId].clients, playerRecivingId);

    var data = {
        drops: {}
    }

    if(!player)
        return;
    else
        player = player.object;

    for (var drop in drops) {
        if (drops.hasOwnProperty(drop)) {

            var amount = Math.round(drops[drop] * precent);

            if(player.drops[drop])
                player.drops[drop] += amount;
            else
                player.drops[drop] = amount;

            if(amount > 0)
            {
                data.drops[drop] = amount
            }
        }
    }

    io.sockets.connected[playerRecivingId].emit("items", data);
}

function syncDamage(worldId, changedIds){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session. worldID: " + worldId);
        return;
    }

    var healthData = {hittableObjects: [], deadObjects:[]};
    var worldHittableObjects = worldsData[worldId].hittableObjects;

    if(changedIds){
        var changedObjects = [];
        changedIds.forEach(id => {
            changedObject = findObjectWithId(worldHittableObjects, id);

            if(changedObject){
                healthData[id] = Math.round(changedObject.object.health);

                var healthObj = {
                    health: changedObject.object.health, 
                    maxHealth: changedObject.object.maxHealth, 
                    radius: changedObject.object.radius, 
                    x: changedObject.object.x, 
                    y: changedObject.object.y, 
                    id: changedObject.object.id,
                    active: true
                }

                changedObjects.push(healthObj);
            }
            else{
                healthData.deadObjects.push(id);
            }
        });
        
        healthData.hittableObjects = changedObjects;

    }
    else{

        for(var i = 0; i < worldHittableObjects.length; i++){
            healthData[worldHittableObjects[i].id] = Math.round(worldHittableObjects[i].health);

            var healthObj = {
                health: worldHittableObjects[i].health, 
                maxHealth: worldHittableObjects[i].maxHealth, 
                radius: worldHittableObjects[i].radius, 
                x: worldHittableObjects[i].x, 
                y: worldHittableObjects[i].y, 
                id: worldHittableObjects[i].id,
                active: true
            }

            healthData.hittableObjects.push(healthObj);

        }
    }

    io.to(worldId).emit('damageSync', healthData);
}


setInterval(sunDamage, sunDamageRate);

function sunDamage()
{
    var syncWorldIds = {};

    allClients().forEach(client => {

        var player = findObjectWithId(worldsData[client.worldId].hittableObjects, client.id).object;

        worldsData[client.worldId].worldObjects.asteroids.forEach(matter => {
            if(matter.type == "sun")
            {
                var distance = Math.sqrt(Math.pow(matter.x - client.x, 2) + Math.pow(matter.y - client.y, 2)); 

                if(distance < client.radius + matter.radius){

                    var damage = player.maxHealth / 5;;

                    damageObject(player.worldId, player.id, null, damage);

                    if(syncWorldIds[player.worldId])
                        syncWorldIds[player.worldId].push(player.id)
                    else
                        syncWorldIds[player.worldId] = [player.id];
                }

            }
        });

    });

    for (var syncWorldId in syncWorldIds) {
        if (syncWorldIds.hasOwnProperty(syncWorldId)) 
            syncDamage(syncWorldId, syncWorldIds[syncWorldId]);
    }

}

setInterval(shieldHeal, shieldHealRate);
function shieldHeal()
{
    var syncWorldIds = {};

    allStructures().forEach(structure => {
        if(structure.type == "shield"){
            var shield = findObjectWithId(worldsData[structure.worldId].hittableObjects, structure.id).object;

            var addamount = shield.maxHealth / 25;

            if(shield.health != shield.maxHealth){
                if(shield.health + addamount < shield.maxHealth)
                    shield.health += addamount;
                else
                    shield.health = shield.maxHealth;


                if(syncWorldIds[structure.worldId])
                    syncWorldIds[structure.worldId].push(structure.id)
                else
                    syncWorldIds[structure.worldId] = [structure.id];
            }
        }
    });

    for (var syncWorldId in syncWorldIds) {
        if (syncWorldIds.hasOwnProperty(syncWorldId)) 
            syncDamage(syncWorldId, syncWorldIds[syncWorldId]);
    }
    
}


setInterval(despawnProjectiles, despawnProjectilesRate);

function despawnProjectiles()
{
    allProjectiles().forEach(projectile => {

        if(projectile.time != null){
            if(projectile.time > projectile.bulletRange){
                var data = {id: projectile.id}
    
                var hitProj = findObjectWithId(worldsData[projectile.worldId].projectiles, projectile.id);
                if(hitProj)
                    worldsData[projectile.worldId].projectiles.splice(hitProj.index, 1);
    
                io.sockets.to(projectile.worldId).emit('destroyProjectile', data);
            }

            projectile.time++;
        }
        else{
            projectile.time = 0;
        }

    });
}

setInterval(mineProduce, mineProductionRate);
function mineProduce()
{
    var mineProduceItems = [{item: 'iron', chance: .1}, {item: 'asteroidBits', chance: 1}];

    allClients().forEach(client => {

        var mineData = [];
    
        client.structures.forEach(structure => {
            if(structure.type == "mine"){

                for(var i = 0; i < mineProduceItems.length; i++){
                
                    var mineProduceItem = mineProduceItems[i].item;
                    var amount = Math.round(mineProduceItems[i].chance * structure.amount);

                    if(amount > 0){
                        mineData.push({id: structure.id, amount: structure.amount, item: mineProduceItem});

                        if(client.drops[mineProduceItem])
                            client.drops[mineProduceItem] += structure.amount;
                        else
                            client.drops[mineProduceItem] = structure.amount;
                    }
                }
            }
        });

        if(mineData.length > 0){
            io.sockets.connected[client.id].emit("mineProduce", mineData);
        }
        
    
    });
}

//Utility Functions --------------------------------------------------------------------------------------------------
var uniqueId = function() {
    return 'id-' + Math.random().toString(36).substr(2, 16);
};

function playerSpawnPoint(xMin, xMax, yMin, yMax, worldId){
    var x;
    var y;
    var reptitions = 0;

    do {
        var x = getRndInteger(xMin, xMax);
        var y = getRndInteger(yMin, yMax);

        if(reptitions > spawnTries){
            return {x: x, y: y};
        }

        reptitions++;
    } while (!positonAviable(200, x, y, worldsData[worldId].hittableObjects));

    return {x: x, y: y};
}

function randGenPoint(size){
    return {x: getRndInteger(size / 2, gridSize - size / 2), y: getRndInteger(size / 2, gridSize - size / 2)};
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

function getRandomGray(){
    var value = Math.max(.3, Math.min(Math.random(), .75)) * 0xFF | 0;
    var grayscale = (value << 16) | (value << 8) | value;
    var color = '#' + grayscale.toString(16);

    return color;
}

function findObjectWithId(array, id){

    if(!array || !id)
    {
        return;
    }

    for(var i = 0; i < array.length; i++){
        if(array[i].id == id){
            return {object: array[i],
                    index: i};
        }
    }
}

function allProjectiles(){
    projectiles = [];

    for (let i = 0; i < worldIds.length; i++) {
        projectiles = projectiles.concat(worldsData[worldIds[i]].projectiles);
    }

    return projectiles;
}

function allClients(includeLobbyClients = false){

    clients = [];

    for (let i = 0; i < worldIds.length; i++) {
        clients = clients.concat(worldsData[worldIds[i]].clients);

        if(includeLobbyClients)
            clients = clients.concat(worldsData[worldIds[i]].lobbyClients);
    }

    return clients;
}

function allWorldObjects(worldId){
    var objects = [];

    var worldWorldObjects = worldsData[worldId].worldObjects;

    for (var matterArray in worldWorldObjects) {
        if (worldWorldObjects.hasOwnProperty(matterArray)) {
            worldWorldObjects[matterArray].forEach(matter => {
                if(matter.health > 0 )
                objects.push(matter);
            });
        }
    }

    return objects;
}

function allStructures(worldId){
    var structures = [];

    if(!worldId){
        for(var i = 0; i < worldIds.length; i++){
            var planets = worldsData[worldIds[i]].worldObjects.planets

            for(var i = 0; i < planets.length; i++){
                if(planets[i].health >= 0)
                {
                    var planetStructures = planets[i].structures;
        
                    for(var x = 0; x < planetStructures.length; x++){
                        structures.push(planetStructures[x]);
                    }
                }
            }
        }

        for(var i = 0; i < worldIds.length; i++){
            var players = worldsData[worldIds[i]].clients

            for(var x = 0; x < players.length; x++){
                if(players[x].shipTurret)
                structures.push(players[x].shipTurret);
            }
        }
    }
    else
    {
        var worldWorldObjects = worldsData[worldId].worldObjects;

        for(var i = 0; i < worldWorldObjects.planets.length; i++){
            if(worldWorldObjects.planets[i].health >= 0)
            {
                var planetStructures = worldWorldObjects.planets[i].structures;
    
                for(var x = 0; x < planetStructures.length; x++){
                    structures.push(planetStructures[x]);
                }
            }
        }

        var players = worldsData[worldId].clients;

        for(var i = 0; i < players.length; i++){
            if(players[i].shipTurret)
            structures.push(players[i].shipTurret);
        }

    }
    return structures;
}

function newPlayerData(id, x, y) {

    var playerPlanet = false;

    worldsData[id].worldObjects.planets.forEach(planet => {
        if(planet.occupiedBy == null && planet.owner == null)
            playerPlanet = planet;
    });

    if(!playerPlanet)
        return false;

    var data = {
        existingPlayers: worldsData[id].clients,
        worldObjects: worldsData[id].worldObjects,
        gridSize: gridSize,
        planet: playerPlanet.id,
        gridBoxScale: gridBoxScale,
        worldId: id,
        x: x,
        y: y
    };
    return data;
}

Array.prototype.contains = function(thing){

    for (let i = 0; i  < this.length; i++) {
        if(this[i] == thing)
            return true;
    }
    return false;
};

process.on('uncaughtException', function(error) {

    console.log("-------------------------- UNHANDELED REJECTION --------------------------------");
    console.log(error);
    console.log("--------------------------------------------------------------------------------");
    //process.exit(1);
});


addWorld();