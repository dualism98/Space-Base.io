import express from 'express';
import fs from 'fs';
import { CronJob } from 'cron';
import SocketIO from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

var app = express();

//Initalizing a server on port 80 using the ipv4 address of the machine it is running off of
var server = app.listen(8080, "0.0.0.0");
app.use(express.static('../client'));
var io = SocketIO.listen(server);   //socket(server);

var worldsData = {};
var worldIds = [];

console.log("server started");

//World Config Options
// var numOfAsteroids = 1200;
// var numOfPlanets = 35;
// var numOfMoons = 100;
// var numOfSuns = 5;
// var numOfCrystals = 100;
// var numOfBlackHoles = 5;
// var numOfScrapMetal = 100;
// var numOfDirtThings = 100;
// var numOfWormHoles = 6; //Not yet implemented
// var gridSize = 10000;
// var gridBoxScale = 100;
// var spawnTries = 5;

var numOfAsteroids = 600;
var numOfPlanets = 10;
var numOfMoons = 40;
var numOfSuns = 3;
var numOfCrystals = 30;
var numOfBlackHoles = 3;
var numOfScrapMetal = 30;
var numOfDirtThings = 30;
var numOfWormHoles = 3; //Not yet implemented
var gridSize = 5000;
var gridBoxScale = 50;
var spawnTries = 5;

// //Testing values for ease of access
// var numOfAsteroids = 0;
// var numOfPlanets = 3;
// var numOfMoons = 0;
// var numOfSuns = 0;
// var numOfCrystals = 0;
// var numOfBlackHoles = 0;
// var numOfScrapMetal = 0;
// var numOfDirtThings = 0;
// var numOfWormHoles = 0;
// var gridSize = 1500;
// var gridBoxScale = 10;
// var spawnTries = 51;

var edgeSpawnPadding = 2000;
var precentItemKillBoost = .5;
var hiveHealth = 7500;

var mineProductionRate = 2500;
var despawnProjectilesRate = 100;
var shieldHealRate = 1000;
var sunDamageRate = 1000;
var oxygenDamageRate = 2000;
var enemySpawnRate = 10000;
var updateEnemiesRate = 10;
var updateItemsRate = 20;
var respawnCrownRate = 10000;
var fauxEnemyUpdateRate = 20000;
var fauxEnemyAmountUpdateRate = 200000;

var itemCollectDist = 10;
var itemMergeDist = 5;  
var itemMergeRange = 200;
var itemAttractDist = 1000;
var itemDespawnTime = 2000;

var unspawnedObjects = [];

var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var crystalColors = ["#5b94ef", "#d957ed", "#f9f454", "#85f954"];
var moonColors = ["#929aa8", "#758196", "#758196", "#2d3c56"];

var clientsPerWorld = 30;
var maxEnemiesPerWorld = 20;
var numberOfWorlds = 0;

var spawnLevel = 0;
var levelsOfStatUpgrades = 16;

var spawnHiveWithSpawners = true;

var levelsLostOnDeath = 1;
var maxNumberOwnedPlanets = 3;

var hivePlanet;

var maxPlanetObjects = {
    mine: 5,
    turret: 5,
    shield: 1,
    landingPad: 1,
    electricity: 3,
    satellite: 1,
    spawner: 1
};

//A function that checks if the location and size given is occluded by another object
function positonAviable(size, x, y, hittableObjectsRef) {

    var hittableObjectIds = Object.keys(hittableObjectsRef);

    for(var i = 0; i < hittableObjectIds.length; i++){

        var hittableObj = hittableObjectsRef[hittableObjectIds[i]];
        var distance = Math.sqrt(Math.pow((hittableObj.x - x), 2) + Math.pow((hittableObj.y - y), 2));

        if(distance < hittableObj.radius + size)
            return false;
    }

    return true;
}

//A function for generating planets and storing their world objects in worldObjectsRef and hitboxes in hittableObjectsRef
function generatePlanet(size, color, health, drops, worldObjectsRef, hittableObjectsRef, id){

    if(id == null)
        id = uniqueId()

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
    var planet = new Planet(position.x , position.y, size, structures, color, health, drops, id);

    hittableObjectsRef[planet.id] = planet;
    worldObjectsRef.planets[planet.id] = planet;
    
    return planet;
}

function generateSpaceMatter(size, color, health, drops, worldObjectsRef, hittableObjectsRef, type, id){

    if(id == null)
        id = uniqueId();

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
    
    hittableObjectsRef[spaceMatter.id] = spaceMatter;
    worldObjectsRef.spaceMatter[spaceMatter.id] = spaceMatter;

    return spaceMatter;
}

function addWorld(){
    var objects = generateWorld();
    var worldId = uniqueId();

    var hive = objects.hivePlanet;

    if(spawnHiveWithSpawners)
    {
        var spawnerScout = new Structure(hive.id, hive.x, hive.y + (hive.radius + 20), -90, "spawner", "server", 0, worldId, uniqueId());
        spawnerScout.enemyType = "scout";
        hive.structures.push(spawnerScout);
    }
        
    worldsData[worldId] = {
        clients: {},
        lobbyClients: {},
        fauxClients: {},
        worldObjects: objects.worldObjects,
        hittableObjects: objects.hittableObjects,
        projectiles: {},
        enemies: {},
        noOxygen: [],
        items: {},
        spawners: [],
        master: null,
        hivePlanet: hive
    }

    var crown = new Item(gridSize / 2, gridSize / 2, {x: 0, y: 0}, "crown", 1, "item-" + uniqueId());
    worldsData[worldId].items[crown.id] = crown;
    
    worldIds.push(worldId);

    numberOfWorlds++;
    console.log('generated new world. total: ', numberOfWorlds);

    return worldId;
}

function removeWorld(worldId){

    numberOfWorlds--;

    for(var i = 0; i < worldIds.length; i++){
        if(worldIds[i] == worldId)
            worldIds.splice(i, 1);
    }

    delete worldsData[worldId];

    console.log('deleted world. total: ', numberOfWorlds, "worldIds: ", worldIds.length);
}

function generateWorld(){

    var generatedWorldObjects = {
        planets: {},
        spaceMatter: {},
        shops: {}
    };

    var generatedHittableObjects = {};

    var shopSize = 200;
    var shop1 = new Shop(gridSize / 4, gridSize / 4, shopSize, "bulletPenetration", uniqueId()); //TOP LEFT
    var shop2 = new Shop(gridSize / 4 * 3, gridSize / 4, shopSize, "cloakTime", uniqueId()); //TOP RIGHT
    var shop3 = new Shop(gridSize / 4, gridSize / 4 * 3, shopSize, "boost", uniqueId()); //BOTTOM LEFT
    var shop4 = new Shop(gridSize / 4 * 3, gridSize / 4 * 3, shopSize, "shipTurret", uniqueId()); //BOTTOM RIGHT

    generatedWorldObjects.shops[shop1.id] = shop1;
    generatedWorldObjects.shops[shop2.id] = shop2;
    generatedWorldObjects.shops[shop3.id] = shop3;
    generatedWorldObjects.shops[shop4.id] = shop4;
    
    generatedHittableObjects[shop1.id] = shop1;
    generatedHittableObjects[shop2.id] = shop2;
    generatedHittableObjects[shop3.id] = shop3;
    generatedHittableObjects[shop4.id] = shop4;

    //Spawning the hittable object for the hive "core" -> the object on top of the "hive" that is linked the the heath of the hive controller
    var hiveObj = new SpaceMatter(gridSize / 2, gridSize / 2, 100, "#84f74f", hiveHealth, {crown: 1}, "hiveObj", "hiveObj");

    generatedWorldObjects.spaceMatter[hiveObj.id] = hiveObj;
    generatedHittableObjects[hiveObj.id] = hiveObj;

    //Spawning a "hive" planet in the center of the map without a hitbox.
    var hive = new Planet(gridSize / 2, gridSize / 2, 180, [], "#84f74f", 1000, {}, "hive");
    generatedWorldObjects.planets[hive.id] = hive;
    generatedHittableObjects[hive.id] = hive;

    for(var i = 0; i < numOfSuns; i++){
        var sunColors = ["#ffd13f", "#fffc70", "#ff7023", "#d6fff6"];
        var colorindex = getRndInteger(0, sunColors.length - 1);
        var color = sunColors[colorindex];
        var type = "sun";
        var size = getRndInteger(500, 700);
        var health = size / 4;
        var drops = {stardust: 50};
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
        var health = size * 3;
        var type = "moon";
        var drops = {asteroidBits: Math.round(size * 2.4), water: Math.round(size / 2), iron: Math.round(size * 1.6)};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
    }

    for(var i = 0; i < numOfScrapMetal; i++){
        var type = "scrapmetal";
        var size = getRndInteger(30, 50);
        var color = getRndInteger(0, 2);
        var health = size * 15;
        var drops = {iron: Math.round(size / 2), circuit: Math.round(size / 4)};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
    }

    for(var i = 0; i < numOfAsteroids; i++){
        var asteroidSize = getRndInteger(10, 30);
        var asteroidColor = getRandomGray();
        var asteroidHealth = asteroidSize * .4;
        var type = "asteroid";
        var drops = {asteroidBits: Math.round(asteroidSize / 2.5), water: Math.round(asteroidSize / 10)};

        generateSpaceMatter(asteroidSize, asteroidColor, asteroidHealth, drops, generatedWorldObjects, generatedHittableObjects, type);
    }

    for(var i = 0; i < numOfDirtThings; i++){
        var size = getRndInteger(10, 30);
        var color = "#997d5a";
        var health = size * .4;
        var type = "dirtthing";
        var drops = {earth: Math.round(size / 2.5), water: Math.round(size / 10)};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
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
        var drops = {darkMatter: 50};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
    }

    console.log('world generation complete:', Object.keys(generatedWorldObjects.spaceMatter).length, ' spaceMatter spawned, ', Object.keys(generatedWorldObjects.planets).length, ' planets spawned');

    return {worldObjects: generatedWorldObjects, hittableObjects: generatedHittableObjects, hivePlanet: hive};
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

function Enemy(x, y, rotation, level, id, worldId){
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.id = id;
    this.worldId = worldId;
    this.level = level;
    this.drops = {circuit: getRndInteger(3, 5) * (level + 1), iron: getRndInteger(10, 15) * (level + 1)};//{gem: 10000, iron: 1000000, asteroidBits: 1234500000, earth: 100000, water: 100000, crystal: 100000, darkMatter: 10000000, circuit: 100000, stardust: 100000000000};

    this.bulletRange = enemyUpgrades[level].bulletRange;
    this.turningSpeed = enemyUpgrades[level].turningSpeed;
    this.radius = enemyUpgrades[level].radius;
    this.damage = enemyUpgrades[level].damage;
    this.maxHealth = enemyUpgrades[level].maxHealth;
    this.health = enemyUpgrades[level].maxHealth;
    this.speed = enemyUpgrades[level].speed;
    this.fireRate = enemyUpgrades[level].fireRate;
    this.projectileSpeed = enemyUpgrades[level].projectileSpeed;
}

function Player(x, y, rotation, level, id, worldId){
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.id = id;
    this.worldId = worldId;
    this.level = level;
    this.drops = {};//{gem: 10000, iron: 1000000, asteroidBits: 1234500000, earth: 100000, water: 100000, crystal: 100000, darkMatter: 10000000, circuit: 100000, stardust: 100000000000};

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
    this.numUpgrades = playerUpgrades[level].numUpgrades;

    this.statLevels = {
        speed: 0,
        fireRate: 0,
        maxHealth: 0,
        damage: 0
    }

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

function Shop(x, y, radius, upgradeType, id){
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.upgradeType = upgradeType;
    this.id = id
}

function Projectile(x, y, velocity, size, color, damage, bulletRange, bulletPenetration, worldId, ownerId, id){
    this.x = x;
    this.y = y;
    this.size = size;
    this.vel = velocity;
    this.color = color;
    this.damage = damage;
    this.worldId = worldId;
    this.bulletRange = bulletRange;
    this.bulletPenetration = bulletPenetration;
    this.ownerId = ownerId;
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
    this.on = true;
    this.worldId = worldId;
    this.id = id;
}

function Item(x, y, initialVelocity, type, amount, id) {
    this.speed = 250;
    this.mergeSpeed = 50;
    this.x = x;
    this.y = y;
    this.iVel = initialVelocity;
    this.rotation = 0;
    this.type = type;
    this.amount = amount;
    this.id = id;
    this.despawnTime = 0;
}

var playerStatUpgrades = {
    roundToPlace: function(value, places){
        var val = Math.round(value);

        if(val.toString().length < places)
            return val;

        var place = Math.pow(10, val.toString().length - places);
        return Math.round(val / place) * place;
    },
    speed: function(lvl){
        return {val: Math.round(lvl * 1.5 + 10), costs:{iron: this.roundToPlace(Math.pow(lvl, 3), 2), crystal: this.roundToPlace(Math.pow(lvl / 5,  3.2), 2)}};
    },
    fireRate: function(lvl){
        return {val: 100 - Math.round(lvl * 5), costs:{iron: this.roundToPlace(Math.pow(lvl, 3), 2), circuit: this.roundToPlace(Math.pow(lvl / 5,  3.6), 2)}};
    },
    maxHealth: function(lvl){
        return {val: this.roundToPlace(Math.pow(lvl + 1, 3.005) + 9, 2), costs:{iron: this.roundToPlace(Math.pow(lvl, 3), 2), earth: this.roundToPlace(Math.pow(lvl / 5,  7), 2)}};
    },
    damage: function(lvl){
        return {val: lvl * 6 + 1, costs:{iron: this.roundToPlace(Math.pow(lvl, 3), 2), darkMatter: this.roundToPlace(Math.pow(lvl / 5,  3.2), 2)}};
    },
}

var enemyUpgrades = [
    {   
        speed: 30,
        fireRate: 50,
        maxHealth: 10,
        damage: 1,
        radius: 18,
        turningSpeed: .05,
        bulletRange: .5,
        projectileSpeed: 6,
        identifier: "enemy"
    },
    {   
        speed: 40,
        fireRate: 30,
        maxHealth: 50,
        damage: 3,
        radius: 25,
        turningSpeed: .05,
        bulletRange: .5,
        projectileSpeed: 7,
        identifier: "enemy"
    },
]

var playerUpgrades = [
        {   
            speed: 20,
            fireRate: 50,
            maxHealth: 10,
            damage: 1,
            radius: 8,
            turningSpeed: .05,
            bulletRange: .5,
            projectileSpeed: 6,
            numUpgrades: 3,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5},
            radius: 10,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            numUpgrades: 6,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 15},
            radius: 15,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            numUpgrades: 9,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 20},
            radius: 20,
            turningSpeed: .1,
            bulletRange: 2,
            projectileSpeed: 19,
            numUpgrades: 12,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50, iron: 10},
            radius: 25,
            turningSpeed: .09,
            bulletRange: 2,
            projectileSpeed: 19,
            numUpgrades: 15,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100, iron: 50},
            radius: 30,
            turningSpeed: .085,
            bulletRange: 3,
            projectileSpeed: 18,
            numUpgrades: 18,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 300, iron: 100},
            radius: 35,
            turningSpeed: .08,
            bulletRange: 4,
            projectileSpeed: 18,
            numUpgrades: 21,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 750, iron: 300},
            radius: 40,
            turningSpeed: .075,
            bulletRange: 5,
            projectileSpeed: 17,
            numUpgrades: 24,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 1200, iron: 800},
            radius: 45,
            turningSpeed: .07,
            bulletRange: 6,
            projectileSpeed: 17,
            numUpgrades: 27,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 2000, iron: 2500},
            radius: 50,
            turningSpeed: .065,
            bulletRange: 7,
            projectileSpeed: 16,
            numUpgrades: 30,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5000, iron: 5000},
            radius: 55,
            turningSpeed: .06,
            bulletRange: 8,
            projectileSpeed: 16,
            numUpgrades: 33,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 10000, iron: 10000},
            radius: 60,
            turningSpeed: .055,
            bulletRange: 9,
            projectileSpeed: 15,
            numUpgrades: 36,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50000, iron: 20000},
            radius: 65,
            turningSpeed: .05,
            bulletRange: 10,
            projectileSpeed: 15,
            numUpgrades: 39,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100000, iron: 50000},
            radius: 70,
            turningSpeed: .045,
            bulletRange: 11,
            projectileSpeed: 14,
            numUpgrades: 42,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 250000, iron: 100000},
            radius: 75,
            turningSpeed: .04,
            bulletRange: 12,
            projectileSpeed: 14,
            numUpgrades: 45,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 500000, iron: 250000},
            radius: 80,
            turningSpeed: .035,
            bulletRange: 13,
            projectileSpeed: 13,
            numUpgrades: 48,
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
    electricity: [
        {
            costs: {asteroidBits: 10},
            identifier: "electricity",
            power: 5
        },
        {
            costs: {iron: 30, circuit: 10},
            identifier: "electricity",
            power: 10
        },
        {
            costs: {iron: 70, circuit: 50},
            identifier: "electricity",
            power: 20
        },
        {
            costs: {iron: 85, circuit: 100, crystal: 20},
            identifier: "electricity",
            power: 50
        }
    ],
    satellite: [
        {
            costs: {iron: 20},
            identifier: "satellite",
            range: 25
        },
        {
            costs: {iron: 100,  circuit: 10},
            identifier: "satellite",
            range: 60
        },
        {
            costs: {iron: 500,  circuit: 50},
            identifier: "satellite",
            range: 95
        },
        {
            costs: {iron: 2000,  circuit: 100},
            identifier: "satellite",
            range: 120
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
            costs: {asteroidBits: 25},
            amount: 2,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 50},
            amount: 5,
            identifier: "mine"
        } ,
        {
            costs:  {asteroidBits: 120},
            amount: 10,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 250},
            amount: 15,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 750},
            amount: 20,
            identifier: "mine"
        } ,
        {
            costs: {asteroidBits: 1500},
            amount: 50,
            identifier: "mine"
        }  ,
        {
            costs: {asteroidBits: 3500},
            amount: 100,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 8000},
            amount: 200,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 17500},
            amount: 500,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 30000},
            amount: 1000,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 75000},
            amount: 1500,
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
        }
        //,
        // {
        //     costs: {water: 3000, crystal: 50, circuit: 25},
        //     maxHealth: 10000,
        //     drops: {crystal: 1000, iron: 1000, water: 1000},
        //     identifier: "shield"
        // },
        // {
        //     costs: {water: 5000, crystal: 75, circuit: 50},
        //     maxHealth: 15000,
        //     drops: {crystal: 1500, iron: 1500, water: 1500},
        //     identifier: "shield"
        // },
        // {
        //     costs: {water: 10000, crystal: 100, circuit: 125},
        //     maxHealth: 25000,
        //     drops: {crystal: 2500, iron: 2500, water: 2500},
        //     identifier: "shield"
        // },
    ],
    spawner: [
        {
            costs: {crystal: 20},
            identifier: "spawner"
        },
        {
            costs: {crystal: 50, water: 100, iron: 1000},
            identifier: "spawner"
        }
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
        if(Object.keys(worldsData[worldIds[i]].clients).length + Object.keys(worldsData[worldIds[i]].lobbyClients).length < clientsPerWorld){
            worldId = worldIds[i];
            break;
        }
    }

    if(worldId == null){
        worldId = addWorld();
    }

    var spawnSize = (gridSize - edgeSpawnPadding) / 2;
    var playerPosition = playerSpawnPoint(-spawnSize, spawnSize, -spawnSize, spawnSize, worldId);

    var playerObject = {id: socket.id, worldId: worldId, x: playerPosition.x, y: playerPosition.y};
    var playerData = newPlayerData(worldId, playerObject.x, playerObject.y);
    
    if(!playerData)
    {
        worldId = addWorld();
        playerObject.worldId = worldId;
        playerData = newPlayerData(worldId, playerObject.x, playerObject.y);
    }

    socket.join(worldId);

    socket.emit("setupLocalWorld", playerData);
    syncDamage(worldId, "sendAll", socket);
    socket.emit("showWorld");

    worldsData[worldId].lobbyClients[playerObject.id] = playerObject;

    console.log('\x1b[36m%s\x1b[0m', "player connected  : ", socket.id , " Clients in game: ", Object.keys(worldsData[worldId].clients).length + Object.keys(worldsData[worldId].lobbyClients).length, ", Clients in lobby: ", Object.keys(worldsData[worldId].lobbyClients).length);

    socket.on("playerStartGame", function(data){
        data.username = data.username.slice(0, 15);

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (playerStartGame) most likely old session.");
            return;
        }

        var lobbyClient = worldsData[data.worldId].lobbyClients[socket.id];

        var level = spawnLevel;
        var position = {x: 0, y: 0};
        var structures = [];
        var playerShopUpgrades = false;
        var shipTurret = false;
        var statLevels = false;

        if(lobbyClient){
            position.x = lobbyClient.x;
            position.y = lobbyClient.y;

            if(lobbyClient.shopUpgrades){
                playerShopUpgrades = lobbyClient.shopUpgrades;     
                
                if(lobbyClient.shipTurret){
                    shipTurret = lobbyClient.shipTurret;                
                }

                if(lobbyClient.statLevels){
                    statLevels = lobbyClient.statLevels;                
                }
            }
                
            
            if(lobbyClient.level)
                level = lobbyClient.level;

            if(lobbyClient.structures)
                structures = lobbyClient.structures;

            delete worldsData[data.worldId].lobbyClients[lobbyClient.id];
        }
        else
        {
            console.log("Lobby client not found");
            return;
        }

        var player = new Player(position.x, position.y, 0, level, socket.id, data.worldId); 
        worldsData[data.worldId].clients[player.id] = player;
        player.structures = structures;
        player.shipTurret = shipTurret;
        
        if(statLevels)
        {
            player.statLevels = statLevels;

            Object.keys(playerStatUpgrades).forEach(key => {
                if(key != "roundToPlace")
                {
                    player[key] = playerStatUpgrades[key](player.statLevels[key]).val;

                    if(key == "maxHealth")
                        player.health = player[key];
                }
                    
            });
        }

        if(playerShopUpgrades)
            player.shopUpgrades = playerShopUpgrades;

        player.username = data.username;
        worldsData[data.worldId].hittableObjects[player.id] = player;

        socket.emit("setupLocalWorld", newPlayerData(data.worldId, player.x, player.y));

        //SPAWN PLAYER ON A PLANET AN MAKE A LANDING PAD ON THAT PLANET ----

        if(!lobbyClient.planet)
        {
            var playerPlanet = false;
            var shuffeledPlanetIds = shuffle(Object.keys(worldsData[worldId].worldObjects.planets));

            for (var i = 0; i < shuffeledPlanetIds.length; i++) {
                var planet = worldsData[worldId].worldObjects.planets[shuffeledPlanetIds[i]];

                if(planet.occupiedBy == null && planet.owner == null && planet.id != "hive")
                {
                    playerPlanet = planet;
                    planet.occupiedBy = player.id;
                    planet.owner = player.id;

                    var planetHealth = worldsData[worldId].hittableObjects[planet.id];

                    if(planetHealth)
                    {
                        planetHealth.health = planetHealth.maxHealth;
                    }
                    break;
                }
            }
        
            var landindPadData = {};
        
            if(playerPlanet)
            {
                var landingPad = new Structure(playerPlanet.id, playerPlanet.x, playerPlanet.y, 0, "landingPad", player.id, 0, worldId, uniqueId());
                playerPlanet.structures.push(landingPad);
                playerPlanet.owner = player.id;
        
                player.structures.push(landingPad);

                var landindPadData = landingPad;
                landindPadData.costs = [];
            }

            lobbyClient.planet = playerPlanet.id;
        
            socket.emit("spawnStructure", landindPadData);
            landindPadData.isFacade = true;
            socket.broadcast.to(worldId).emit("spawnStructure", landindPadData);
        }

        // -----------------------------------------------------------------
        socket.broadcast.to(data.worldId).emit("newPlayer", player);
        socket.emit("newPlayerStart", {player: player, planet: lobbyClient.planet});

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

        syncDamage(worldId, "sendAll", socket);

    });

    socket.on('blackHoleDeath', function(data){

        if(!worldsData[data.worldId].clients)
            return;

        var player = worldsData[data.worldId].clients[socket.id];
        
        if(player)
        {
            damageObject(data.worldId, socket.id, player.health * 2, true, player.x, player.y);
        }
    });

    socket.on('projectileHit', function(data) {

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (projectileHit) most likely old session.");
            return;
        }

        var projectile = worldsData[data.worldId].projectiles[data.projectileId];

        if(!projectile){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","projectile not found.");
            return;
        }

        if(projectile.hitObjects && projectile.hitObjects.contains(data.id)){
            return;
        }

        var damageDealt = projectile.damage;
        var worldHittableObjects = worldsData[data.worldId].hittableObjects;
        var target = worldHittableObjects[data.id];

        if(target != null && (target.type == "wormHole"))
            return;

        damageObject(data.worldId, data.id, damageDealt, true, data.hitX, data.hitY, data.ignoreShield);

        if(projectile.hitObjects)
            projectile.hitObjects.push(data.id);
        else
            projectile.hitObjects = [data.id];
        
        if(projectile.bulletPenetration > 0 && target && target.type && !target.structure && target.type != "planet"){
            projectile.bulletPenetration--;
        }
        else{
            delete worldsData[data.worldId].projectiles[projectile.id];
            io.to(data.worldId).emit('destroyProjectiles', [{id: data.projectileId}]);
        }

    });

    socket.on('playerPos', function(data){
        data.id = socket.id;

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (playerPos) most likely old session.");
            return;
        }

        var player = worldsData[data.worldId].clients[socket.id];

        if(player)
            player = player;
        else
            return;

        player.x = data.x;
        player.y = data.y;

        socket.broadcast.to(data.worldId).emit('playerPos', [data]);
    });

    socket.on('heal', function(data){
        var player = worldsData[data.worldId].clients[socket.id];
        var healed = worldsData[data.worldId].hittableObjects[data.id];

        var addamount = Math.round(healed.maxHealth / 15);
        var costType = "stardust";
        var healCost = addamount;

        var damageSyncIds = [healed.id];

        if(healed.id != player.id) //Thing being healed is not a player (planet)
            healCost = Math.round(healCost / 5);
            

        if(healed.health != healed.maxHealth){

            var stardust = player.drops[costType];

            if(stardust && stardust >= healCost)
            {
                player.drops[costType] -= healCost;

                if(healed.health + addamount < healed.maxHealth)
                healed.health += addamount;
                else
                    healed.health = healed.maxHealth;

                if(healed.id == player.id && player.id == worldsData[worldId].master)
                {
                    var hiveObj = worldsData[worldId].hittableObjects["hiveObj"];
    
                    if(hiveObj)
                    {
                        hiveObj.health = Math.round(healed.health / healed.maxHealth * hiveObj.maxHealth);
                        damageSyncIds.push("hiveObj");
                    }
                    else
                        console.log('\x1b[31m%s\x1b[0m', "[ERROR]","hiveObj not found ... :(");
                }
                
                syncDamage(data.worldId, damageSyncIds);
                socket.emit("syncItem", {item: costType, amount: player.drops[costType]});
            }
            else
                socket.emit("returnMsg", ["NE", costType]); //"Not enough " + costType
        }
        else
            socket.emit("returnMsg", ["AFH"]); //"Already full health"

    });
    
    socket.on('spawnProj', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (spawnProj) most likely old session.");
            return;
        }

        var playerShooter = worldsData[worldId].clients[data.shooterId];
        var structureShooter = allStructures(worldId)[data.shooterId];

        var bulletPenetration;
        var shooter;

        if(structureShooter)
        {
            bulletPenetration = structureShooter.bulletPenetration;
            shooter = structureShooter;
        }
        else if(playerShooter)
        {
            bulletPenetration = playerShooter.shopUpgrades.bulletPenetration.value;
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

        var roundPlace = 10;

        socket.broadcast.to(data.worldId).emit('spawnProj', data);

        var newProj = new Projectile(Math.round(data.x * roundPlace) / roundPlace, Math.round(data.y * roundPlace) / roundPlace, {x: Math.round(data.vel.x * roundPlace) / roundPlace, y: Math.round(data.vel.y * 10) / 10}, data.size, data.color, shooter.damage * data.percentDamage, shooter.bulletRange, bulletPenetration, data.worldId, data.shooterId, data.projId);
        worldsData[data.worldId].projectiles[newProj.id] = newProj;
    });

    socket.on('requestSpawnStructure', function(data){
        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (spawnStructure) most likely old session.");
            return;
        }

        var enoughResources = false;
        data.id = uniqueId();

        var player = worldsData[data.worldId].clients[socket.id];
        var planet = worldsData[data.worldId].worldObjects.planets[data.planetId];
        
        //If we are not placing a landing pad and the planet is not the hive, check if planet has a landing pad first
        if(data.type != "landingPad" && data.planetId != "hive"){
            var hasLandingPad = false;

            planet.structures.forEach(structure => {
                if(structure.type == "landingPad")
                    hasLandingPad = true;
            });

            if(!hasLandingPad){
                socket.emit("returnMsg", ["LP"]); //"Place landing pad first"
                return;
            }
        }

        if(planet.hasMaxStructure(data.type, maxPlanetObjects[data.type]))
        {
            socket.emit("returnMsg", ["AH", data.type, "S"]); //"Planet already has max " + data.type + 's'
            return;
        }

        if(data.type == "landingPad"){

            //Get the number of planets the player owns
            var numberOwnedPlanets = 0;
            var planets = worldsData[data.worldId].worldObjects.planets;

            for (var planetId in planets) {
                if (planets.hasOwnProperty(planetId)) {
                    var aPlanet = planets[planetId];

                    if(aPlanet.owner == socket.id)
                        numberOwnedPlanets++
                }
            }

            if(numberOwnedPlanets >= maxNumberOwnedPlanets)
            {
                socket.emit("returnMsg", ["CO", maxNumberOwnedPlanets, "P"]); // "Can only own " + maxNumberOwnedPlanets + " planets"
                return;
            }
            else
            {
                planet.owner = socket.id;
            }
        }

        var upgradeType = data.type;

        if(data.type.substring(0, 7) == "spawner")
            upgradeType = "spawner";

        if(structureUpgrades[upgradeType]){

            var costsForNextLvl = structureUpgrades[upgradeType][0].costs;
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
                structure = new Structure(planet.id, data.x, data.y, data.rotation, data.type, socket.id, data.level, data.worldId, data.id);

                if(data.type.substring(0, 7) == "spawner"){
                    structure.enemyType = data.enemyType;
                    structure.type = "spawner";

                    if(planet.id != "hive")
                    {
                        console.log("Client trying to spawn spawner on non hive");
                        return;
                    }
                        
                }
                else if (planet.id == "hive") // spawning structures other than spawners on the hive
                {
                    console.log("Client trying to spawn non-spawner structure on hive");
                    return;
                }
                
                if(data.type == "landingPad"){
                    planet.owner = socket.id;
                }

                planet.structures.push(structure);

                data.ownerId = socket.id;
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
                        playerId: socket.id,
                        level: structure.level
                    }
            
                    io.to(worldId).emit('upgradeSync', upgradeData);

                    if(data.type == "shield"){
                        var shieldRadius = planet.radius + 100;  
                        var newHittableObj = {x: planet.x, y: planet.y, radius: shieldRadius, health: upgrades.maxHealth, maxHealth: upgrades.maxHealth, id: data.id, structure: true, planet: planet};
                        newHittableObj.drops = upgrades.drops;
                        worldsData[data.worldId].hittableObjects[newHittableObj.id] = newHittableObj;

                        syncDamage(data.worldId, [data.id]);
                    }
                    else if(data.type == "mine"){
                        structure.amount = upgrades.amount;
                    }
                }
        
                var owner = worldsData[data.worldId].clients[socket.id];
                owner.structures.push(structure);
        
                console.log('\x1b[37m%s\x1b[0m', "spawned structure on planet with id: ", data.planetId, " type: ", data.type, " id:", data.id, " owner: ", socket.id);
            }
            else{
                console.log("Planet not found. Failed to build structure on server");
                return;
            }
            
        }
        else 
            socket.emit("returnMsg", ["NER"]); //"Not enough resources"
        
    });

    socket.on('shopUpgrade', function(data){
        var worldId = data.worldId;

        if(!worldIds.contains(worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (shopUpgrade) most likely old session.");
            return;
        }

        var player = worldsData[worldId].clients[socket.id];

        if(player)
            player = player;
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
                if((player.drops[cost] && costsForNextLvl[cost] <= player.drops[cost]) || costsForNextLvl[cost] == 0){
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
                    upgrade(player.shipTurret, structureUpgrades.turret[shopUpgrades[data.type][level].value], {}, {id: socket.id}, false, worldId);
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
            socket.emit("returnMsg", ["NER"]); //"Not enough resources"
        }

    });

    socket.on('upgradeRequest', function(data){
        var allWorldObjectsObj = allWorldObjects(data.worldId);
        var allStructuresObj = allStructures(data.worldId)
        var allClientsObj = worldsData[data.worldId].clients;

        var allUpgradeableObjects = Object.assign({}, allWorldObjectsObj, allStructuresObj, allClientsObj);
        var playerUpgrading = worldsData[data.worldId].clients[socket.id];

        if(!playerUpgrading)
        {
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "playerUpgrading not found");
            return;
        }
        
        var upgradee = allUpgradeableObjects[data.id];
        var upgrades;

        if(data.type) //upgrade individual player stat
        {
            if(upgradee.statLevels[data.type] >= levelsOfStatUpgrades)
            {
                console.log("upgrade not found");
                return;
            }
            else
                upgrades = playerStatUpgrades;
        }
            
        else
        {
            if(upgradee.type) //The thing being upgraded is a structure
                upgrades = structureUpgrades[upgradee.type];
            else//The thing being upgraded is a player
                upgrades = playerUpgrades;

            if(!upgrades[upgradee.level + 1]){
                console.log("upgrade not found");
                return;
            }
        }
        
        var costsForNextLvl;
        var hasResourceCounter = 0;
        var neededResources = 0;

        if(data.type)
            costsForNextLvl = upgrades[data.type](upgradee.statLevels[data.type] + 1).costs;
        else
            costsForNextLvl = upgrades[upgradee.level + 1].costs;

        for (var cost in costsForNextLvl) {
            if (costsForNextLvl.hasOwnProperty(cost)) {
                if((playerUpgrading.drops[cost] && costsForNextLvl[cost] <= playerUpgrading.drops[cost]) || costsForNextLvl[cost] == 0){
                    hasResourceCounter++;
                }
                neededResources++;
            }
        }

        var doUpgrades;
        var increaseStatLevel = false;

        if(data.type)
        {
            increaseStatLevel = data.type;
            doUpgrades = {};
            doUpgrades[data.type] = upgrades[data.type](upgradee.statLevels[data.type] + 1).val;
        } 
        else
            doUpgrades = upgrades[upgradee.level + 1];

        if(hasResourceCounter == neededResources){
            upgrade(upgradee, doUpgrades, costsForNextLvl, playerUpgrading, increaseStatLevel, data.worldId);
            syncDamage(data.worldId, [data.id]);
        }
        else
            socket.emit("returnMsg", ["NER"]); // "Not enough resources"
    });

    function upgrade(thing, upgrade, costs, playerUpgrading, increaseStatLevel, worldId){

        for (var property in upgrade) {
            if (upgrade.hasOwnProperty(property)) {

                if(property == "maxHealth"){
                    var hittableThingObject = worldsData[worldId].hittableObjects[thing.id];
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

        var returnLvl;

        if(increaseStatLevel)
        {
            thing.statLevels[increaseStatLevel]++;
            returnLvl = thing.statLevels[increaseStatLevel];
        }   
        else
        {
            thing.level++;
            returnLvl = thing.level;
        } 

        var data = {
            upgrade: upgrade,
            id: thing.id,
            costs: costs,
            playerId: playerUpgrading.id,
            level: returnLvl,
            type: increaseStatLevel
        }

        io.to(worldId).emit('upgradeSync', data);
    }

    socket.on('planetOccupancy', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (planetOccupancy) most likely old session.");
            return;
        }

        if(data.planetId == "hive" && worldsData[data.worldId].master != data.playerId) //if the player is on the hive and they dont have the crown item(not the "master")
        {
            socket.emit('ejectPlayer');
            return;
        }
        else
        {
            var planet = worldsData[data.worldId].worldObjects.planets[data.planetId];
            planet.occupiedBy = data.playerId;
        }
            

        socket.broadcast.to(data.worldId).emit('planetOccupancy', data);
    });

    socket.on('turretRot', function(data)
    {
        socket.broadcast.to(data.worldId).emit('turretRot', data.turrets);
    });

    socket.on('cloak', function(data){

        var player = worldsData[data.worldId].clients[socket.id];

        if(!player){
            console.log('\x1b[31m%s\x1b[0m', "cloaked player not found");
            return;
        }

        var cloakLevel = player.shopUpgrades["cloakTime"].level;

        if(cloakLevel > 0)
        {
            var rtrnData = {
                playerId: socket.id,
                cloaked: true
            }
            
            player.cloaked = true;
            socket.broadcast.to(data.worldId).emit('cloak', rtrnData);

            setTimeout(function() {
                rtrnData.cloaked = false;
                player.cloaked = false;
                io.to(data.worldId).emit('cloak', rtrnData);

            }, player.shopUpgrades["cloakTime"].value);
            
        }
        else{
            socket.emit("returnMsg", ["CA"]); //"Purchase cloak ability at shop first."
        }
    });

    socket.on('oxygen', function(data){

        var noOxygen = worldsData[data.worldId].noOxygen;

        if(data.has)
            noOxygen.splice(noOxygen.indexOf(socket.id), 1);
        else if(!noOxygen.contains(socket.id))
            noOxygen.push(socket.id);
    
    });

    socket.on('electricity', function(data){
        if(data.planetId)
        {
            var planet = worldsData[data.worldId].worldObjects.planets[data.planetId];

            if(planet)
            {
                planet.structures.forEach(structure => {
                    structure.on = data.on;
                });
            }
            else
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "Planet defined for electricity update request not found");
        }
    });

    socket.on('disconnect', function (data) {
        
        var worldId = allClients(true)[socket.id].worldId;
        disconnectPlayer(socket.id, false, worldId);

        if(worldsData[worldId])
        {
            console.log('\x1b[31m%s\x1b[0m', "player disconected: ", socket.id,  " Clients in game: ",  Object.keys(worldsData[worldId].clients).length, ", Clients in lobby: ", Object.keys(worldsData[worldId].lobbyClients).length);

            if(Object.keys(worldsData[worldId].clients).length + Object.keys(worldsData[worldId].lobbyClients).length == 0 && worldIds.length > 1){
                removeWorld(worldId);
            }
        }

    });
}

function disconnectPlayer(id, killed, worldId){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (disconnectPlayer) most likely old session.");
        return;
    }

    var lobbyClient = worldsData[worldId].lobbyClients[id];
    var client = worldsData[worldId].clients[id];

    if(lobbyClient)
    {
        var lobbyStructureIds = [];

        if(lobbyClient.structures)
        {
            lobbyClient.structures.forEach(structure => {
                var planet = worldsData[worldId].worldObjects.planets[structure.planetId];

                if(planet){
                    planet = planet;

                    planet.owner = null;
                    planet.occupiedBy = null;

                    lobbyStructureIds.push(structure.id);
                    var planetStructure = findObjectWithId(planet.structures, structure.id);

                    if(planetStructure){
                        if(planetStructure.object.type == "shield")
                        {
                            var shield = worldsData[worldId].hittableObjects[structure.id];

                            if(shield)
                            {
                                delete worldsData[worldId].hittableObjects[shield.id];
                                syncDamage(worldId, [shield.id]);
                            }
                        }

                        planet.structures.splice(planetStructure.index, 1);
                    }   
                }
            });
        }

        io.to(worldId).emit('playerExited', {structureIds: lobbyStructureIds});
        delete worldsData[worldId].lobbyClients[lobbyClient.id];
    }
    else if(client)
    {
        var planets = worldsData[worldId].worldObjects.planets;

        //If player is currently on a planet, change the planet back to a normal planet
        for (var planetId in planets) {
            if (planets.hasOwnProperty(planetId)) {

                var planet = planets[planetId];

                if(planet.occupiedBy == client.id)
                    planet.occupiedBy = null;
            }
        }

        //If player was killed && any planets belong to the player, set the respawn planet to it
        if(killed)
        {
            for (var planetId in planets) {
                if (planets.hasOwnProperty(planetId)) {

                    var planet = planets[planetId];

                    if(planet.owner == client.id)
                    {
                        respawnPlanet = planet;
                    }
                }
            }
        }

        //If the player is the master, reset the master
        if(worldsData[worldId].master == client.id){
            resetMaster(worldId);
        }

        //Drop the players items
        itemDropped(client.x, client.y, client.drops, worldId, 1);

        var noOxygen = worldsData[worldId].noOxygen;

        if(noOxygen.contains(id))
            noOxygen.splice(noOxygen.indexOf(id), 1);

        var data = {
            clientId: client.id,
            structureIds: []
        }

        //Destroy player's structures on planets if disconnected or planet was the hive
        if(client.structures){
            client.structures.forEach(structure => {
                var planet = worldsData[worldId].worldObjects.planets[structure.planetId];

                if(planet){
                    planet.drops = {asteroidBits: Math.round(planet.radius * 12), water: Math.round(planet.radius * 4), earth: Math.round(planet.radius * 6), iron: Math.round(planet.radius * 5)};

                    if(!killed || planet.id == "hive") //If the player disconects or this structure's planet is the hive
                    {
                        planet.owner = null;
                        planet.occupiedBy = null;

                        data.structureIds.push(structure.id);
                        
                        var planetStructure = findObjectWithId(planet.structures, structure.id);

                        if(planetStructure.object.type == "shield")
                        {
                            var shield = worldsData[worldId].hittableObjects[structure.id];

                            if(shield)
                            {
                                delete worldsData[worldId].hittableObjects[shield.id];
                                syncDamage(worldId, [structure.id]);
                            }
                        }

                        planet.structures.splice(planetStructure.index, 1);
                    }
                }
            });
        }

        if(killed){ //Player was killed

            if(!io.sockets.connected[id]){
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "Player killed not found");
                return;
            }

            io.sockets.connected[id].broadcast.to(worldId).emit('playerExited', data);
            io.sockets.connected[id].emit("setupLocalWorld", newPlayerData(worldId,  gridSize / 2 - client.x,  gridSize / 2 - client.y));

            var level = 0;

            if(client.level - levelsLostOnDeath > 0)
                level = client.level - levelsLostOnDeath;

            var spawnSize = (gridSize - edgeSpawnPadding) / 2

            var respawnPlanet = false;

            
            var planets = worldsData[worldId].worldObjects.planets;

            for (var planetId in planets) {
                if (planets.hasOwnProperty(planetId)) {
                    var planet = planets[planetId];

                    if(planet.owner == client.id && planet.id != "hive")
                        respawnPlanet = planet;
                }
            }

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

            var playerObject = {id: id, worldId: worldId, x: playerPosition.x, y: playerPosition.y, level: level, planet: respawnPlanet.id, structures: client.structures, shopUpgrades: client.shopUpgrades, shipTurret: client.shipTurret, statLevels: client.statLevels};
            worldsData[worldId].lobbyClients[playerObject.id] = playerObject;

        } 
        else //Player disconneted
            io.to(worldId).emit('playerExited', data);
        
    
        var hittableClient = worldsData[worldId].hittableObjects[id];
    
        if(hittableClient){
            delete worldsData[worldId].hittableObjects[hittableClient.id];
        }
    
        delete worldsData[worldId].clients[client.id];
    }
    
}

function damageObject(worldId, id, damage, spawnItems, xHit, yHit, ignoreShield = false){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (damageObject) most likely old session.");
        return;
    }

    var worldWorldObjects = worldsData[worldId].worldObjects;
    var worldHittableObjects = worldsData[worldId].hittableObjects;
    var target = worldHittableObjects[id];
    
    if(!target){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]","target not found. Id of: " + id);
        return;
    }

    var damageSyncIds = [];

    if(target.id == "hiveObj" && !worldsData[worldId].master)
        return;

    //If the thing attacked was a player
    var possibleClient = worldsData[worldId].clients[target.id];

    //If the thing attacked was a planet
    var possiblePlanet = worldWorldObjects.planets[target.id];

    //If the thing attacked was space matter
    var possibleSpaceMatter = worldWorldObjects.spaceMatter[target.id];

    //If the thing attacked was an enemy
    var possibleEnemy = worldsData[worldId].enemies[target.id];

    if(possibleClient)
    {
        
        var planets = worldsData[worldId].worldObjects.planets;

        for (var planetId in planets) {
            if (planets.hasOwnProperty(planetId)) {
                var planet = planets[planetId];

                if(planet.occupiedBy == target.id && planet.id != "hive")
                {
                    var shieldRef = false;

                    planet.structures.forEach(structure => {
                        if(structure.type == "shield")
                            shieldRef = structure;
                    });

                    if(shieldRef)
                    {
                        var shield = worldHittableObjects[shieldRef.id];

                        if(shield){
                            target = shield;
                            possibleClient = false;
                            //console.log("damaging Shield Instead of player");
                        }
                    }
                    else{
                        var planetHittableObject = worldHittableObjects[planet.id];

                        if(planetHittableObject)
                            target = planetHittableObject;

                        //console.log("damaging Planet Instead of player");
                    }
                }
            }
        }
    }

    if(possiblePlanet && !ignoreShield) //If the thing being hit is a planet and it has a shield that is on -> hit shield instead
    {
        var shieldRef = false;

        possiblePlanet.structures.forEach(structure => {
            if(structure.type == "shield")
                shieldRef = structure;
        });

        if(shieldRef)
        {
            var shield = worldHittableObjects[shieldRef.id];

            if(shield && shield.health > 0 && shield.on){

                console.log("shield on - hitting shield instead " + shield.id);

                target = shield;
                possiblePlanet = false;
            }
        }
    }

    if(target.structure) //The thing being attacked is a shield
    {
        //target is a reference to the shield hittable object so we need to get the shield structure object to find out if it is on or not.
        var planetStructures = target.planet.structures;
        var shieldStructureObject;

        for(var i = 0; i < planetStructures.length; i++)
        {
            if(planetStructures[i].type == 'shield')
                shieldStructureObject = planetStructures[i];
        }
        
        if(!shieldStructureObject.on)
        {
            console.log("shield off - hitting planet instead");

            possiblePlanet = worldWorldObjects.planets[target.planet.id];
            target = worldHittableObjects[target.planet.id];
    
            if(!target){
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]","target not found. Id of: " + id);
                return;
            }
        }
    }
    
    if(target.drops && !possibleClient && !possibleEnemy && spawnItems){
        if(possiblePlanet && possiblePlanet.structures)
        {
            possiblePlanet.structures.forEach(structure => {
                var structureDrops = structureUpgrades[structure.type][structure.level].costs;

                for (var drop in structureDrops) {
                    if (structureDrops.hasOwnProperty(drop)) {

                        var amount = Math.round(structureDrops[drop] / 750);

                        if(target.drops[drop])
                            target.drops[drop] += amount;
                        else
                            target.drops[drop] = amount;
                    }
                }
            });
        }
        
        if(target.type == 'crystal')
        {   
            if(target.health - damage <= 0)
                itemDropped(xHit, yHit, target.drops, worldId, 1); 
        }
        else if (target.type != "hiveObj")
        {
            var precentDamage = 0;

            if(damage > target.maxHealth)
                precentDamage = 1;
            else
                precentDamage = damage / target.maxHealth;

            if(target.health - damage <= 0)
                precentDamage += precentItemKillBoost;

            itemDropped(xHit, yHit, target.drops, worldId, precentDamage); 
        }
    }   

    if(target.type == 'sun' || target.type == 'blackHole'){
        return;
    }

    if(target.health - damage > 0){
        target.health -= damage;

        damageSyncIds.push(target.id);

        if(target.id == "hiveObj" || target.id == worldsData[worldId].master)
        {
            var oppositeId = target.id == "hiveObj" ? worldsData[worldId].master : "hiveObj";
            var opposite = worldsData[worldId].hittableObjects[oppositeId];

            if(opposite)
            {
                opposite.health = Math.round(target.health / target.maxHealth * opposite.maxHealth);
                damageSyncIds.push(oppositeId);
            }
            else
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Opposite " + oppositeId + " not found ... :(");
        }
    }
    else {
        target.health = 0;

        damageSyncIds.push(target.id);

        if(target.structure){ //If the thing being attacked has structure tag (means it is a shield)

            var planets = worldsData[worldId].worldObjects.planets;

            for (var planetId in planets) {
                if (planets.hasOwnProperty(planetId)) {
                    var planet = planets[planetId];

                    var possibleStructure = findObjectWithId(planet.structures, target.id);

                    if(possibleStructure){
                        planet.structures.splice(possibleStructure.index, 1);
                        delete worldsData[worldId].hittableObjects[target.id];
                    }
                }
            }
        }
        else {
            if(possibleClient){

                if(!target.drops["gem"])
                    target.drops["gem"] = 1;

                disconnectPlayer(target.id, true, worldId);
            }
            else if(possibleEnemy)
            {
                var enemy = worldsData[possibleEnemy.worldId].enemies[possibleEnemy.id];

                if(enemy)
                {
                    var enemyData = {clientId: enemy.id};
                    io.to(worldId).emit('playerExited', enemyData);

                    itemDropped(xHit, yHit, enemy.drops, worldId, 1); 

                    delete worldsData[possibleEnemy.worldId].enemies[enemy.id];
                    var hittableEnemy = worldsData[worldId].hittableObjects[id];

                    if(hittableEnemy)
                        delete worldsData[worldId].hittableObjects[hittableEnemy.id];
                }    
                else
                    console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Enemy not found on server... :(");
            }
            else{
                var newObject;
                var dead = false;

                if(possiblePlanet){

                    if(possiblePlanet.id == "hive")
                        return;

                    var radius = possiblePlanet.radius
                    var color = possiblePlanet.color;
                    var health = possiblePlanet.maxHealth;
                    var drops = possiblePlanet.drops;

                    if(possiblePlanet.structures.length > 0)
                    {
                        possiblePlanet.structures.forEach(structure => {
                            if(structure.type == "shield") //Structure is a shield
                            {
                                delete worldsData[worldId].hittableObjects[structure.id];
                                damageSyncIds.push(structure.id);
                            }
                        });
                    }

                    if(possiblePlanet.owner){
                        var planetOwner = worldsData[worldId].clients[possiblePlanet.owner];
                    
                        if(planetOwner){
                            planetOwner.structures = [];
                        }
                    }

                    delete worldHittableObjects[target.id];
                    delete worldWorldObjects.planets[possiblePlanet.id];

                    newObject = generatePlanet(radius, color, health, drops, worldWorldObjects, worldHittableObjects, target.id);

                    if(!newObject){
                        newObject = {};
                        unspawnedObjects.push({radius: radius, color: color, health: health, drops: drops, worldId: worldId, id: target.id});
                        dead = true;
                    }

                    newObject.type = "planet";
                }
                else if(possibleSpaceMatter){
                    var radius = possibleSpaceMatter.radius;
                    var color = possibleSpaceMatter.color;
                    var health = possibleSpaceMatter.maxHealth;
                    var drops = possibleSpaceMatter.drops;
                    var type = possibleSpaceMatter.type;

                    if(type == "sun")
                        return;

                    delete worldHittableObjects[target.id];
                    delete worldWorldObjects.spaceMatter[possibleSpaceMatter.id];

                    if(type == "hiveObj")
                    {
                        possibleSpaceMatter.health = possibleSpaceMatter.maxHealth;

                        worldWorldObjects.spaceMatter[possibleSpaceMatter.id] = possibleSpaceMatter;
                        worldHittableObjects[possibleSpaceMatter.id] = possibleSpaceMatter;
                        
                        newObject = possibleSpaceMatter;

                        var player = worldsData[worldId].clients[worldsData[worldId].master];

                        if(player){
                            player.drops["crown"] = 0;
                            disconnectPlayer(worldsData[worldId].master, true, worldId);
                        }
                        else
                            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Master not found on server. Can't be disconnected... :(");

                        itemDropped(newObject.x, newObject.y, newObject.drops, worldId, 1); 
                    }
                    else{
                        newObject = generateSpaceMatter(radius, color, health, drops, worldWorldObjects, worldHittableObjects, type, target.id);

                        if(!newObject){
                            unspawnedObjects.push({radius: radius, color: color, health: health, drops: drops, type: type, worldId: worldId, id: target.id});
                            newObject = {type: type};
                            dead = true;
                        }
                    }
                }
                else{
                    console.log("the object type of the damaged object is not accounted for on the server");
                    return;
                }

                if(newObject){
                    var changedWorldObject = 
                    {
                        id: target.id,
                        newObject: newObject,
                        dead: dead
                    }

                    io.to(worldId).emit('newWorldObjectSync', changedWorldObject);
                }

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
                            damageSyncIds.push(obj.id);
                        }
                    }
                    
                }
            }
        }
    }

    syncDamage(worldId, damageSyncIds);
}

var playerRepultionDist = 100;

var attractDistance = 550;
var attractionForce = 20;

var repultionDistance = 100;
var repultionForce = 10;

var accelerationSpeed = .5;

var itterationsBeforeEnemySend = 20;
var enemySendi = itterationsBeforeEnemySend;

var itterationsBeforeItemsSend = 5;
var itemSendi = itterationsBeforeItemsSend;

//Recursive Functions --------------------------------------------------------------------------------------------------
setInterval(sunDamage, sunDamageRate);
setInterval(oxygenDamage, oxygenDamageRate);
setInterval(shieldHeal, shieldHealRate);
setInterval(despawnProjectiles, despawnProjectilesRate);
setInterval(mineProduce, mineProductionRate);
setInterval(spawnEnemies, enemySpawnRate);
setInterval(updateEnemies, updateEnemiesRate);
setInterval(updateItems, updateItemsRate);
setInterval(respawnCrowns, respawnCrownRate);
//setInterval(updateFauxClients, fauxEnemyUpdateRate)
setInterval(updateTargetFauxClients, fauxEnemyAmountUpdateRate);

function updateEnemyProjectiles(worldId){
    var destroyedProjs = [];

    var projectiles = worldsData[worldId].projectiles;
    var projectileIds = Object.keys(projectiles);

    for (var i = projectileIds.length - 1; i >= 0; i--) {
        
        var proj = projectiles[projectileIds[i]];

        if(proj == null)
        {
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Projectile not found");
            continue;
        }
        else if(proj.id.substring(0,2) != "ep")
            continue;
            
        proj.x += proj.vel.x / 1.2;
        proj.y += proj.vel.y / 1.2;

        var hittableObjectIds = Object.keys(worldsData[worldId].hittableObjects);

        for (var x = 0; x < hittableObjectIds.length; x++) {
            var obj = worldsData[worldId].hittableObjects[hittableObjectIds[x]];
            
            var isEnemy = false;
            var enemyIds = Object.keys(worldsData[worldId].enemies);

            for (var e = 0; e < enemyIds.length; e++) {
                var enemy = worldsData[worldId].enemies[enemyIds[e]];

                if(enemy.id == obj.id)
                {
                    isEnemy = true;
                    break;
                }
            }

            if(!isEnemy)
            {
                var dist = Math.sqrt(Math.pow(proj.x - obj.x, 2) + Math.pow(proj.y - obj.y, 2));

                //Projectile hit something
                if(dist < proj.size + obj.radius)
                {
                    var dropItems = false;

                    if(obj.id == undefined || obj.id == "hive")
                        continue;
                    else if(worldsData[worldId].clients[obj.id])
                    {
                        var player = worldsData[worldId].hittableObjects[obj.id];
                        if(player && proj.damage > player.health)
                            dropItems = true;
                    }

                    if(obj.structure && !obj.on) //The thing being attacked is a shield and it is not on
                        continue;

                    damageObject(worldId, obj.id, proj.damage, dropItems);
                    destroyedProjs.push({id: proj.id});
                    delete worldsData[worldId].projectiles[proj.id];

                    break;
                }   
            }
        }            
    }

    if(destroyedProjs.length > 0)
        io.to(worldId).emit('destroyProjectiles', destroyedProjs);
}

function updateEnemies(){
    worldIds.forEach(worldId => {

        updateEnemyProjectiles(worldId);

        var enemyMaster = worldsData[worldId].clients[worldsData[worldId].master];
        var enemies = worldsData[worldId].enemies;
        
        var dataContainer = {};
        var urgentDataContainer = {};

        var enemyIds = Object.keys(enemies);

        for (var i = 0; i < enemyIds.length; i++) {
            var enemy = enemies[enemyIds[i]];
            var instantSnap = false;

            switch(enemy.username)
            {
                case "scout":
                    instantSnap = enemyAI(enemy, worldId);
                break;
                case "defender":
                    instantSnap = enemyAI(enemy, worldId, worldsData[worldId].hivePlanet.x, worldsData[worldId].hivePlanet.y, enemyOptimalDistanceFromHive + worldsData[worldId].hivePlanet.radius);
                break;   
                case "guard":
                    if(enemyMaster)
                        instantSnap = enemyAI(enemy, worldId, enemyMaster.x, enemyMaster.y, enemyOptimalDistanceFromPlayer);
                    else
                        instantSnap = enemyAI(enemy, worldId);
                break;   
            }

            var place = 10;
            var data = {x: Math.round(enemy.x * place) / place, y: Math.round(enemy.y * place) / place, rot: Math.round((enemy.rotation + Math.PI / 2) * place * 10) / (place * 10), id: enemy.id, is: instantSnap};

            if(instantSnap){
                if(!urgentDataContainer[worldId])
                    urgentDataContainer[worldId] = [data];
                else
                    urgentDataContainer[worldId].push(data);      
            }
            else{
                if(!dataContainer[worldId])
                    dataContainer[worldId] = [data];
                else
                    dataContainer[worldId].push(data);
            }
        }        

        //Sending the enemy position data back to the clients
        if(Object.keys(worldsData[worldId].clients).length > 0){
            for (var worldId in urgentDataContainer) {
                if (urgentDataContainer.hasOwnProperty(worldId)) 
                    io.to(worldId).emit('playerPos', urgentDataContainer[worldId]);
            }
        
            if(enemySendi >= itterationsBeforeEnemySend)
            {
                enemySendi = 0;
        
                for (var worldId in dataContainer) {
                    if (dataContainer.hasOwnProperty(worldId)) 
                        io.to(worldId).emit('playerPos', dataContainer[worldId]);
                }
            }
            else
                enemySendi++;
        }
    });
}

var ventureDistance = 1000;
var enemyOptimalDistanceFromHive = 100;
var enemyOptimalDistanceFromPlayer = 200;
var maxDist = 500;

function enemyAI(enemy, worldId, pointX, pointY, optimalDistance){
    var enemies = worldsData[worldId].enemies;
    var player = findClosestPlayer(enemy.x, enemy.y, worldId, [worldsData[worldId].master], true, 2);
    var attractedByPlayer = false;

    var pointAI = optimalDistance && pointX && pointY;

    var distanceToPlayer = Math.sqrt(Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2));
    var distanceToPoint = Math.sqrt(Math.pow(pointX - enemy.x, 2) + Math.pow(pointY - enemy.y, 2));

    var canVenture = true;
    var instantSnap = false;

    if(pointAI)
        canVenture == distanceToPoint < ventureDistance;

    //In Range Of Player
    if (player && distanceToPlayer < attractDistance && canVenture)
    { 
        attractedByPlayer = true;
        playerRepultionDist = player.radius * 3 + 50;

        //Shoot
        if(enemy.shootTimer > 0)
            enemy.shootTimer--;
        else{
            var projVelX = Math.cos(enemy.rotation) * enemy.projectileSpeed;
            var projVelY = Math.sin(enemy.rotation) * enemy.projectileSpeed;
            
            var projVelocity = {x: projVelX, y: projVelY};
            var data = {x: enemy.x, y: enemy.y, vel: projVelocity, size: enemy.radius / 10, color: "#89f442", bulletPenetration: 0, id: "ep-" + uniqueId()}

            io.to(worldId).emit('spawnProj', data);

            var newProj = new Projectile(data.x, data.y, data.vel, data.size, data.color, enemy.damage, enemy.bulletRange, 0, worldId, enemy.id, data.id);
            worldsData[worldId].projectiles[newProj.id] = newProj;
            enemy.shootTimer = enemy.fireRate;
        }

        var targetRot = -Math.atan2(enemy.x - player.x, enemy.y - player.y) - Math.PI / 180 * 90; // target player
        enemy.rotation = targetRot;

        //Attraction to player
        enemy.currentSpeed = attractionForce * (distanceToPlayer - playerRepultionDist) / (attractDistance - playerRepultionDist);
    }
    else {
        enemy.currentSpeed = enemy.speed;

        if(pointAI)
        {
            var dist = distanceToPoint - optimalDistance;

            if(dist > maxDist)
                dist = maxDist;
    
            var correctionFactor = dist / maxDist;
            enemy.rotation = -Math.atan2(enemy.x - pointX, enemy.y - pointY) - (Math.PI / 2) * correctionFactor;
        }
        else
            enemy.rotation = Math.atan2(enemy.velocity.y, enemy.velocity.x);
    }

    var targetX = Math.cos(enemy.rotation) * enemy.currentSpeed;
    var targetY = Math.sin(enemy.rotation) * enemy.currentSpeed;

    enemy.velocity.x = (targetX - enemy.velocity.x) * accelerationSpeed;
    enemy.velocity.y = (targetY - enemy.velocity.y) * accelerationSpeed;
    
    var repulsionTargetForceX = 0;
    var repulsionTargetForceY = 0;

    //Pushing Other Enemies Away
    for (var z = 0; z < Object.keys(enemies); z++) {
        var otherEnemy = enemies[Object.keys(enemies)[i]];
        
        if(otherEnemy != enemy)
        {
            var distanceToOtherEnemy = Math.sqrt(Math.pow(otherEnemy.x - enemy.x, 2) + Math.pow(otherEnemy.y - enemy.y, 2));
            
            if (distanceToOtherEnemy < repultionDistance)
            {
                if(distanceToOtherEnemy == 0)
                    distanceToOtherEnemy = 1;

                var repforce = repultionForce * 2 / distanceToOtherEnemy;

                if(attractedByPlayer) //Also Being Attracted By Player
                    repforce = repultionForce / distanceToOtherEnemy;

                var xDif = (otherEnemy.x - enemy.x)
                var yDif = (otherEnemy.y - enemy.y)

                if(xDif != 0)
                    repulsionTargetForceX -= xDif / Math.abs(xDif) * repforce;
                if(yDif != 0)
                    repulsionTargetForceY -= yDif / Math.abs(yDif) * repforce;
            }
        }
    }

    enemy.velocity.x += repulsionTargetForceX;
    enemy.velocity.y += repulsionTargetForceY;

    //Rebounding off Walls
    if (enemy.x + enemy.velocity.x > gridSize || enemy.x + enemy.velocity.x < 0)
    {
        enemy.velocity.x *= -1;
        instantSnap = true;
    }
        
    if (enemy.y + enemy.velocity.y > gridSize || enemy.y + enemy.velocity.y < 0)
    {
        enemy.velocity.y *= -1;
        instantSnap = true;
    }

    enemy.x += enemy.velocity.x;
    enemy.y += enemy.velocity.y;

    return instantSnap;
}

function updateItems(){
    for (var x = 0; x < worldIds.length; x++) {
        var worldId = worldIds[x];

        if(worldsData[worldId].players == 0)
            continue;

        var items = worldsData[worldId].items;
        var itemIds = Object.keys(items);
        var data = [];
        var dataUrgent = [];
        var placesSent = 10;

        for (var i = itemIds.length - 1; i >= 0; i--){

            var item = items[itemIds[i]];
        
            if(item.type != "crown")
            {
                if(item.despawnTime > itemDespawnTime)
                {
                    dataUrgent.push({collected: true, id: item.id});
                    delete items[item.id];
                    continue;
                }
                else
                    item.despawnTime++;
            }

            var player = findClosestPlayer(item.x, item.y, worldId);
            var velX = 0;
            var velY = 0;
            var merged = false;

            if(player)
            {
                var distanceToPlayer = Math.sqrt(Math.pow(player.x - item.x, 2) + Math.pow(player.y - item.y, 2));
            
                if(distanceToPlayer < itemCollectDist)
                {
                    dataUrgent.push({collected: true, id: item.id});
                    
                    itemCollected({type: item.type, amount: item.amount}, player.id, worldId);
                    delete items[item.id];
                    continue;
                }
    
                velX = (item.x - player.x) * .5;
                velY = (item.y - player.y) * .5;
            
                var mag = Math.sqrt(Math.pow(velX, 2) + Math.pow(velY, 2));
                var itemSpeed = item.speed / distanceToPlayer;
        
                velX *= itemSpeed / mag;
                velY *= itemSpeed / mag;
            
                if(distanceToPlayer > itemAttractDist)
                {
                    velX = 0;
                    velY = 0;
                }
            }

            var velMergeX = 0;
            var velMergeY = 0;

            var revisedItemIds = Object.keys(items);

            for (var x = 0; x < revisedItemIds.length; x++) {
                var _item = items[revisedItemIds[x]];
                
                if(_item != item && _item.type == item.type){

                    var distanceToOtherItem = Math.sqrt(Math.pow(_item.x - item.x, 2) + Math.pow(_item.y - item.y, 2));
                    if(distanceToOtherItem < itemMergeRange)
                    {
                        velMergeX = (_item.x - item.x) * .5;
                        velMergeY = (_item.y - item.y) * .5;

                        var mergeMag = Math.sqrt(Math.pow(velMergeX, 2) + Math.pow(velMergeY, 2));
                        var itemMergeSpeed = item.mergeSpeed / distanceToOtherItem;

                        velMergeX *= itemMergeSpeed / mergeMag;
                        velMergeY *= itemMergeSpeed / mergeMag;

                        item.x += velMergeX;
                        item.y += velMergeY;

                        distanceToOtherItem = Math.sqrt(Math.pow(_item.x - item.x, 2) + Math.pow(_item.y - item.y, 2));

                        if(distanceToOtherItem < itemMergeDist)
                        {
                            _item.amount += item.amount;

                            dataUrgent.push({collected: true, id: item.id});
                            delete items[item.id];
                            merged = true;
                            break;
                        }
                    }
                }
            }

            if(!merged)
            {
                item.x -= velX + item.iVel.x;
                item.y -= velY + item.iVel.y;
    
                var size =  Math.round(Math.sqrt(item.amount) + 8);
    
                if(size > 30)
                    size = 30;
    
                if(item.new)
                    data.push({x: Math.round(item.x * placesSent) / placesSent, y: Math.round(item.y * placesSent) / placesSent, rot: Math.round(item.rotation * placesSent) / placesSent, size: size, type: item.type, id: item.id});
                else
                {
                    item.new = true;
                    dataUrgent.push({x: Math.round(item.x * placesSent) / placesSent, y: Math.round(item.y * placesSent) / placesSent, rot: Math.round(item.rotation * placesSent) / placesSent, size: size, type: item.type, id: item.id, iVel: {x: item.iVel.x, y: item.iVel.y}});
                }

                item.iVel.x *= .9;
                item.iVel.y *= .9;
            }
        }

        if(itemSendi >= itterationsBeforeItemsSend)
        {
            itemSendi = 0;

            if(data.length > 0 || dataUrgent.length > 0)
                io.to(worldId).emit('updateItems', data.concat(dataUrgent));
        }
        else
        {
            itemSendi++;
            if(dataUrgent.length > 0)
                io.to(worldId).emit('updateItems', dataUrgent);
        }

    }
}

function sunDamage()
{
    var syncWorldIds = {};
    var allClientObjs = allClients();

    for (var clientId in allClientObjs) {
        if (allClientObjs.hasOwnProperty(clientId)) {
            var client = allClientObjs[clientId];

            var player = worldsData[client.worldId].hittableObjects[client.id];

            Object.keys(worldsData[client.worldId].worldObjects.spaceMatter).forEach(matterId => {
                var matter = worldsData[client.worldId].worldObjects.spaceMatter[matterId];

                if(matter.type == "sun")
                {
                    var distance = Math.sqrt(Math.pow(matter.x - client.x, 2) + Math.pow(matter.y - client.y, 2)); 

                    if(distance < client.radius + matter.radius){

                        var damage = player.maxHealth / 5;

                        damageObject(player.worldId, player.id, damage, true, player.x, player.y);

                        if(syncWorldIds[player.worldId])
                            syncWorldIds[player.worldId].push(player.id)
                        else
                            syncWorldIds[player.worldId] = [player.id];
                    }

                }
            });
        }
    }

    for (var syncWorldId in syncWorldIds) {
        if (syncWorldIds.hasOwnProperty(syncWorldId)) 
            syncDamage(syncWorldId, syncWorldIds[syncWorldId]);
    }

}

function oxygenDamage()
{
    var syncWorldIds = {};
    var spliced = [];

    for (var i = 0; i < worldIds.length; i++) {
        var worldId = worldIds[i];

        for (var x = worldsData[worldId].noOxygen.length - 1; x >= 0; x--) {
            var clientId = worldsData[worldId].noOxygen[x];

            var hittableObj = worldsData[worldId].hittableObjects[clientId];
            if(!hittableObj)
                continue;

            var damage = Math.round(hittableObj.maxHealth / 10 + 1) - 1;

            if(damage >= hittableObj.health)
                worldsData[worldId].noOxygen.splice(worldsData[worldId].noOxygen.indexOf(clientId), 1);

            var player = worldsData[worldId].clients[clientId];

            if(player)
                damageObject(worldId, clientId, damage, true, player.x, player.y);

            if(syncWorldIds[worldId])
                syncWorldIds[worldId].push(clientId);
            else
                syncWorldIds[worldId] = [clientId];

        }
    }

    for (var syncWorldId in syncWorldIds) {
        if (syncWorldIds.hasOwnProperty(syncWorldId)) 
            syncDamage(syncWorldId, syncWorldIds[syncWorldId]);
    }
}

function shieldHeal()
{
    var syncWorldIds = {};

    var allStructureObjs = allStructures();
    var structureIds = Object.keys(allStructureObjs);

    structureIds.forEach(structureId => {
        var structure = allStructureObjs[structureId];

        if(structure.type == "shield"){
            var shield = worldsData[structure.worldId].hittableObjects[structure.id];

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

function despawnProjectiles()
{
    for (var i = 0; i < worldIds.length; i++) {
        var projectiles = worldsData[worldIds[i]].projectiles;
        var projectileIds = Object.keys(projectiles);
        var destroyedProjs = [];

        projectileIds.forEach(projectileId => {
            var projectile = projectiles[projectileId];

            if(projectile.time != null){

                if(projectile.time > projectile.bulletRange){ 
                    var hitProj = worldsData[projectile.worldId].projectiles[projectile.id];
                    if(hitProj)
                        delete worldsData[projectile.worldId].projectiles[hitProj.id];

                    var data = {id: projectile.id}  
                    destroyedProjs.push(data);
                }
    
                projectile.time++;
            }
            else{
                projectile.time = 0;
            }
        });

        if(destroyedProjs.length > 0)
        {
            io.sockets.to(worldIds[i]).emit('destroyProjectiles', destroyedProjs);
        }       
    }
}

function mineProduce()
{
    var mineProduceItems = [{item: 'iron', chance: 1}, {item: 'asteroidBits', chance: .1}];

    var allClientObjs = allClients();

    for (var clientId in allClientObjs) {
        if (allClientObjs.hasOwnProperty(clientId)) {
            var client = allClientObjs[clientId];
            var mineData = [];
                
            client.structures.forEach(structure => {
                if(structure.type == "mine" && structure.on){
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
        }
    }
}

function spawnEnemies()
{
    for (var i = 0; i < worldIds.length; i++) {
        var worldId = worldIds[i];

        var spawners = worldsData[worldIds[i]].worldObjects.planets["hive"].structures;

        for (var y = 0; y < spawners.length; y++) {
            var spawner = spawners[y];

            var numberOfEnemies = Object.keys(worldsData[worldId].enemies).length;

            if(numberOfEnemies < maxEnemiesPerWorld)
            {
                spawnEnemy(spawner.x, spawner.y, spawner.enemyType, spawner.level, worldId);
            }
        }
    }
}

function respawnCrowns(){

    for (var i = 0; i < worldIds.length; i++) {
        var worldId = worldIds[i];

        if(!checkForCrown(worldId)){
            var crown = new Item(gridSize / 2, gridSize / 2, {x: 0, y: 0}, "crown", 1, "item-" + uniqueId());
            worldsData[worldId].items[crown.id] = crown;
            console.log("crown respawned");
        }
    }
}

function checkForCrown(worldId){
    var clients = worldsData[worldId].clients;
    var clientIds = Object.keys(clients);

    var items = worldsData[worldId].items;
    var itemsIds = Object.keys(items);

    for (var x = 0; x < itemsIds.length; x++) {
        var item = items[itemsIds[x]];

        if(item.type == "crown")
            return true;
    }

    for (var x = 0; x < clientIds.length; x++) {
        var client = clients[clientIds[x]];

        if(client.drops["crown"] > 0)
            return true;
    }

    return false;

}

// ----------------------------------------------------------------------------------------------------------------

function spawnEnemy(x, y, type, level, worldId)
{
    var enemy = new Enemy(x, y, Math.random() * Math.PI * 2, level, "enemy-" + uniqueId(), worldId); 

    switch(type)
    {
        case "defender":
            enemy.speed /= 15;
        break;
        case "guard":
            enemy.speed /= 8;
        break;
        case "scout":
            enemy.speed /= 7;
        break;
    }
    
    enemy.currentSpeed = enemy.speed;

    enemy.username = type;

    var velX = Math.random() - 0.5;
    var velY = Math.random() - 0.5;

    var mag = Math.sqrt(Math.pow(velX, 2) + Math.pow(velY, 2));

    velX *= enemy.speed / mag;
    velY *= enemy.speed / mag;

    enemy.velocity = {x: velX, y: velY};
    enemy.shootTimer = enemy.fireRate;

    worldsData[worldId].enemies[enemy.id] = enemy;
    worldsData[worldId].hittableObjects[enemy.id] = enemy;

    syncDamage(worldId, [enemy.id]);
    io.to(worldId).emit('newPlayer', enemy);
}

function findClosestPlayer(x, y, worldId, ignoreIds = [], ignoreCloaked = false, ignoreLevelsUpTo = 0){

    var dist = null;
    var closestPlayer = false;

    if(!worldIds.contains(worldId))
        return null;

    var clients = worldsData[worldId].clients;
    var clientIds = Object.keys(worldsData[worldId].clients);

    for (var i = 0; i < clientIds.length; i++) {
        var player = clients[clientIds[i]];

        var connectedClients = io.sockets.adapter.rooms[worldId].sockets;
        
        if(!connectedClients[player.id])
            continue;

        if(ignoreIds.contains(player.id) || (ignoreCloaked && player.cloaked))
            continue;

        if(player.level < ignoreLevelsUpTo)
            continue;

        var playerDist = Math.sqrt(Math.pow(player.x - x, 2) + Math.pow(player.y - y, 2));

        if(dist == null || playerDist < dist)
        {
            closestPlayer = player
            dist = playerDist;
        }
            
    }

    return closestPlayer;
}

var itemSpawnSpeed = 8;

function resetMaster(worldId)
{
    worldsData[worldId].master = null;
    var hiveObj = worldsData[worldId].hittableObjects["hiveObj"];

    if(hiveObj)
    {
        hiveObj.maxHealth = hiveHealth;
        hiveObj.health = hiveHealth;
        syncDamage(worldId, ["hiveObj"]);
    }

    io.to(worldId).emit('master', null);
}

function itemDropped(x, y, drops, worldId, precent){
    for (var drop in drops) {
        if (drops.hasOwnProperty(drop)) {

            if(drop == "crown"){
                resetMaster(worldId);
            }

            var amount = Math.round(drops[drop] * precent);
            
            if(amount > 0)
            {
                var iVel = {x: (Math.random() * 2 * itemSpawnSpeed) - itemSpawnSpeed, y: (Math.random() * 2 * itemSpawnSpeed) - itemSpawnSpeed};
                var newItem = new Item(x, y, iVel, drop, amount, "item-" + uniqueId());
                worldsData[worldId].items[newItem.id] = newItem;
            }
        }
    }
}

function itemCollected(item, playerRecivingId, worldId) {
    var player = worldsData[worldId].clients[playerRecivingId];

    if(!player)
        return;
    else
        player = player;

    if(item.amount > 0)
    {
        if(player.drops[item.type])
            player.drops[item.type] += item.amount;
        else
            player.drops[item.type] = item.amount;

        var data = {drops: {}};
        data.drops[item.type] = player.drops[item.type];

        if(item.type == "crown")
        {
            worldsData[worldId].master = playerRecivingId;

            var masterObj = worldsData[worldId].hittableObjects[worldsData[worldId].master];
            var hiveObj = worldsData[worldId].hittableObjects["hiveObj"];

            if(masterObj && hiveObj)
            {

            console.log("set: " + playerRecivingId + " health: " + Math.round(masterObj.health / masterObj.maxHealth * hiveObj.maxHealth).toString());
                hiveObj.health = Math.round(masterObj.health / masterObj.maxHealth * hiveObj.maxHealth);
                syncDamage(worldId, ["hiveObj"]);
            }
                
            io.sockets.connected[playerRecivingId].broadcast.to(worldId).emit('master', playerRecivingId);
        }

        io.sockets.connected[playerRecivingId].emit('items', data);
    }
}

function syncDamage(worldId, changedIds, _socket){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (syncDamage) most likely old session. worldID: " + worldId);
        return;
    }

    var healthData = {hittableObjects: [], deadObjects:[]};
    var worldHittableObjects = worldsData[worldId].hittableObjects;

    if(changedIds != "sendAll"){
        var changedObjects = [];
        
        changedIds.forEach(id => {
            var changedObject = worldHittableObjects[id];

            if(changedObject){
                healthData[id] = Math.round(changedObject.health);

                var healthObj = {
                    health: changedObject.health, 
                    maxHealth: changedObject.maxHealth,
                    radius: changedObject.radius, 
                    x: Math.round(changedObject.x), 
                    y: Math.round(changedObject.y), 
                    id: changedObject.id,
                    active: true
                }

                changedObjects.push(healthObj);
            }
            else{
                healthData.deadObjects.push(id);
            }
        });
        
        healthData.hittableObjects = changedObjects;
        io.to(worldId).emit("damageSync", healthData);
    }
    else{

        var hittableObjectIds = Object.keys(worldHittableObjects);

        for(var i = 0; i < hittableObjectIds.length; i++){

            var hittableObj = worldHittableObjects[hittableObjectIds[i]];

            healthData[hittableObj.id] = Math.round(hittableObj.health);

            var healthObj = {
                health: hittableObj.health, 
                maxHealth: hittableObj.maxHealth, 
                radius: hittableObj.radius, 
                x: Math.round(hittableObj.x), 
                y: Math.round(hittableObj.y), 
                id: hittableObj.id,
                active: true
            }

            healthData.hittableObjects.push(healthObj);
        }

        _socket.emit("damageSync", healthData);
    }
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

    for (var i = 0; i < worldIds.length; i++) {
        projectiles = projectiles.concat(worldsData[worldIds[i]].projectiles);
    }

    return projectiles;
}

function allClients(includeLobbyClients = false){

    var clients = {};

    for (var i = 0; i < worldIds.length; i++) {
        
        var clientsInWorld = worldsData[worldIds[i]].clients;
        var clientsInWorldIds = Object.keys(clientsInWorld);
        
        for (let x = 0; x < clientsInWorldIds.length; x++) {
            const client = clientsInWorld[clientsInWorldIds[x]];
         
            clients[client.id] = client;
        }

        if(includeLobbyClients)
        {
            var lobbyClientsInWorld = worldsData[worldIds[i]].lobbyClients
            var lobbyClientsInWorldIds = Object.keys(lobbyClientsInWorld);
            
            for (let x = 0; x < lobbyClientsInWorldIds.length; x++) {
                const client = lobbyClientsInWorld[lobbyClientsInWorldIds[x]];
            
                clients[client.id] = client;
            }
        }
    }

    return clients;
}

function allWorldObjects(worldId){
    var objects = {};

    var worldObjects = worldsData[worldId].worldObjects;
    var worldWorldObjectsLists = Object.keys(worldObjects);

    worldWorldObjectsLists.forEach(matterArrayId => {

        var list = worldObjects[matterArrayId];
        var listKeys = Object.keys(list);


        listKeys.forEach(matterId => {
            var matter = list[matterId];

            if(matter.health > 0) //if health is above 0
                objects[matter.id] = matter;
        });

    });

    return objects;
}

function allStructures(worldId){
    var structures = {};

    if(!worldId){
        for(var i = 0; i < worldIds.length; i++){
            var planets = worldsData[worldIds[i]].worldObjects.planets;
            var planetIds = Object.keys(planets);

            for(var i = 0; i < planetIds.length; i++){
                var planet = planets[planetIds[i]];

                if(planet.health >= 0)
                {
                    var planetStructures = planet.structures;
        
                    for(var x = 0; x < planetStructures.length; x++){
                        structures[planetStructures[x].id] = planetStructures[x];
                    }
                }
            }
        }

        for(var i = 0; i < worldIds.length; i++){
            var clients = worldsData[worldIds[i]].clients;
            var playerIds = Object.keys(clients);

            for(var x = 0; x < playerIds.length; x++){
                var player = clients[playerIds[x]];

                if(player.shipTurret)
                    structures[player.shipTurret.id] = player.shipTurret;
            }
        }
    }
    else
    {
        if(!worldIds.contains(worldId))
            return structures;

        var planets = worldsData[worldId].worldObjects.planets;
        var planetIds = Object.keys(planets);

        for(var i = 0; i < planetIds.length; i++){
            var planet = planets[planetIds[i]];

            if(planet.health >= 0)
            {
                var planetStructures = planet.structures;
    
                for(var x = 0; x < planetStructures.length; x++){
                    structures[planetStructures[x].id] = planetStructures[x];
                }
            }
        }

        var players = worldsData[worldId].clients;
        var playerIds = Object.keys(players);

        for(var i = 0; i < playerIds.length; i++){
            var player = players[playerIds[i]];

            if(player.shipTurret)
                structures[player.shipTurret.id] = player.shipTurret;
        }

    }

    return structures;
}

function newPlayerData(worldId, x, y) {
    var upgradeInfo = {
        structureUpgrades: structureUpgrades,
        playerStatUpgrades: JSON.stringify(playerStatUpgrades, function(key, value) {
            if (typeof value === 'function') {
                return "(" + value.toString() + ")";
            } else {
                return value;
            }
        }),
        playerUpgrades: playerUpgrades,
        shopUpgrades: shopUpgrades
    }

    var data = {
        existingPlayers: Object.assign({}, worldsData[worldId].clients, worldsData[worldId].enemies, worldsData[worldId].fauxClients),
        worldObjects: worldsData[worldId].worldObjects,
        gridSize: gridSize,
        gridBoxScale: gridBoxScale,
        worldId: worldId,
        master: worldsData[worldId].master,
        upgrades: upgradeInfo,
        numStats: levelsOfStatUpgrades,
        x: x,
        y: y
    };
    return data;
}

Array.prototype.contains = function(thing){

    for (var i = 0; i  < this.length; i++) {
        if(this[i] == thing)
            return true;
    }
    return false;
};

function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;
  
    // While there remain elements to shuffle...
    while (0 !== currentIndex) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
  
      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
  
    return array;
}

process.on('uncaughtException', function(error) {

    console.log("-------------------------- UNHANDELED REJECTION --------------------------------");
    console.log(error);
    console.log("--------------------------------------------------------------------------------");
    //process.exit(1);
});

//Faux Enemies ---------------
var fauxCliendIds = [];
var targetNumberOfClients = 0;

function updateTargetFauxClients() {
    targetNumberOfClients = Math.round(Math.random() * 20) + 10;
}

function updateFauxClients() {
    for (let i = 0; i < worldIds.length; i++) {
        const worldId = worldIds[i];

        var world = worldsData[worldId];
        var realClients = world.clients;
        var numberOfRealClients = Object.keys(realClients).length;

        if(fauxCliendIds.length < targetNumberOfClients && Math.random() > 0.5)
        {
            var player = spawnNewClient(worldId);

            if(numberOfRealClients >= 0)
                io.to(worldId).emit("newPlayer", player);
        }

        if(fauxCliendIds.length == 0)
            return;

        var randomId = fauxCliendIds[Math.round(Math.random() * (fauxCliendIds.length - 1))];
        var randClient = world.fauxClients[randomId];
        var randVal = Math.random();

        if(randVal > 0.5)
        {
            //Client levels up :)

            if(randClient.level >= playerUpgrades.length - 1)
                return;

            randClient.level++;

            var upgradeData = {
                upgrade: {},
                id: randClient.id,
                costs: {},
                playerId: randClient.id,
                level: randClient.level
            }
    
            if(numberOfRealClients >= 0)
                io.to(worldId).emit('upgradeSync', upgradeData);
        }
        else if (randVal > 0.15)
        {
            //Client dies :(

            var data = {
                clientId: randClient.id,
                structureIds: []
            }

            if(numberOfRealClients >= 0)
                io.to(worldId).emit('playerExited', data);

            fauxCliendIds.splice(fauxCliendIds.indexOf(randClient.id), 1);
            delete world.fauxClients[randomId];
        }

        fauxCliendIds.forEach(id => {
            var client = world.fauxClients[id];
            client.timeAlive++;
        });
    }
}


function spawnNewClient(worldId) {
    var fauxClientId = uniqueId();
    var player = new Player(-1000, -1000, 0, 0, fauxClientId, worldId); 
    player.username = randomNameGiver();
    console.log(player.username);
    player.faux = true;
    player.timeAlive = 0;

    worldsData[worldId].fauxClients[fauxClientId] = player;
    fauxCliendIds.push(fauxClientId);

    return player;
}

var presetNames = [];

function storeNames(){
    fs.readFile(path.join(__dirname, 'names.txt'), function(err, data)
    {
        if (err) throw err;
        presetNames = data.toString().split("\n");
        console.log(presetNames.length + " usernames loaded");
    });
}

function randomNameGiver()
{
    return presetNames[Math.round(Math.random() * (presetNames.length - 1))];
}

var resetWorld = new CronJob('0 2 * * 1,3,5', function() {

    console.log("--------------- cron reset world ---------------");

    if(worldIds.length == 1)
    {
        if(worldsData[worldIds[0]].clients.length == 0)
        {
            removeWorld();
            addWorld();
        }
        else
            addWorld();
    }
}, null, true, 'America/Los_Angeles');

resetWorld.start();

// -------------------

storeNames();
updateTargetFauxClients();

addWorld();

