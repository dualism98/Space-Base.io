var fauxCliendIds = [];
var targetNumberOfClients = 24;

function updateFauxClients() {
    for (let i = 0; i < worldIds.length; i++) {
        const worldId = worldIds[i];

        var world = worldsData[worldId];
        var clients = worldsData[worldId].clients;

        if(players < targetNumberOfClients && Math.random > 0.75)
        {
            spawnNewClient(worldId);
        }


        var randomId = fauxCliendIds[Math.round(Math.random() * fauxCliendIds.length)];
        var randClient = worldsData[worldId].clients[randomId];

        var randVal = Math.random();

        if(randVal > 0.75)
        {
            //Nothing happens
            return;
        }
        if(randVal > 0.5)
        {
            //Client levels up :)
            randClient.level++;

            var upgradeData = {
                upgrade: {},
                id: randClient.id,
                costs: {},
                playerId: randClient.id,
                level: randClient.level
            }
    
            io.to(worldId).emit('upgradeSync', upgradeData);
        }
        else if (randVal > 0.25)
        {
            //Client dies :( ... but respawns!

        }
        else
        {
            //Client dies for good :()

        }

        fauxCliendIds.forEach(id => {
            var client = worldsData[worldId].clients[id];
            client.timeAlive++;
        });
    }
}


function spawnNewClient(worldId) {
    var clientId = uniqueId();
    var player = new Player(-1000, -1000, 0, 9, "", worldId); 
    player.faux = true;
    player.timeAlive = 0;

    worldsData[worldId].clients[clientId] = player;
    fauxCliendIds.push(clientId);
}

