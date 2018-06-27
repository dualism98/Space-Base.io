var express = require('express');
var socket = require('socket.io');
var DoublyList = require('./doublyLinkedList');

var app = express();

var server = app.listen(8080, "0.0.0.0");

app.use(express.static('public'));

var io = require('socket.io').listen(server);   //socket(server);

var worldsData = {};
var worldIds = [];

console.log("server started");

//Server Config Options
var numOfAstroids = 4000;
var numOfPlanets = 50;
var numOfMoons = 200;
var numOfSuns = 10;
var numOfCrystals = 100;
var gridSize = 15000;
var gridBoxScale = 200;
var spawnTries = 5;

var mineProductionRate = 2500;
var despawnProjectilesRate = 10;
var shieldHealRate = 1000;
var playerHealRate = 10000;
var projectileDespawnTime = 100;
var sunDamageRate = 1000;


var planetColors = ["#CB7C43", "#433F53", "#8C8070", "#94A6BF", "#9DC183", "#CC4D00"];
var numberOfWorlds = 10;

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
            continue;
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
            continue;
        }

        reptitions++

    } while (!positonAviable(size, position.x, position.y, hittableObjectsRef));

    var astroid = new SpaceMatter(position.x, position.y, size, color, health, drops, type, id);
    
    hittableObjectsRef.push(astroid);
    worldObjectsRef.astroids.push(astroid);

    return astroid;
}

function startWorlds(){ 

    for(var i = 0; i < numberOfWorlds; i++){

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
    }

}

function generateWorld(){

    var generatedWorldObjects = {
        planets: [],
        astroids: []
    };

    var generatedHittableObjects = [];


    for(var i = 0; i < numOfSuns; i++){

        var sunColors = ["#ffd13f", "#fffc70", "#ff7023", "#d6fff6"];

        var colorindex = getRndInteger(0, sunColors.length - 1);
        var color = sunColors[colorindex];
        var type = "sun";
        var size = getRndInteger(500, 700);
        var health = size * 2;

        var drops = {stardust: 1};
        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }
    for(var i = 0; i < numOfPlanets; i++){

        var colorindex = Math.round(getRndInteger(0, planetColors.length - 1));
        var color = planetColors[colorindex];
        var planetSize = getRndInteger(100, 300);
        var planetHealth = planetSize * 2;
        var drops = {astroidBits: Math.round(planetSize * 3), water: Math.round(planetSize * 2), earth: Math.round(planetSize * 2.2)};

        generatePlanet(planetSize, color, planetHealth, drops, generatedWorldObjects, generatedHittableObjects);
    }

    for(var i = 0; i < numOfAstroids; i++){

        var astroidSize = getRndInteger(10, 30);
        var astroidColor = getRandomGray();
        var astroidHealth = astroidSize * .2;
        var type = "astroid";
        var drops = {astroidBits: Math.round(astroidSize / 5), water: Math.round(astroidSize / 10)};

        generateSpaceMatter(astroidSize, astroidColor, astroidHealth, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfCrystals; i++){

        var crystalColors = ["#5b94ef", "#d957ed", "#f9f454", "#85f954"];

        var colorindex = getRndInteger(0, crystalColors.length - 1);
        var color = crystalColors[colorindex];
        var type = "crystal";
        var size = getRndInteger(10, 20);
        var health = size * 8;

        var drops = {crystal: 5};
        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    for(var i = 0; i < numOfMoons; i++){

        var moonColors = ["#929aa8", "#758196", "#758196", "#2d3c56"];

        var colorindex = getRndInteger(0, moonColors.length - 1);
        var color = moonColors[colorindex];
        var size = getRndInteger(50, 75);
        var health = size;
        var type = "moon";
        var drops = {astroidBits: Math.round(size * 1.2), water: Math.round(size / 2), iron: Math.round(size * 1.2)};

        generateSpaceMatter(size, color, health, drops, generatedWorldObjects, generatedHittableObjects, type);
        
    }

    console.log('world generation complete: /n', generatedWorldObjects.astroids.length, ' astroids spawned /n', generatedWorldObjects.planets.length, ' planets spawned');

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
    this.drops = {};

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

function Projectile(x, y, velocity, size, color, damage, worldId, id){
    this.x = x;
    this.y = y;
    this.size = size;
    this.vel = velocity;
    this.color = color;
    this.damage = damage;
    this.worldId = worldId;
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
            speed: 130,
            fireRate: 10,
            maxHealth: 20,
            damage: 1,
            radius: 10,
            turningSpeed: .1,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 5},
            speed: 120,
            fireRate: 11,
            maxHealth: 25,
            damage: 2,
            radius: 15,
            turningSpeed: .1,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 20},
            speed: 110,
            fireRate: 12,
            maxHealth: 35,
            damage: 3,
            radius: 20,
            turningSpeed: .09,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 50},
            speed: 100,
            fireRate: 13,
            maxHealth: 50,
            damage: 5,
            radius: 25,
            turningSpeed: .08,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 100, iron: 5},
            speed: 90,
            fireRate: 15,
            maxHealth: 75,
            damage: 8,
            radius: 30,
            turningSpeed: .07,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 300, iron: 10},
            speed: 80,
            fireRate: 18,
            maxHealth: 120,
            damage: 13,
            radius: 35,
            turningSpeed: .06,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 750, iron: 50},
            speed: 70,
            fireRate: 21,
            maxHealth: 200,
            damage: 21,
            radius: 40,
            turningSpeed: .05,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 1200, iron: 100},
            speed: 60,
            fireRate: 25,
            maxHealth: 350,
            damage: 34,
            radius: 45,
            turningSpeed: .04,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 2000, iron: 300},
            speed: 50,
            fireRate: 30,
            maxHealth: 600,
            damage: 55,
            radius: 50,
            turningSpeed: .03,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 5000, iron: 800},
            speed: 40,
            fireRate: 46,
            maxHealth: 600,
            damage: 55,
            radius: 55,
            turningSpeed: .02,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 7000, iron: 2500},
            speed: 30,
            fireRate: 52,
            maxHealth: 600,
            damage: 55,
            radius: 60,
            turningSpeed: .01,
            identifier: "spaceship"
        },
        {   
            costs: {astroidBits: 10000, iron: 5000},
            speed: 20,
            fireRate: 60,
            maxHealth: 600,
            damage: 55,
            radius: 65,
            turningSpeed: .009,
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
        costs: {iron: 50},
        baseSize: 50,
        projectileSpeed: 5,
        shootInterval: 100,
        identifier: "turret"
    },
    {
        costs: {iron: 250},
        projectileSpeed: 6,
        shootInterval: 95,
        identifier: "turret"
    },
    {
        costs: {iron: 2000},
        projectileSpeed: 10,
        shootInterval: 82,
        identifier: "turret"
    },
    {
        costs: {iron: 10000},
        projectileSpeed: 10,
        shootInterval: 70,
        identifier: "turret"
    },
    {
        costs: {iron: 50000},
        projectileSpeed: 10,
        shootInterval: 50,
        identifier: "turret"
    },
    {
        costs: {iron: 250000},
        projectileSpeed: 10,
        shootInterval: 20,
        identifier: "turret"
    }
    ],
    mine: [
        {
            costs: {astroidBits: 20},
            ammount: 1,
            identifier: "mine"
        },
        {
            costs: {astroidBits: 60},
            ammount: 2,
            identifier: "mine"
        } ,
        {
            costs:  {astroidBits: 200},
            ammount: 3,
            identifier: "mine"
        },
        {
            costs: {astroidBits: 750},
            ammount: 5,
            identifier: "mine"
        },
        {
            costs: {astroidBits: 3000},
            ammount: 8,
            identifier: "mine"
        } ,
        {
            costs: {astroidBits: 12000},
            ammount: 13,
            identifier: "mine"
        }  ,
        {
            costs: {astroidBits: 48000},
            ammount: 21,
            identifier: "mine"
        },
        {
            costs: {astroidBits: 250000},
            ammount: 34,
            identifier: "mine"
        },
        {
            costs: {astroidBits: 750000},
            ammount: 55,
            identifier: "mine"
        }  
    ],
    shield: [
    {
        costs: {water: 20},
        maxHealth: 300,
        identifier: "shield"
    },
    {
        costs: {water: 300},
        maxHealth: 1000,
        identifier: "shield"
    },
    {
        costs: {water: 5000},
        maxHealth: 5000,
        identifier: "shield"
    },
    {
        costs: {water: 20000},
        maxHealth: 10000,
        identifier: "shield"
    },
    {
        costs: {water: 100000},
        maxHealth: 50000,
        identifier: "shield"
    },
    ]
}

io.sockets.on('connection', newConnetcion);

function newConnetcion(socket){
    var worldId = worldIds[getRndInteger(0, numberOfWorlds - 1)];

    playerObject = {id: socket.id, worldId: worldId};

    socket.join(worldId);
    socket.emit("setupLocalWorld", newPlayerData(worldId));
    syncDamage(worldId);
    socket.emit("showWorld");

    worldsData[worldId].lobbyClients.push(playerObject);

    socket.on("playerStartGame", function(data){

        data.username = data.username .slice(0, 15);

        player = new Player(0, 0, 0, 0, socket.id, data.worldId); 

        worldsData[worldId].clients.push(player)

        var lobbyClinent = findObjectWithId(worldsData[worldId].lobbyClients, socket.id)

        if(lobbyClinent)
            worldsData[worldId].lobbyClients.splice(lobbyClinent.index, 1);

        player.username = data.username;
        worldsData[worldId].hittableObjects.push(player);

        socket.emit("setupLocalWorld", newPlayerData(worldId));

        socket.broadcast.to(worldId).emit('newPlayer', player);
        socket.emit("newPlayerStart", player);

    
        console.log('\x1b[36m%s\x1b[0m', "player connected  : ", socket.id , " clients connected: ", worldsData[worldId].clients.length);

        syncDamage(worldId);
    });


    socket.on('damage', function(data){

        var projectile = findObjectWithId(worldsData[data.worldId].projectiles, data.projectileId);
        if(!projectile){
            console.log('\x1b[31m%s\x1b[0m', "[ERROR]","projectile not found.");
            return;
        }

        var damageDealt = projectile.object.damage;

        damageObject(data.worldId, data.id, data.senderId, damageDealt)
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
        worldsData[data.worldId].projectiles.push(new Projectile(data.x, data.y, data.vel, data.size, data.color, shooter.object.damage, data.worldId, data.id));

        console.log('\x1b[33m%s\x1b[0m', "spawned projectile with id: ", data.id, " total: ", worldsData[data.worldId].projectiles.length);
    });

    socket.on('requestSpawnStructure', function(data){

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
                io.sockets.connected[data.ownerId].emit("unsuccessfulUpgrade", "Place landing pad first");
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

            if(planet.hasMaxStructure(data.type, maxPlanetObjects[data.type]))
            {
                io.sockets.connected[data.ownerId].emit("unsuccessfulUpgrade", "Planet aready has max " + data.type + 's');
                return;
            }
    
            if(planet){
                structure = new Structure(planet.id, data.x, data.y, data.rotation, data.type, data.ownerId, 0, data.worldId, data.id);
                planet.structures.push(structure);
            }
            else{
                console.log("Planet not found. Failed to build structure on server");
                return;
            }
    
            //io.sockets.connected[data.ownerId].emit("spawnStructure", data);
            socket.emit("spawnStructure", data);
            data.isFacade = true;
            socket.broadcast.to(data.worldId).emit("spawnStructure", data);
    
            if(structureUpgrades[data.type]){
    
                var upgrades = structureUpgrades[data.type][structure.level];
                
    
                if(data.type == "shield"){
                    var shieldRadius = planet.radius + 100;    
                    var newHittableObj = {x: data.x, y: data.y, radius: shieldRadius, health: upgrades.maxHealth, maxHealth: upgrades.maxHealth, id: data.id, structure: true, planet: planet};
                    worldsData[data.worldId].hittableObjects.push(newHittableObj);
                    syncDamage(data.worldId, [data.id]);
                }
    
                if(data.type == "mine"){
                    structure.ammount = upgrades.ammount;
                }
            }
    
            var owner = findObjectWithId(worldsData[data.worldId].clients, data.ownerId).object;
            owner.structures.push(structure);
    
            console.log('\x1b[37m%s\x1b[0m', "spawned structure on planet with id: ", data.planetId, " type: ", data.type, " id:", data.id, " owner: ", data.ownerId);
            
        }
        else
            io.sockets.connected[data.ownerId].emit("unsuccessfulUpgrade", "Not enough resources");
        

    });

    socket.on('projDestroy', function(data){
        socket.broadcast.to(data.worldId).emit('destroyProjectile', data);
        var hitProj = findObjectWithId(worldsData[data.worldId].projectiles, data.id);
        if(hitProj)
            worldsData[data.worldId].projectiles.splice(hitProj.index, 1);
    });

    socket.on('upgradeInfo', function(data){

        var returnInfo = {
            structureUpgrades: structureUpgrades,
            playerUpgrades: playerUpgrades
        }

        socket.emit("upgradeInfo", returnInfo);

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
            io.sockets.connected[data.senderId].emit("unsuccessfulUpgrade", "Not enough resources");
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

    socket.on('disconnect', function (data) {
        
        var worldId;

        allClients(true).forEach(client => {
            if(client.id == socket.id)
                worldId = client.worldId;
        });

        disconnectPlayer(socket.id, socket, worldId);
    });
}

function disconnectPlayer(id, socket, worldId){

    if(!worldIds.contains(worldId)){
        console.log('\x1b[31m%s\x1b[0m', "[ERROR]", "world Id not accounted for on server. most likely old session.");
        return;
    }

    var client = findObjectWithId(worldsData[worldId].clients.concat(worldsData[worldId].lobbyClients), id);
    var structureIds = [];

    if(!client){
        console.log("player not accounted for disconnected with id: ", id);
        return;
    }

    if(client.object.structures){
        client.object.structures.forEach(structure => {
            structureIds.push(structure.id);

            var planet = findObjectWithId(worldsData[worldId].worldObjects.planets, structure.planetId).object;
            var planetStructure = findObjectWithId(planet.structures, structure.id);

            if(planetStructure)
                planet.structures.splice(planetStructure.index, 1);
        });
    }

    worldsData[worldId].worldObjects.planets.forEach(planet => {
        if(planet.occupiedBy == client.object.id)
            planet.occupiedBy = null;
    });

    var data = {
        clinetId: client.object.id,
        structureIds: structureIds
    }
    
    if(id != socket.id)
        io.sockets.connected[id].broadcast.to(worldId).emit('playerExited', data);
    else
        socket.broadcast.to(worldId).emit('playerExited', data);

    console.log('\x1b[31m%s\x1b[0m', "player disconected: ", client.object.id,  " clients connected: ", worldsData[worldId].clients.length);

    var hittableClient = findObjectWithId(worldsData[worldId].hittableObjects, id);

    if(hittableClient){
        worldsData[worldId].hittableObjects.splice(hittableClient.index, 1);
    }

    worldsData[worldId].clients.splice(client.index, 1);
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

        if(target.object.type == 'sun'){
            if(target.object.drops && senderId)
                itemDropped(target.object.drops, senderId, worldId); 

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

                //If the thing killed was a player
                var possibleClient = findObjectWithId(worldsData[worldId].clients, target.object.id);

                 //If the thing killed was a planet
                var possiblePlanet = findObjectWithId(worldWorldObjects.planets, target.object.id);

                 //If the thing killed was space matter
                var possibleSpaceMatter = findObjectWithId(worldWorldObjects.astroids, target.object.id);

                if(possibleClient){
                    disconnectPlayer(target.object.id, socket, worldId);

                    if(!target.object.drops["gem"])
                        target.object.drops["gem"] = 1;
                    
                    playerObject = {id: target.object.id};
                    worldsData[worldId].lobbyClients.push(playerObject);
                    io.sockets.connected[target.object.id].emit("respawn");
                }
                else{

                    var newObject;

                    if(possiblePlanet){
                        var color = possiblePlanet.object.color;
                        var radius = possiblePlanet.object.radius
                        var health = possiblePlanet.object.maxHealth;
                        var drops = possiblePlanet.drops;

                        worldHittableObjects.splice(target.index, 1);
                        worldWorldObjects.planets.splice(possiblePlanet.index, 1);
                        newObject = generatePlanet(radius, color, health, drops, worldWorldObjects, worldHittableObjects, target.object.id);
                        newObject.type = "planet";
                    }
                    else if(possibleSpaceMatter){
                        var radius = possibleSpaceMatter.object.radius;
                        var color = possibleSpaceMatter.object.color;
                        var health = possibleSpaceMatter.object.maxHealth;
                        var drops = possibleSpaceMatter.object.drops;
                        var type = possibleSpaceMatter.object.type;

                        worldHittableObjects.splice(target.index, 1);
                        worldWorldObjects.astroids.splice(possibleSpaceMatter.index, 1);
                        newObject = generateSpaceMatter(radius, color, health, drops, worldWorldObjects, worldHittableObjects, type, target.object.id);
                    }
                    else{
                        console.log("object type of damaged object is not accounted for on the server");
                        return;
                    }

                    if(newObject){
                        var changedWorldObject = 
                        {
                            id: target.object.id,
                            newObject: newObject
                        }
    
                        io.to(worldId).emit('newWorldObjectSync', changedWorldObject);
                    }
                }
            }

            if(target.object.drops && senderId)
                itemDropped(target.object.drops, senderId, worldId); 
        }

        syncDamage(worldId, [target.object.id]);
    }
    else
        console.log(id, " is not accounted for on the sever");
}

function itemDropped(drops, playerRecivingId, worldId){
    io.sockets.connected[playerRecivingId].emit("items", {drops});

    var player = findObjectWithId(worldsData[worldId].clients, playerRecivingId).object;
    for (var drop in drops) {
        if (drops.hasOwnProperty(drop)) {
            if(player.drops[drop])
                player.drops[drop] += drops[drop];
            else
                player.drops[drop] = drops[drop];
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
                    id: changedObject.object.id
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
                id: worldHittableObjects[i].id
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

        worldsData[client.worldId].worldObjects.astroids.forEach(matter => {
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

setInterval(playerHeal, playerHealRate);
function playerHeal()
{
    var syncWorldIds = {};

    allClients().forEach(client => {

        var player = findObjectWithId(worldsData[client.worldId].hittableObjects, client.id).object;

        var addAmmount = player.maxHealth / 15;

        if(player.health != player.maxHealth){
            if(player.health + addAmmount < player.maxHealth)
                player.health += addAmmount;
            else
                player.health = player.maxHealth;

            if(syncWorldIds[player.worldId])
                syncWorldIds[player.worldId].push(player.id)
            else
                syncWorldIds[player.worldId] = [player.id];
        }
        
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


            var addAmmount = shield.maxHealth / 25;

            if(shield.health != shield.maxHealth){
                if(shield.health + addAmmount < shield.maxHealth)
                    shield.health += addAmmount;
                else
                    shield.health = shield.maxHealth;


                if(syncWorldIds[structure.worldId])
                    syncWorldIds[structure.worldId].push(structure.id)
                else
                    syncWorldIds[structure.worldId] = [structure.id];

                syncWorldIds.push(structure.worldId);
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
            if(projectile.time > projectileDespawnTime){
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
    var mineProduceItem = 'iron';

    allClients().forEach(client => {

        var mineData = [];
    
        client.structures.forEach(structure => {
            if(structure.type == "mine"){
                mineData.push({id: structure.id, ammount: structure.ammount, item: mineProduceItem});
                
                if(client.drops[mineProduceItem])
                    client.drops[mineProduceItem] += structure.ammount;
                else
                    client.drops[mineProduceItem] = structure.ammount;
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

startWorlds();