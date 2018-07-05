var express = require('express');
var socket = require('socket.io');
var DoublyList = require('./doublyLinkedList');

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
var numOfCrystals = 100;
var gridSize = 15000;
var gridBoxScale = 200;
var spawnTries = 5;

// var numOfasteroids = 10;
// var numOfPlanets = 0;
// var numOfMoons = 0;
// var numOfSuns = 0;
// var numOfCrystals = 0;
// var gridSize = 2000;
// var gridBoxScale = 10;
// var spawnTries = 5;

var mineProductionRate = 2500;
var despawnProjectilesRate = 100;
var shieldHealRate = 1000;
var sunDamageRate = 1000;

var unspawnedObjects = [];

var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var crystalColors = ["#5b94ef", "#d957ed", "#f9f454", "#85f954"];
var moonColors = ["#929aa8", "#758196", "#758196", "#2d3c56"];

var clientsPerWorld = 100;
var numberOfWorlds = 0;

var levelsLostOnDeath = 3;

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

    var asteroid = new SpaceMatter(position.x, position.y, size, color, health, drops, type, id);
    
    hittableObjectsRef.push(asteroid);
    worldObjectsRef.asteroids.push(asteroid);

    return asteroid;
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
    var shop1 = new Shop(gridSize / 2, gridSize / 2, shopSize, "bulletPenetration");
    //var shop1 = new Shop(gridSize / 4, gridSize / 4, shopSize, "bulletPenetration"); //TOP LEFT
    var shop2 = new Shop(gridSize / 4 * 3, gridSize / 4, shopSize, "cloakTime"); //TOP RIGHT
    var shop3 = new Shop(gridSize / 4, gridSize / 4 * 3, shopSize, "boost"); //BOTTOM LEFT
    var shop4 = new Shop(gridSize / 4 * 3, gridSize / 4 * 3, shopSize, "bulletHoming"); //BOTTOM RIGHT

    generatedWorldObjects.shops.push(shop1, shop2, shop3, shop4);
    generatedHittableObjects.push(shop1, shop2, shop3, shop4);

    for(var i = 0; i < numOfSuns; i++){

        var sunColors = ["#ffd13f", "#fffc70", "#ff7023", "#d6fff6"];

        var colorindex = getRndInteger(0, sunColors.length - 1);
        var color = sunColors[colorindex];
        var type = "sun";
        var size = getRndInteger(500, 700);
        var health = size / 4;

        var drops = {stardust: 20};
        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }
    for(var i = 0; i < numOfPlanets; i++){

        var colorindex = Math.round(getRndInteger(0, planetColors.length - 1));
        var color = planetColors[colorindex];
        var planetSize = getRndInteger(100, 300);
        var planetHealth = planetSize * 18;
        
        var drops = {asteroidBits: Math.round(planetSize * 6), water: Math.round(planetSize * 2), earth: Math.round(planetSize * 3), iron: Math.round(planetSize * 2.5)};

        generatePlanet(planetSize, color, planetHealth, drops, generatedWorldObjects, generatedHittableObjects);
    }

    for(var i = 0; i < numOfasteroids; i++){

        var asteroidSize = getRndInteger(10, 30);
        var asteroidColor = getRandomGray();
        var asteroidHealth = asteroidSize * .2;
        var type = "asteroid";
        var drops = {asteroidBits: Math.round(asteroidSize / 5), water: Math.round(asteroidSize / 20)};

        generateSpaceMatter(asteroidSize, asteroidColor, asteroidHealth, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfCrystals; i++){

        var colorindex = getRndInteger(0, crystalColors.length - 1);
        var color = crystalColors[colorindex];
        var type = "crystal";
        var size = getRndInteger(10, 20);
        var health = size * 15;
        var drops = {crystal: Math.round(size / 1.2)};

        var gems = getRndInteger(0, 3);

        if(gems > 0)
            drops.gem = gems;

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfMoons; i++){
        var colorindex = getRndInteger(0, moonColors.length - 1);
        var color = moonColors[colorindex];
        var size = getRndInteger(50, 75);
        var health = size * 5;
        var type = "moon";
        var drops = {asteroidBits: Math.round(size * 1.2), water: Math.round(size / 4), iron: Math.round(size * .8)};

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
    this.drops = {};//{gem: 1000, iron: 10000, asteroidBits: 1000, earth: 1000, water: 10000, crystal: 100000};

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
        bulletHoming: {
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
            fireRate: 10,
            maxHealth: 10,
            damage: 1,
            radius: 10,
            turningSpeed: .1,
            bulletRange: 3,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5},
            speed: 47,
            fireRate: 11,
            maxHealth: 20,
            damage: 2,
            radius: 15,
            turningSpeed: .1,
            bulletRange: 4,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 20},
            speed: 44,
            fireRate: 12,
            maxHealth: 30,
            damage: 3,
            radius: 20,
            turningSpeed: .09,
            bulletRange: 5,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 50},
            speed: 41,
            fireRate: 13,
            maxHealth: 50,
            damage: 5,
            radius: 25,
            turningSpeed: .08,
            bulletRange: 6,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 100, iron: 5},
            speed: 38,
            fireRate: 15,
            maxHealth: 80,
            damage: 8,
            radius: 30,
            turningSpeed: .07,
            bulletRange: 7,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 300, iron: 10},
            speed: 35,
            fireRate: 18,
            maxHealth: 130,
            damage: 13,
            radius: 35,
            turningSpeed: .06,
            bulletRange: 8,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 750, iron: 50},
            speed: 32,
            fireRate: 21,
            maxHealth: 210,
            damage: 21,
            radius: 40,
            turningSpeed: .05,
            bulletRange: 9,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 1200, iron: 100},
            speed: 29,
            fireRate: 25,
            maxHealth: 340,
            damage: 34,
            radius: 45,
            turningSpeed: .04,
            bulletRange: 10,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 2000, iron: 300, crystal: 5},
            speed: 26,
            fireRate: 30,
            maxHealth: 500,
            damage: 55,
            radius: 50,
            turningSpeed: .03,
            bulletRange: 11,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 5000, iron: 800, crystal: 10},
            speed: 23,
            fireRate: 46,
            maxHealth: 890,
            damage: 89,
            radius: 55,
            turningSpeed: .02,
            bulletRange: 12,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 7000, iron: 2500, crystal: 50},
            speed: 20,
            fireRate: 52,
            maxHealth: 1440,
            damage: 144,
            radius: 60,
            turningSpeed: .01,
            bulletRange: 11,
            identifier: "spaceship"
        },
        {   
            costs: {asteroidBits: 10000, iron: 5000, crystal: 100},
            speed: 17,
            fireRate: 60,
            maxHealth: 2330,
            damage: 233,
            radius: 65,
            turningSpeed: .009,
            bulletRange: 12,
            identifier: "spaceship"
        }
        
];

var structureUpgrades = {
    landingPad: [
    {
        costs: {gem: 2},
        identifier: "landingPad"
    }
    ],
    turret: [
    {
        costs: {iron: 20},
        bulletRange: 15,
        projectileSpeed: 5,
        shootInterval: 100,
        damage: 5,
        identifier: "turret"
    },
    {
        costs: {iron: 40},
        bulletRange: 20,
        projectileSpeed: 6,
        shootInterval: 95,
        damage: 7,
        identifier: "turret"
    },
    {
        costs: {iron: 100},
        bulletRange: 30,
        projectileSpeed: 10,
        shootInterval: 82,
        damage: 12,
        identifier: "turret"
    },
    {
        costs: {iron: 500},
        bulletRange: 35,
        projectileSpeed: 15,
        shootInterval: 70,
        damage: 20,
        identifier: "turret"
    },
    {
        costs: {iron: 1000},
        bulletRange: 40,
        projectileSpeed: 20,
        shootInterval: 50,
        damage: 50,
        identifier: "turret"
    },
    {
        costs: {iron: 5000, gem: 1},
        bulletRange: 45,
        projectileSpeed: 30,
        shootInterval: 20,
        damage: 100,
        identifier: "turret"
    }
    ],
    mine: [
        {
            costs: {asteroidBits: 40},
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
            amount: 20,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 1000},
            amount: 50,
            identifier: "mine"
        } ,
        {
            costs: {asteroidBits: 2000, earth: 200},
            amount: 100,
            identifier: "mine"
        }  ,
        {
            costs: {asteroidBits: 4000, earth: 1000},
            amount: 200,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 10000, earth: 2000},
            amount: 500,
            identifier: "mine"
        },
        {
            costs: {asteroidBits: 20000, earth: 5000},
            amount: 1000,
            identifier: "mine"
        }  
    ],
    shield: [
    {
        costs: {water: 20},
        maxHealth: 100,
        drops: {iron: 20},
        identifier: "shield"
    },
    {
        costs: {water: 100},
        maxHealth: 200,
        identifier: "shield"
    },
    {
        costs: {water: 500},
        maxHealth: 5000,
        identifier: "shield"
    },
    {
        costs: {water: 1000},
        maxHealth: 1000,
        identifier: "shield"
    },
    {
        costs: {water: 2500, crystal: 5},
        maxHealth: 2500,
        identifier: "shield"
    },
    {
        costs: {water: 5000, crystal: 20},
        maxHealth: 5000,
        identifier: "shield"
    },
    {
        costs: {water: 10000, crystal: 50},
        maxHealth: 10000,
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
            costs: {crystal: 5},
            value: 2
        },
        {
            costs: {crystal: 10},
            value: 4
        },
        {
            costs: {crystal: 15},
            value: 6
        },
        {
            costs: {crystal: 20},
            value: 6
        }
    ],
    cloakTime: [
        {
            value: 0
        },
        {
            costs: {crystal: 5},
            value: 3000
        },
        {
            costs: {crystal: 10},
            value: 4000
        },
        {
            costs: {crystal: 15},
            value: 5000
        },
        {
            costs: {crystal: 20},
            value: 6000
        },
    ],
    boost: [
        {
            value: 0
        },
        {
            costs: {crystal: 5},
            value: 40
        },
        {
            costs: {crystal: 10},
            value: 60
        },
        {
            costs: {crystal: 15},
            value: 90
        },
        {
            costs: {crystal: 20},
            value: 110
        },
    ],
    bulletHoming: [
        {
            value: 0
        },
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

    playerObject = {id: socket.id, worldId: worldId};

    socket.join(worldId);
    socket.emit("setupLocalWorld", newPlayerData(worldId));
    syncDamage(worldId);
    socket.emit("showWorld");

    worldsData[worldId].lobbyClients.push(playerObject);

    console.log('\x1b[36m%s\x1b[0m', "player connected  : ", socket.id , " clients connected: ", worldsData[worldId].clients.length +  worldsData[worldId].lobbyClients.length);

    socket.on("playerStartGame", function(data){

        data.username = data.username .slice(0, 15);

        var lobbyClient = findObjectWithId(worldsData[data.worldId].lobbyClients, socket.id);

        var level = 0;

        if(lobbyClient){
            worldsData[data.worldId].lobbyClients.splice(lobbyClient.index, 1);

            if(lobbyClient.object.level)
                level = lobbyClient.object.level;
        }
           
        player = new Player(0, 0, 0, level, socket.id, data.worldId); 

        worldsData[data.worldId].clients.push(player)

        player.username = data.username;
        worldsData[data.worldId].hittableObjects.push(player);

        socket.emit("setupLocalWorld", newPlayerData(data.worldId));

        socket.broadcast.to(data.worldId).emit('newPlayer', player);
        socket.emit("newPlayerStart", player);

        syncDamage(data.worldId);
    });


    socket.on('projectileHit', function(data){

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
        damageObject(data.worldId, data.id, data.senderId, damageDealt);

        if(projectile.object.hitObjects)
            projectile.object.hitObjects.push(data.id);
        else
            projectile.object.hitObjects = [data.id];


        var worldHittableObjects = worldsData[data.worldId].hittableObjects;

        var target = findObjectWithId(worldHittableObjects, data.id);

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

        var player = findObjectWithId(worldsData[data.worldId].hittableObjects, data.id).object;
    
        var addamount = Math.round(player.maxHealth / 15);
        var costType = "stardust";
        var healCost = addamount;

        if(player.health != player.maxHealth){

            var stardust = player.drops[costType];

            if(stardust && stardust >= healCost)
            {
                player.drops[costType] -= healCost;

                if(player.health + addamount < player.maxHealth)
                    player.health += addamount;
                else
                    player.health = player.maxHealth;

                syncDamage(data.worldId, [player.id]);
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

        var shooter = findObjectWithId(worldsData[worldId].clients.concat(allStructures(worldId)), data.shooterId);

        if(!shooter){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "shooter not found");
            return;
        }

        socket.broadcast.to(data.worldId).emit('spawnProj', data);
        worldsData[data.worldId].projectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, shooter.object.damage, shooter.object.bulletRange, shooter.object.shopUpgrades.bulletPenetration.value, data.worldId, data.id));

        console.log('\x1b[33m%s\x1b[0m', "spawned projectile with id: ", data.id, " total: ", worldsData[data.worldId].projectiles.length);
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

                if(planet.hasMaxStructure(data.type, maxPlanetObjects[data.type]))
                {
                    io.sockets.connected[data.ownerId].emit("returnMsg", "Planet aready has max " + data.type + 's');
                    return;
                }
                else{
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

        var player = findObjectWithId(worldsData[data.worldId].clients, socket.id);

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

            var data = {
                level: level,
                type: data.type,
                value: shopUpgrades[data.type][level].value,
                costs: shopUpgrades[data.type][level].costs
            }

            socket.emit('shopUpgrade', data);

        }
        else{
            io.sockets.connected[socket.id].emit("returnMsg", "Not enough resources");
        }

    });

    socket.on('upgradeRequest', function(data){
        var allUpgradeableObjects = allWorldObjects(data.worldId).concat(allStructures(data.worldId).concat(worldsData[data.worldId].clients));

        var playerUpgrading = findObjectWithId(worldsData[data.worldId].clients, data.senderId).object;

        var upgradee = findObjectWithId(allUpgradeableObjects, data.id).object;
        var upgrades;

        if(upgradee.type)
            upgrades = structureUpgrades[upgradee.type];
        else
            upgrades = playerUpgrades;
        

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
            io.sockets.connected[data.senderId].emit("returnMsg", "Not enough resources");
        }
        
    });

    function upgrade(thing, upgrade, costs, playerUpgrading, worldId){

        console.log(thing);

        for (var property in upgrade) {
            if (upgrade.hasOwnProperty(property)) {

                if(property == "maxHealth"){
                    var hittableThingObject = findObjectWithId(worldsData[worldId].hittableObjects, thing.id).object;

                    var precent = hittableThingObject["health"] / hittableThingObject[property];
                    console.log(precent, upgrade[property], precent * upgrade[property]);

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
    
            console.log(player.object.shopUpgrades["cloakTime"].value);

            socket.broadcast.to(data.worldId).emit('cloak', rtrnData);

            setTimeout(function() {
                rtrnData.cloaked = false;
                io.to(data.worldId).emit('cloak', rtrnData);

            }, player.object.shopUpgrades["cloakTime"].value);
            
        }
        else{
            io.sockets.connected[data.senderId].emit("returnMsg", "Purchase cloak ability at shop first.");
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
            console.log('\x1b[31m%s\x1b[0m', "player disconected: ", socket.id,  " clients connected: ", worldsData[worldId].clients.length, "In loby: ", worldsData[worldId].lobbyClients.length);

        if(worldsData[worldId].clients.length + worldsData[worldId].lobbyClients.length == 0){
            removeWorld(worldId);
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
        if(client.object.structures){
            client.object.structures.forEach(structure => {
                structureIds.push(structure.id);
    
                var planet = findObjectWithId(worldsData[worldId].worldObjects.planets, structure.planetId);

                if(planet){
                    planet = planet.object;

                    var planetStructure = findObjectWithId(planet.structures, structure.id);
    
                    if(planetStructure)
                        planet.structures.splice(planetStructure.index, 1);
                }
                
            });
        }
    
        worldsData[worldId].worldObjects.planets.forEach(planet => {
            if(planet.occupiedBy == client.object.id)
                planet.occupiedBy = null;
        });
    
        var data = {
            clientId: client.object.id,
            structureIds: structureIds
        }
        
        if(id != socket.id){ //Player was killed
            io.sockets.connected[id].broadcast.to(worldId).emit('playerExited', data);
            
            var level = 0;

            if(client.object.level - levelsLostOnDeath > 0)
                level = client.object.level - levelsLostOnDeath;

            playerObject = {id: id, worldId: worldId, level: level};
            worldsData[worldId].lobbyClients.push(playerObject);

            io.sockets.connected[id].emit("respawn");
        } 
        else //Player disconneted
            socket.broadcast.to(worldId).emit('playerExited', data);
    
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

       if(possiblePlanet && possiblePlanet.shield)
       {
            var shield = findObjectWithId(worldHittableObjects, possiblePlanet.shield.id);
            if(shield && shield.object.health > 0){
                target = shield;
                possiblePlanet = false;
            }
       }
       

        if(target.object.drops && senderId && !possibleClient){

            var precentDamage = 0;

            if(damage > target.object.maxHealth)
                precentDamage = 1;
            else
                precentDamage = damage / target.object.maxHealth;

            itemDropped(target.object.drops, senderId, worldId, precentDamage); 
        }   

        if(target.object.type == 'sun'){
            return;
        }

        if(target.object.health - damage > 0){
            target.object.health -= damage;
        }
        else {
            target.object.health = 0;

            if(target.object.structure){
                worldWorldObjects.planets.forEach(function(planet){
                    var possibleStructure = findObjectWithId(planet.structures, target.object.id)
                    if(possibleStructure){
                        planet.structures.splice(possibleStructure.index, 1);
                        console.log("destroyed structure off planet");
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
    io.sockets.connected[playerRecivingId].emit("items", {drops: drops, precent: precent});

    var player = findObjectWithId(worldsData[worldId].clients, playerRecivingId);

    if(!player)
        return;
    else
        player = player.object;

    for (var drop in drops) {
        if (drops.hasOwnProperty(drop)) {
            if(player.drops[drop])
                player.drops[drop] += Math.round(drops[drop] * precent);
            else
                player.drops[drop] = Math.round(drops[drop] * precent);
        }
    }
}

function syncDamage(worldId, changedIds){

    var healthData = {hittableObjects: []};
    var deadObejcts = [];

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
    var mineProduceItems = [{item: 'iron', chance: .25}, {item: 'asteroidBits', chance: 1}];

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
    }
    return structures;
}


function newPlayerData(id) {

    var data = {
        existingPlayers: worldsData[id].clients,
        worldObjects: worldsData[id].worldObjects,
        gridSize: gridSize,
        gridBoxScale: gridBoxScale,
        worldId: id
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

addWorld();