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
var numOfPlanets = 55;
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
// var numOfWormHoles = 0;
// var gridSize = 1000;
// var gridBoxScale = 10;
// var spawnTries = 5;

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
var maxEnemiesPerWorld = 30;
var numberOfWorlds = 0;

var spawnHiveWithSpawners = true;

var levelsLostOnDeath = 1;
var maxNumberOwnedPlanets = 3;

var maxPlanetObjects = {
    mine: 5,
    turret: 5,
    shield: 1,
    landingPad: 1,
    electricity: 3,
    satellite: 1,
    spawner: 1
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
    worldObjectsRef.spaceMatter.push(spaceMatter);

    return spaceMatter;
}

function addWorld(){
    var objects = generateWorld();
    var worldId = uniqueId();

    var hive = objects.hivePlanet;

    if(spawnHiveWithSpawners)
    {
        spawnerDefender = new Structure(hive.id, hive.x + (hive.radius + 20), hive.y, 0, "spawner", "server", 0, worldId, uniqueId());
        spawnerScout = new Structure(hive.id, hive.x - (hive.radius + 20), hive.y, -180, "spawner", "server", 0, worldId, uniqueId());
        spawnerGuard = new Structure(hive.id, hive.x, hive.y + (hive.radius + 20), -90, "spawner", "server", 0, worldId, uniqueId());
    
        spawnerDefender.enemyType = "defender";
        spawnerScout.enemyType = "scout";
        spawnerGuard.enemyType = "guard";
    
        hive.structures.push(spawnerDefender, spawnerScout, spawnerGuard);
    }
        
    worldsData[worldId] = {
        clients: [],
        lobbyClients: [],
        worldObjects: objects.worldObjects,
        hittableObjects: objects.hittableObjects,
        projectiles: [],
        enemies: [],
        noOxygen: [],
        items: [],
        spawners: [],
        master: null,
        hivePlanet: hive
    }

    var crown = new Item(gridSize / 2, gridSize / 2, {x: 0, y: 0}, "crown", 1, "item-" + uniqueId());
    worldsData[worldId].items.push(crown);
    
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

    for(var i = 0; i < worldsData[worldId].enemies.length; i++){
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
        spaceMatter: [],
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

    var hiveObj = new SpaceMatter(gridSize / 2, gridSize / 2, 100, "#84f74f", hiveHealth, {crown: 1}, "hiveObj", "hiveObj");

    generatedWorldObjects.spaceMatter.push(hiveObj);
    generatedHittableObjects.push(hiveObj);

    var hive = new Planet(gridSize / 2, gridSize / 2, 180, [], "#84f74f", 1000, {}, "hive");

    generatedWorldObjects.planets.push(hive);
    generatedHittableObjects.push(hive);

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

    console.log('world generation complete: /n', generatedWorldObjects.spaceMatter.length, ' spaceMatter spawned /n', generatedWorldObjects.planets.length, ' planets spawned');

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

function Player(x, y, rotation, level, id, worldId){
    this.x = x;
    this.y = y;
    this.rotation = rotation;
    this.id = id;
    this.worldId = worldId;
    this.level = level;
    this.drops = {};//{gem: 10000, iron: 100000, asteroidBits: 1000000, earth: 100000, water: 100000, crystal: 100000};

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
    this.oxygen = playerUpgrades[level].oxygen;

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
 
var playerUpgrades = [
        {   
            speed: 20,
            fireRate: 20,
            maxHealth: 5,
            damage: 1,
            radius: 8,
            turningSpeed: .05,
            bulletRange: .5,
            projectileSpeed: 6,
            oxygen: 2000,
            identifier: "spaceship"
        },
        {   
            costs: {iron: 1},
            speed: 50,
            fireRate: 100,
            maxHealth: 10,
            damage: 1,
            radius: 10,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            oxygen: 3000,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5},
            speed: 48,
            fireRate: 95,
            maxHealth: 20,
            damage: 2,
            radius: 15,
            turningSpeed: .1,
            bulletRange: 1,
            projectileSpeed: 20,
            oxygen: 3200,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 20},
            speed: 46,
            fireRate: 90,
            maxHealth: 30,
            damage: 3,
            radius: 20,
            turningSpeed: .1,
            bulletRange: 2,
            projectileSpeed: 19,
            oxygen: 3400,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50},
            speed: 44,
            fireRate: 85,
            maxHealth: 50,
            damage: 5,
            radius: 25,
            turningSpeed: .09,
            bulletRange: 2,
            projectileSpeed: 19,
            oxygen: 3600,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100, iron: 5},
            speed: 42,
            fireRate: 80,
            maxHealth: 80,
            damage: 8,
            radius: 30,
            turningSpeed: .085,
            bulletRange: 3,
            projectileSpeed: 18,
            oxygen: 3800,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 300, iron: 10},
            speed: 40,
            fireRate: 75,
            maxHealth: 130,
            damage: 13,
            radius: 35,
            turningSpeed: .08,
            bulletRange: 4,
            projectileSpeed: 18,
            oxygen: 4000,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 750, iron: 50},
            speed: 38,
            fireRate: 70,
            maxHealth: 210,
            damage: 21,
            radius: 40,
            turningSpeed: .075,
            bulletRange: 5,
            projectileSpeed: 17,
            oxygen: 4200,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 1200, iron: 100, earth: 10},
            speed: 36,
            fireRate: 65,
            maxHealth: 340,
            damage: 34,
            radius: 45,
            turningSpeed: .07,
            bulletRange: 6,
            projectileSpeed: 17,
            oxygen: 4400,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 2000, iron: 300, earth: 50, crystal: 5},
            speed: 34,
            fireRate: 60,
            maxHealth: 500,
            damage: 55,
            radius: 50,
            turningSpeed: .065,
            bulletRange: 7,
            projectileSpeed: 16,
            oxygen: 4600,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5000, iron: 800, earth: 300, crystal: 10},
            speed: 32,
            fireRate: 55,
            maxHealth: 890,
            damage: 89,
            radius: 55,
            turningSpeed: .06,
            bulletRange: 8,
            projectileSpeed: 16,
            oxygen: 4800,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 10000, iron: 2500, earth: 500, crystal: 20},
            speed: 30,
            fireRate: 50,
            maxHealth: 1440,
            damage: 144,
            radius: 60,
            turningSpeed: .055,
            bulletRange: 9,
            projectileSpeed: 15,
            oxygen: 5000,
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
            oxygen: 5200,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100000, iron: 10000, earth: 1200, circuit: 75, gem: 5},
            speed: 26,
            fireRate: 40,
            maxHealth: 3000,
            damage: 300,
            radius: 70,
            turningSpeed: .045,
            bulletRange: 11,
            projectileSpeed: 14,
            oxygen: 5400,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 250000, iron: 20000, earth: 2500, circuit: 100, gem: 10},
            speed: 24,
            fireRate: 35,
            maxHealth: 4000,
            damage: 400,
            radius: 75,
            turningSpeed: .04,
            bulletRange: 12,
            projectileSpeed: 14,
            oxygen: 5600,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 500000, iron: 50000, earth: 5000, circuit: 130, gem: 25},
            speed: 22,
            fireRate: 30,
            maxHealth: 5000,
            damage: 500,
            radius: 80,
            turningSpeed: .035,
            bulletRange: 13,
            projectileSpeed: 13,
            oxygen: 5800,
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
            costs: {iron: 10},
            identifier: "electricity",
            power: 5
        },
        {
            costs: {iron: 30, circuit: 10},
            identifier: "electricity",
            power: 10
        },
        {
            costs: {iron: 50, circuit: 50},
            identifier: "electricity",
            power: 20
        },
        {
            costs: {iron: 75, circuit: 100, gem: 1},
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
            costs: {iron: 20},
            identifier: "satellite",
            range: 50
        },
        {
            costs: {iron: 20},
            identifier: "satellite",
            range: 75
        },
        {
            costs: {iron: 20},
            identifier: "satellite",
            range: 100
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
            costs: {crystal: 20, water: 20, iron: 200},
            identifier: "spawner"
        },
        {
            costs: {crystal: 50, water: 20, iron: 1000},
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
    //var playerPosition = {x: 0, y: 0};
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
    syncDamage(worldId);
    socket.emit("showWorld");

    worldsData[worldId].lobbyClients.push(playerObject);

    console.log('\x1b[36m%s\x1b[0m', "player connected  : ", socket.id , " clients connected: ", worldsData[worldId].clients.length +  worldsData[worldId].lobbyClients.length, "In loby: ", worldsData[worldId].lobbyClients.length);

    socket.on("playerStartGame", function(data){

        data.username = data.username.slice(0, 15);

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (playerStartGame) most likely old session.");
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

        //SPAWN PLAYER ON A PLANET AN MAKE A LANDING PAD ON THAT PLANET ----

        if(!lobbyClient.object.planet)
        {
            var playerPlanet = false;

            for (let i = 0; i < worldsData[worldId].worldObjects.planets.length; i++) {
                const planet = worldsData[worldId].worldObjects.planets[i];
                if(planet.occupiedBy == null && planet.owner == null && planet.id != "hive")
                {
                    playerPlanet = planet;
                    planet.occupiedBy = player.id;
                    planet.owner = player.id;
                    break;
                }
            }
        
            var landindPadData = {};
        
            if(playerPlanet)
            {
                landingPad = new Structure(playerPlanet.id, playerPlanet.x, playerPlanet.y, 0, "landingPad", player.id, 0, worldId, uniqueId());
                playerPlanet.structures.push(landingPad);
                playerPlanet.owner = player.id;
        
                player.structures.push(landingPad);

                var landindPadData = landingPad;
                landindPadData.costs = [];
            }

            lobbyClient.object.planet = playerPlanet.id;
        
            socket.emit("spawnStructure", landindPadData);
            landindPadData.isFacade = true;
            socket.broadcast.to(worldId).emit("spawnStructure", landindPadData);
        }

        // -----------------------------------------------------------------

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
            damageObject(data.worldId, socket.id, player.object.health * 2, true, player.object.x, player.object.y);
        }
    });

    socket.on('projectileHit', function(data) {

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (projectileHit) most likely old session.");
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

        damageObject(data.worldId, data.id, damageDealt, true, data.hitX, data.hitY, data.ignoreShield);

        if(projectile.object.hitObjects)
            projectile.object.hitObjects.push(data.id);
        else
            projectile.object.hitObjects = [data.id];
        
        if(projectile.object.bulletPenetration > 0 && target && target.object.type && !target.object.structure && target.object.type != "planet"){
            projectile.object.bulletPenetration--;
        }
        else{
            worldsData[data.worldId].projectiles.splice(projectile.index, 1);
            io.to(data.worldId).emit('destroyProjectiles', [{id: data.projectileId}]);
        }

    });

    socket.on('playerPos', function(data){
        data.id = socket.id;

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (playerPos) most likely old session.");
            return;
        }

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id);

        if(player)
            player = player.object;
        else
            return;

        player.x = data.x;
        player.y = data.y;

        socket.broadcast.to(data.worldId).emit('playerPos', [data]);
    });

    socket.on('heal', function(data){
        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id).object;
        var healed = findObjectWithId(worldsData[data.worldId].hittableObjects, data.id).object;

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
                    var hiveObj = findObjectWithId(worldsData[worldId].hittableObjects, "hiveObj");
    
                    if(hiveObj)
                    {
                        hiveObj.object.health = Math.round(healed.health / healed.maxHealth * hiveObj.object.maxHealth);
                        damageSyncIds.push("hiveObj");
                    }
                    else
                        console.log('\x1b[31m%s\x1b[0m', "[ERROR]","hiveObj not found ... :(");
                }
                
                syncDamage(data.worldId, damageSyncIds);
                io.sockets.connected[socket.id].emit("syncItem", {item: costType, amount: player.drops[costType]});
            }
            else
                io.sockets.connected[socket.id].emit("returnMsg", ["NE", costType]); //"Not enough " + costType
        }
        else
            io.sockets.connected[socket.id].emit("returnMsg", ["AFH"]); //"Already full health"

    });
    
    socket.on('spawnProj', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (spawnProj) most likely old session.");
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
    });

    socket.on('requestSpawnStructure', function(data){

        if(!worldIds.contains(data.worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (spawnStructure) most likely old session.");
            return;
        }

        player = findObjectWithId(worldsData[data.worldId].clients, data.ownerId).object;

        var enoughResources = false;
        data.id = uniqueId();

        planet = findObjectWithId(worldsData[data.worldId].worldObjects.planets, data.planetId).object;
        
        //Check if planet has a landing pad first
        if(data.type != "landingPad" && data.planetId != "hive"){
            var hasLandingPad = false;

            planet.structures.forEach(structure => {
                if(structure.type == "landingPad")
                    hasLandingPad = true;
            });

            if(!hasLandingPad){
                io.sockets.connected[data.ownerId].emit("returnMsg", ["LP"]); //"Place landing pad first"
                return;
            }
        }

        if(planet.hasMaxStructure(data.type, maxPlanetObjects[data.type]))
        {
            io.sockets.connected[data.ownerId].emit("returnMsg", ["AH", data.type, "S"]); //"Planet already has max " + data.type + 's'
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

                io.sockets.connected[data.ownerId].emit("returnMsg", ["CO", maxNumberOwnedPlanets, "P"]); // "Can only own " + maxNumberOwnedPlanets + " planets"
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

                if(data.type.substring(0, 7) == "spawner"){
                    structure.enemyType = data.enemyType;
                    structure.type = "spawner";

                    if(planet.id != "hive")
                        return;
                }
                else if (planet.id == "hive") // spawning structures other than spawners on the hive
                    return;
                
                if(data.type == "landingPad"){
                    planet.owner = socket.id;
                }

                planet.structures.push(structure);

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
                        var newHittableObj = {x: planet.x, y: planet.y, radius: shieldRadius, health: upgrades.maxHealth, maxHealth: upgrades.maxHealth, id: data.id, structure: true, planet: planet};
                        newHittableObj.drops = upgrades.drops;
                        worldsData[data.worldId].hittableObjects.push(newHittableObj);

                        syncDamage(data.worldId, [data.id]);
                    }
                    else if(data.type == "mine"){
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
            io.sockets.connected[data.ownerId].emit("returnMsg", ["NER"]); //"Not enough resources"
        
    });

    socket.on('shopUpgrade', function(data){
        var worldId = data.worldId;

        if(!worldIds.contains(worldId)){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (shopUpgrade) most likely old session.");
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
            io.sockets.connected[socket.id].emit("returnMsg", ["NER"]); //"Not enough resources"
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
            io.sockets.connected[socket.id].emit("returnMsg", ["NER"]); // "Not enough resources"
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
            {
                if(data.playerId != null && planet.id == "hive" && worldsData[data.worldId].master != data.playerId)
                {
                    io.sockets.connected[socket.id].emit('ejectPlayer');
                    return;
                }
                else
                    planet.occupiedBy = data.playerId;
            }
        });

        socket.broadcast.to(data.worldId).emit('planetOccupancy', data);
    });

    socket.on('turretRot', function(data)
    {
        socket.broadcast.to(data.worldId).emit('turretRot', data.turrets);
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
            
            player.object.cloaked = true;
            socket.broadcast.to(data.worldId).emit('cloak', rtrnData);

            setTimeout(function() {
                rtrnData.cloaked = false;
                player.object.cloaked = false;
                io.to(data.worldId).emit('cloak', rtrnData);

            }, player.object.shopUpgrades["cloakTime"].value);
            
        }
        else{
            io.sockets.connected[socket.id].emit("returnMsg", ["CA"]); //"Purchase cloak ability at shop first."
        }
    });

    socket.on('oxygen', function(data){

        var noOxygen = worldsData[data.worldId].noOxygen;

        if(data.has)
            noOxygen.splice(noOxygen.indexOf(socket.id), 1);
        else if(!noOxygen.contains(socket.id))
            noOxygen.push(socket.id);
    
    });

    socket.on('shield', function(data){

        var shield = findObjectWithId(worldsData[data.worldId].hittableObjects, data.id);

        if(shield.object)
        {
            shield.object.on = data.on;
            console.log("shield changed to: " + data.on);
        }
            
    });

    socket.on('disconnect', function (data) {
        
        var worldId;

        allClients(true).forEach(client => {
            if(client.id == socket.id)
                worldId = client.worldId;
        });

        disconnectPlayer(socket.id, false, worldId);

        if(worldsData[worldId])
        {
            console.log('\x1b[31m%s\x1b[0m', "player disconected: ", socket.id,  " clients connected: ", worldsData[worldId].clients.length, "In loby: ", worldsData[worldId].lobbyClients.length);

            if(worldsData[worldId].clients.length + worldsData[worldId].lobbyClients.length == 0){
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

    var lobbyClient = findObjectWithId(worldsData[worldId].lobbyClients, id);
    var client = findObjectWithId(worldsData[worldId].clients, id);

    if(lobbyClient)
    {
        lobbyStructureIds = [];

        if(lobbyClient.object.structures)
        {
            lobbyClient.object.structures.forEach(structure => {
                var planet = findObjectWithId(worldsData[worldId].worldObjects.planets, structure.planetId);

                if(planet){
                    planet = planet.object;

                    planet.owner = null;
                    planet.occupiedBy = null;

                    lobbyStructureIds.push(structure.id);
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

        io.to(worldId).emit('playerExited', {structureIds: lobbyStructureIds});
        worldsData[worldId].lobbyClients.splice(lobbyClient.index, 1);
    }
    else if(client)
    {
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.occupiedBy == client.object.id)
                planet.occupiedBy = null;
        });
     
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.owner == client.object.id)
            {
                respawnPlanet = planet;
            }
        });

        if(worldsData[worldId].master == client.object.id){
            resetMaster(worldId);
        }

        itemDropped(client.object.x, client.object.y, client.object.drops, worldId, 1);

        var noOxygen = worldsData[worldId].noOxygen;

        if(noOxygen.contains(id))
            noOxygen.splice(noOxygen.indexOf(id), 1);
    

        var data = {
            clientId: client.object.id,
            structureIds: []
        }

        //destroy players structures on planets if disconnected or planet was the hive
        if(client.object.structures){
            client.object.structures.forEach(structure => {

                var planet = findObjectWithId(worldsData[worldId].worldObjects.planets, structure.planetId);

                if(planet){
                    planet = planet.object;

                    if(!killed || planet.id == "hive") //If the player disconects or they had control over hive with structures on it
                    {
                        planet.owner = null;
                        planet.occupiedBy = null;

                        data.structureIds.push(structure.id);
                        
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
                }
            });
        }

        if(killed){ //Player was killed

            if(!io.sockets.connected[id]){
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "Player killed not found");
                return;
            }

            io.sockets.connected[id].broadcast.to(worldId).emit('playerExited', data);
            io.sockets.connected[id].emit("setupLocalWorld", newPlayerData(worldId,  gridSize / 2 - client.object.x,  gridSize / 2 - client.object.y));

            var level = 0;

            if(client.object.level - levelsLostOnDeath > 0)
                level = client.object.level - levelsLostOnDeath;

            var spawnSize = (gridSize - edgeSpawnPadding) / 2

            var respawnPlanet = false;

            worldsData[worldId].worldObjects.planets.forEach(planet => {
                if(planet.owner == client.object.id && planet.id != "hive")
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
            io.to(worldId).emit('playerExited', data);
        
    
        var hittableClient = findObjectWithId(worldsData[worldId].hittableObjects, id);
    
        if(hittableClient){
            worldsData[worldId].hittableObjects.splice(hittableClient.index, 1);
        }
    
        worldsData[worldId].clients.splice(client.index, 1);
    }
    
}

function damageObject(worldId, id, damage, spawnItems, xHit, yHit, ignoreShield = false){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (damageObject) most likely old session.");
        return;
    }

    var worldWorldObjects = worldsData[worldId].worldObjects;
    var worldHittableObjects = worldsData[worldId].hittableObjects;
    var target = findObjectWithId(worldHittableObjects, id);
    
    if(!target){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]","target not found. Id of: " + id);
        return;
    }

    var damageSyncIds = [];

    if(target.object.id == "hiveObj" && !worldsData[worldId].master)
        return;

    //If the thing attacked was a player
    var possibleClient = findObjectWithId(worldsData[worldId].clients, target.object.id);

    //If the thing attacked was a planet
    var possiblePlanet = findObjectWithId(worldWorldObjects.planets, target.object.id);

    //If the thing attacked was space matter
    var possibleSpaceMatter = findObjectWithId(worldWorldObjects.spaceMatter, target.object.id);

    //If the thing attacked was an enemy
    var possibleEnemy = findObjectWithId(worldsData[worldId].enemies, target.object.id);

    if(possibleClient)
    {
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.occupiedBy == target.object.id && planet.id != "hive")
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

    if(possiblePlanet && !ignoreShield)
    {
        var shieldRef = false;

        possiblePlanet.object.structures.forEach(structure => {
            if(structure.type == "shield")
                shieldRef = structure;
        });

        if(shieldRef)
        {
            var shield = findObjectWithId(worldHittableObjects, shieldRef.id);

            if(shield && shield.object.health > 0 && shield.object.on){

                console.log("shield on - hitting shield instead " + shield.object.id);

                target = shield;
                possiblePlanet = false;
            }
        }
    }

    if(target.object.structure && !target.object.on) //The thing being attacked is a shield and it is not on
    {
        possiblePlanet = findObjectWithId(worldWorldObjects.planets, target.object.planet.id);
        target = findObjectWithId(worldHittableObjects, target.object.planet.id);

        console.log("shield off - hitting planet instead ");

        if(!target){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","target not found. Id of: " + id);
            return;
        }
    }

    if(target.object.drops && !possibleClient && !possibleEnemy && spawnItems){

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
                itemDropped(xHit, yHit, target.object.drops, worldId, 1); 
        }
        else if (target.object.type != "hiveObj")
        {
            var precentDamage = 0;

            if(damage > target.object.maxHealth)
                precentDamage = 1;
            else
                precentDamage = damage / target.object.maxHealth;

            if(target.object.health - damage <= 0)
                precentDamage += precentItemKillBoost;

            itemDropped(xHit, yHit, target.object.drops, worldId, precentDamage); 
        }
    }   

    if(target.object.type == 'sun'){
        return;
    }

    if(target.object.health - damage > 0){
        target.object.health -= damage;

        damageSyncIds.push(target.object.id);

        if(target.object.id == "hiveObj" || target.object.id == worldsData[worldId].master)
        {
            var oppositeId = target.object.id == "hiveObj" ? worldsData[worldId].master : "hiveObj";
            var opposite = findObjectWithId(worldsData[worldId].hittableObjects, oppositeId);

            if(opposite)
            {
                opposite.object.health = Math.round(target.object.health / target.object.maxHealth * opposite.object.maxHealth);
                damageSyncIds.push(oppositeId);
            }
            else
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Opposite " + oppositeId + " not found ... :(");
        }
    }
    else {
        target.object.health = 0;

        if(target.object.structure){ //Is a structure (shield)
            worldWorldObjects.planets.forEach(function(planet){
                var possibleStructure = findObjectWithId(planet.structures, target.object.id);

                if(possibleStructure){
                    planet.structures.splice(possibleStructure.index, 1);
                    worldHittableObjects.splice(target.index, 1);
                    syncDamage(worldId, [possibleStructure.object.id]);
                }
            });
        }
        else {
            if(possibleClient){

                if(!target.object.drops["gem"])
                    target.object.drops["gem"] = 1;

                disconnectPlayer(target.object.id, true, worldId);
            }
            else if(possibleEnemy)
            {
                var enemy = findObjectWithId(worldsData[possibleEnemy.object.worldId].enemies, possibleEnemy.object.id);

                if(enemy)
                {
                    var enemyData = {clientId: enemy.object.id};
                    io.to(worldId).emit('playerExited', enemyData);

                    itemDropped(xHit, yHit, enemy.object.drops, worldId, 1); 

                    worldsData[possibleEnemy.object.worldId].enemies.splice(enemy.index, 1);
                    var hittableEnemy = findObjectWithId(worldsData[worldId].hittableObjects, id);

                    if(hittableEnemy){
                        worldsData[worldId].hittableObjects.splice(hittableEnemy.index, 1);
                    }
                }    
                else
                    console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Enemy not found on server... :(");
            }
            else{
                var newObject;
                var dead = false;

                if(possiblePlanet){
                    var radius = possiblePlanet.object.radius
                    var color = possiblePlanet.object.color;
                    var health = possiblePlanet.object.maxHealth;
                    var drops = possiblePlanet.object.drops;

                    if(possiblePlanet.object.id == "hive")
                        return;

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

                    if(type == "sun")
                        return;

                    worldHittableObjects.splice(target.index, 1);
                    worldWorldObjects.spaceMatter.splice(possibleSpaceMatter.index, 1);

                    if(type == "hiveObj")
                    {
                        possibleSpaceMatter.object.health = possibleSpaceMatter.object.maxHealth;

                        worldWorldObjects.spaceMatter.push(possibleSpaceMatter.object);
                        worldHittableObjects.push(possibleSpaceMatter.object);
                        
                        newObject = possibleSpaceMatter.object;

                        var player = findObjectWithId(worldsData[worldId].clients, worldsData[worldId].master);

                        if(player){
                            player.object.drops["crown"] = 0;
                            disconnectPlayer(worldsData[worldId].master, true, worldId);
                        }
                        else
                            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Master not found on server. Can't be disconnected... :(");

                        itemDropped(newObject.x, newObject.y, newObject.drops, worldId, 1); 
                    }
                    else{
                        newObject = generateSpaceMatter(radius, color, health, drops, worldWorldObjects, worldHittableObjects, type, target.object.id);

                        if(!newObject){
                            unspawnedObjects.push({radius: radius, color: color, health: health, drops: drops, type: type, worldId: worldId, id: target.object.id});
                            newObject = {type: type};
                            dead = true;
                        }
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
setInterval(respawnCrowns, respawnCrownRate)

function updateEnemies(){
    worldIds.forEach(worldId => {

        var destroyedProjs = [];

        for (let i = worldsData[worldId].projectiles.length - 1; i >= 0; i--) {
            
            const proj = worldsData[worldId].projectiles[i];

            if(proj == null)
            {
                console.log('\x1b[31m%s\x1b[0m', "[ERROR]","Projectile not found");
                continue;
            }
            else if(proj.id.substring(0,2) != "ep")
                continue;
                
            proj.x += proj.vel.x / 1.2;
            proj.y += proj.vel.y / 1.2;
    
            for (let x = 0; x < worldsData[worldId].hittableObjects.length; x++) {
                const obj = worldsData[worldId].hittableObjects[x];
                
                var isEnemy = false;
    
                for (let e = 0; e < worldsData[worldId].enemies.length; e++) {
                    const enemy = worldsData[worldId].enemies[e];
    
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
                        else if(worldsData[worldId].clients.contains(obj.id))
                        {
                            var player = findObjectWithId(worldsData[worldId].hittableObjects, obj.id);
                            if(player && proj.damage > player.object.health)
                                dropItems = true;
                        }


                        if(obj.structure && !obj.on) //The thing being attacked is a shield and it is not on
                            continue;

                        damageObject(worldId, obj.id, proj.damage, dropItems);
                        destroyedProjs.push({id: proj.id});
                        worldsData[worldId].projectiles.splice(i, 1);
                        break;
                    }   
                }
            }            
        }

        if(destroyedProjs.length > 0)
            io.to(worldId).emit('destroyProjectiles', destroyedProjs);

    });

    for (let index = 0; index < worldIds.length; index++) {
        const worldId = worldIds[index];

        var enemyMaster = findObjectWithId(worldsData[worldId].clients, worldsData[worldId].master);
        var enemies = worldsData[worldId].enemies;
        
        var dataContainer = {};
        var urgentDataContainer = {};
        
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];

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
                        instantSnap = enemyAI(enemy, worldId, enemyMaster.object.x, enemyMaster.object.y, enemyOptimalDistanceFromPlayer);
                    else
                        instantSnap = enemyAI(enemy, worldId);
                break;   
            }

            var place = 10;
            var data = {x: Math.round(enemy.x * place) / place, y: Math.round(enemy.y * place) / place, rot: Math.round((enemy.rotation + Math.PI / 2) * place * 10) / (place * 10), id: enemy.id, instantSnap: instantSnap};
            
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
    }

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

var ventureDistance = 1000;
var enemyOptimalDistanceFromHive = 100;
var enemyOptimalDistanceFromPlayer = 200;
var maxDist = 500;

function enemyAI(enemy, worldId, pointX, pointY, optimalDistance){
    var enemies = worldsData[worldId].enemies;
    var player = findClosestPlayer(enemy.x, enemy.y, worldId, [worldsData[worldId].master], true);
    var attractedByPlayer = false;

    var pointAI = optimalDistance && pointX && pointY;

    var distanceToPlayer = Math.sqrt(Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2));
    var distanceFromPlayerToHive = Math.sqrt(Math.pow(pointX - player.x, 2) + Math.pow(pointY - player.y, 2));
    var distanceToPoint = Math.sqrt(Math.pow(pointX - enemy.x, 2) + Math.pow(pointY - enemy.y, 2));

    var canVenture = true;

    var instantSnap = false;

    if(pointAI)
        canVenture == distanceFromPlayerToHive < ventureDistance;

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
            worldsData[worldId].projectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, enemy.damage, enemy.bulletRange, 0, worldId, data.id));
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
    for (var z = 0; z < enemies.length; z++) {
        var otherEnemy = enemies[z];
        
        if(otherEnemy != enemy)
        {
            var distanceToOtherEnemy = Math.sqrt(Math.pow(otherEnemy.x - enemy.x, 2) + Math.pow(otherEnemy.y - enemy.y, 2));
            
            if (distanceToOtherEnemy < repultionDistance)
            {
                var repforce = repultionForce * 2 / distanceToOtherEnemy;

                if(attractedByPlayer) //Also Being Attracted By Player
                    repforce = repultionForce / distanceToOtherEnemy;

                repulsionTargetForceX -= (otherEnemy.x - enemy.x) / Math.abs(otherEnemy.x - enemy.x) * repforce;
                repulsionTargetForceY -= (otherEnemy.y - enemy.y) / Math.abs(otherEnemy.y - enemy.y) * repforce;
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
    for (let x = 0; x < worldIds.length; x++) {
        const worldId = worldIds[x];

        var items = worldsData[worldId].items;
        var data = [];
        var dataUrgent = [];

        for (var i = items.length - 1; i >= 0; i--){

            var item = items[i];
        
            if(item.type != "crown")
            {
                if(item.despawnTime > itemDespawnTime)
                {
                    dataUrgent.push({collected: true, id: item.id});
                    items.splice(i, 1);
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
                    items.splice(i, 1);
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

            for (let x = 0; x < items.length; x++) {
                const _item = items[x];
                
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
                            items.splice(i, 1);
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
                    data.push({x: item.x, y: item.y, rot: item.rotation, size: size, type: item.type, id: item.id});
                else
                {
                    item.new = true;
                    dataUrgent.push({x: item.x, y: item.y, rot: item.rotation, size: size, type: item.type, id: item.id, iVel: {x: item.iVel.x, y: item.iVel.y}});
                }

                item.iVel.x *= .9;
                item.iVel.y *= .9;
            }
        }

        if(itemSendi >= itterationsBeforeItemsSend)
        {
            itemSendi = 0;
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

    allClients().forEach(client => {

        var player = findObjectWithId(worldsData[client.worldId].hittableObjects, client.id).object;

        worldsData[client.worldId].worldObjects.spaceMatter.forEach(matter => {
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

    });

    for (var syncWorldId in syncWorldIds) {
        if (syncWorldIds.hasOwnProperty(syncWorldId)) 
            syncDamage(syncWorldId, syncWorldIds[syncWorldId]);
    }

}

function oxygenDamage()
{
    var syncWorldIds = {};
    var spliced = [];

    for (let i = 0; i < worldIds.length; i++) {
        const worldId = worldIds[i];

        for (let x = worldsData[worldId].noOxygen.length - 1; x >= 0; x--) {
            const clientId = worldsData[worldId].noOxygen[x];

            var hittableObj = findObjectWithId(worldsData[worldId].hittableObjects, clientId);
            if(!hittableObj)
                continue;

            var damage = Math.round(hittableObj.object.maxHealth / 10 + 1) - 1;

            if(damage >= hittableObj.object.health)
                worldsData[worldId].noOxygen.splice(worldsData[worldId].noOxygen.indexOf(clientId), 1);

            var player = findObjectWithId(worldsData[worldId].clients, clientId);

            if(player)
                damageObject(worldId, clientId, damage, true, player.object.x, player.object.y);

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

function despawnProjectiles()
{
    for (let i = 0; i < worldIds.length; i++) {
        var projectiles = worldsData[worldIds[i]].projectiles;

        var destroyedProjs = [];

        projectiles.forEach(projectile => {
            if(projectile.time != null){

                if(projectile.time > projectile.bulletRange){ 
                    var hitProj = findObjectWithId(worldsData[projectile.worldId].projectiles, projectile.id);
                    if(hitProj)
                        worldsData[projectile.worldId].projectiles.splice(hitProj.index, 1);

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

function spawnEnemies()
{
    for (let i = 0; i < worldIds.length; i++) {
        const worldId = worldIds[i];

        var structures = allStructures(worldId);
        var spawners = [];

        for (let x = 0; x < structures.length; x++) {
            const structure = structures[x];

            if(structure.type == "spawner")
                spawners.push(structure);
        }

        for (let y = 0; y < spawners.length; y++) {
            const spawner = spawners[y];

            if(worldsData[worldId].enemies.length < maxEnemiesPerWorld)
            {
                spawnEnemy(spawner.x, spawner.y, spawner.enemyType, (spawner.level + 1) * 3, worldId);
            }
        }
    }
}

function respawnCrowns(){

    for (let i = 0; i < worldIds.length; i++) {
        const worldId = worldIds[i];

        if(!checkForCrown(worldId)){
            var crown = new Item(gridSize / 2, gridSize / 2, {x: 0, y: 0}, "crown", 1, "item-" + uniqueId());
            worldsData[worldId].items.push(crown);
            console.log("crown respawned");
        }
    }
}

function checkForCrown(worldId){
    var clients = worldsData[worldId].clients;
    var items = worldsData[worldId].items;

    for (let x = 0; x < items.length; x++) {
        const item = items[x];

        if(item.type == "crown")
            return true;
    }

    for (let x = 0; x < clients.length; x++) {
        const client = clients[x];

        if(client.drops["crown"] > 0)
            return true;
    }

    return false;

}

// ----------------------------------------------------------------------------------------------------------------

function spawnEnemy(x, y, type, level, worldId)
{
    var enemy = new Player(x, y, Math.random() * Math.PI * 2, level, "enemy-" + uniqueId(), worldId); 

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
    enemy.drops = {iron: level * 10, circuit: level * 2};

    var velX = Math.random() - 0.5;
    var velY = Math.random() - 0.5;

    var mag = Math.sqrt(Math.pow(velX, 2) + Math.pow(velY, 2));

    velX *= enemy.speed / mag;
    velY *= enemy.speed / mag;

    enemy.velocity = {x: velX, y: velY};
    enemy.shootTimer = enemy.fireRate;

    worldsData[worldId].enemies.push(enemy);
    worldsData[worldId].hittableObjects.push(enemy);

    syncDamage(worldId);
    io.to(worldId).emit('newPlayer', enemy);
    
}

function findClosestPlayer(x, y, worldId, ignoreIds = [], ignoreCloaked = false){

    var dist = null;
    var closestPlayer = false;

    if(!worldIds.contains(worldId))
        return null;

    for (let i = 0; i < worldsData[worldId].clients.length; i++) {
        const player = worldsData[worldId].clients[i];

        var connectedClients = io.sockets.adapter.rooms[worldId].sockets;
        
        if(!connectedClients[player.id])
            continue;

        if(ignoreIds.contains(player.id) || (ignoreCloaked && player.cloaked))
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
    var hiveObj = findObjectWithId(worldsData[worldId].hittableObjects, "hiveObj");

    if(hiveObj)
    {
        hiveObj.object.maxHealth = hiveHealth;
        hiveObj.object.health = hiveHealth;
        syncDamage(worldId, ["hiveObj"]);
    }
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
                worldsData[worldId].items.push(new Item(x, y, iVel, drop, amount, "item-" + uniqueId()));
            }
        }
    }
}

function itemCollected(item, playerRecivingId, worldId) {
    var player = findObjectWithId(worldsData[worldId].clients, playerRecivingId);

    if(!player)
        return;
    else
        player = player.object;

    if(item.amount > 0)
    {
        if(player.drops[item.type])
            player.drops[item.type] += item.amount;
        else
            player.drops[item.type] = item.amount;

        data = {drops: {}};
        data.drops[item.type] = item.amount;

        if(item.type == "crown")
        {
            worldsData[worldId].master = playerRecivingId;

            var masterObj = findObjectWithId(worldsData[worldId].hittableObjects, worldsData[worldId].master);
            var hiveObj = findObjectWithId(worldsData[worldId].hittableObjects, "hiveObj");

            if(masterObj && hiveObj)
            {

            console.log("set: " + playerRecivingId + " health: " + Math.round(masterObj.object.health / masterObj.object.maxHealth * hiveObj.object.maxHealth).toString());
                hiveObj.object.health = Math.round(masterObj.object.health / masterObj.object.maxHealth * hiveObj.object.maxHealth);
                syncDamage(worldId, ["hiveObj"]);
            }
                
            io.sockets.connected[playerRecivingId].broadcast.to(worldId).emit('master', playerRecivingId);
        }

        io.sockets.connected[playerRecivingId].emit('items', data);
    }
}

function syncDamage(worldId, changedIds){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. (syncDamage) most likely old session. worldID: " + worldId);
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

        if(!worldIds.contains(worldId))
            return structures;

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

function newPlayerData(worldId, x, y) {

    var upgradeInfo = {
        structureUpgrades: structureUpgrades,
        playerUpgrades: playerUpgrades,
        shopUpgrades: shopUpgrades
    }

    var data = {
        existingPlayers: worldsData[worldId].clients.concat(worldsData[worldId].enemies),
        worldObjects: worldsData[worldId].worldObjects,
        gridSize: gridSize,
        gridBoxScale: gridBoxScale,
        worldId: worldId,
        master: worldsData[worldId].master,
        upgrades: upgradeInfo,
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