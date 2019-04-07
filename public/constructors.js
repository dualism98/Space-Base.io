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
    this.lastPowered = null;

    var healthBarWidth = 100;

    this.stripeVars = null;

    this.draw = function(){
        c.beginPath();
        c.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false);
        c.fillStyle = this.color;
        c.fill();
        
        c.beginPath();
        c.arc(this.x, this.y, this.radius - 20, 0, Math.PI * 2, false);
        c.fillStyle = shadeColorHex(this.color, 10);
        c.fill();

        var height = this.radius - this.stripeVars.ofsetY;
        var width = Math.sqrt(-8 * height * (height / 2 - this.radius)); 

        var start = {x: -width / 2, y: this.stripeVars.ofsetY};
        var end = {x: width / 2, y: this.stripeVars.ofsetY};

        var angle = Math.PI / 2 - Math.acos(this.stripeVars.ofsetY / this.radius);

        c.fillStyle = shadeColorHex(this.color, this.stripeVars.colorHex);
        c.globalAlpha = .2;
        
        c.save();
        c.translate(this.x, this.y);
        c.rotate(this.stripeVars.rotation);
        c.beginPath();
        c.arc(0, 0, this.radius, angle, Math.PI - angle, false);
        c.wavy(start, end, this.stripeVars.frequency, 12, 4);
        c.fill();
        c.restore();
        c.globalAlpha = 1;

    }
    this.update = function(){
        var pos = cordsToScreenPos(this.coordX, this.coordY);
        this.x = pos.x;
        this.y = pos.y

        var powerAvailable = 0;
        var powerNeeded = 0;

        for (var i = 0; i < this.structures.length; i++) {
            var structure = this.structures[i];
            
            if(structure.type == "landingPad")
                continue;

            if(structure.type == "electricity")
                powerAvailable += structure.power;
            else
                powerNeeded += structure.level + 1;
        }

        this.powered = powerAvailable >= powerNeeded && powerNeeded != 0;

        if(this.lastPowered != this.powered)
        {
            this.lastPowered = this.powered;

            var sendData = {on: this.powered, worldId: worldId, planetId: this.id};

            var mines = false;

            for (var i = 0; i < this.structures.length; i++) {
                var structure = this.structures[i];
                
                if(structure.type == "mine")
                {
                    mines = true;
                    break;
                }   
            }

            if(mines || this.shield)
                socket.emit('electricity', sendData);
        }

        if(this.stripeVars == null)
        {
            this.stripeVars = {};
            this.stripeVars.frequency = Math.floor(Math.random() * this.radius / 20) + .004 * this.radius;  
            this.stripeVars.rotation = Math.floor(Math.random() * Math.PI * 2);
            this.stripeVars.ofsetY = Math.floor(Math.random() * 100) - 50;
            this.stripeVars.colorHex = Math.floor(Math.random() * 60) + 20;
        }

        this.draw();
        this.updateStructures();

        if(!this.powered && this.owner == clientId)
        {
            var powerlessStructures = this.structures;

            powerlessStructures.forEach(structure => {

                if(structure.type == "landingPad" || structure.type == "electricity" || structure.type == "spawner")
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
            displayBar(this.x - healthBarWidth / 2, this.y - this.radius - 50, healthBarWidth, 20, this.health / this.maxHealth, "#88ff60");
    }

    this.updateStructures = function(){

        var data = {turrets: [], worldId:worldId};

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
                else if((this.structures[i].isFacade != null && this.structures[i].isFacade) || this.structures[i].isFacade == undefined)
                    this.structures[i].update();
            }

            if(this.powered && this.structures[i].type == "turret" && turretManualMode && !this.structures[i].isFacade)
                data.turrets.push({id: this.structures[i].id, rot: this.structures[i].shootRotation});
        } 

        if(data.turrets.length > 0)
        {
            if(turretRotSendTimer.time >= turretRotSendTimer.delay)
            {
                turretRotSendTimer.time = 0;
                socket.emit("turretRot", data);
            }
            else
                turretRotSendTimer.time++;
        }
            
    }

    this.addStructure = function (planet, x, y, rotation, type, level, isFacade, ownerId, id){
        var addedStructure;

        if(!isFacade && checklist.landingPadDesc.isActive && !checklist.landingPadDesc.done)
            checklist.landingPadDesc.done = true;

        var spawnerType = type;

        if(type.substring(0,7) == "spawner")
            type = "spawner";

        switch(type)
        {
            case "electricity":
                addedStructure = new Electricity(planet, x, y, rotation, level, ownerId, id);
            break;
            case "satellite":
                addedStructure = new Satellite(planet, x, y, rotation, level, ownerId, id);
            break;
            case "mine":
                addedStructure = new Mine(planet, x, y, rotation, level, ownerId, id);

                if(!isFacade)
                    producingMines.push(addedStructure);
            break;
            case "spawner":
                addedStructure = new Spawner(planet, x, y, rotation, level, spawnerType, ownerId, id);
            break;
            case "turret":
                addedStructure = new Turret(planet, x, y, rotation, level, isFacade, ownerId, id);
            break;
            case "shield":
                addedStructure = new Shield(planet, x, y, rotation, level, ownerId, id);
                this.shield = addedStructure;

                if(!isFacade)
                    friendlyObjectIds.push(id);
            break;
            case "landingPad":
                addedStructure = new LandingPad(planet, this.radius - 100, id);
                this.landingPad = addedStructure
                this.owner = ownerId;
                
                if(!isFacade){
                    friendlyObjectIds.push(planet.id);
                    ownedPlanets[planet.id] = planet;
                }
            break;
        }

        if(addedStructure)
        {
            var data = {
                upgrade: structureUpgrades[type][level],
                id: id,
                costs: {},
                playerId: ownerId,
                level: level
            }

            if(!isFacade && !planet.powered)
                socket.emit('electricity', {on: false, worldId: worldId, planetId: planet.id});

            this.structures.push(addedStructure);
            allStructures = getAllStructures();
            upgradeSync(data);
        }
            

    }
}

function Shield(planet, x, y, rotation, level, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.level = level;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "shield";

    this.color = "#287aff"

    this.coordX = x;
    this.coordY = y;

    this.health;
    this.maxHealth;

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

            if(this.health < this.maxHealth)
                displayBar(this.planet.x - healthBarWidth / 2, this.planet.y - this.planet.radius - 150, healthBarWidth, 20, this.health / this.maxHealth, this.color);
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
function Spawner(planet, x, y, rotation, level, type, ownerId, id){
    this.planet = planet;
    this.x;
    this.y;
    this.rotation = rotation;
    this.size = 50;
    this.id = id;
    this.ownerId = ownerId;
    this.type = "spawner";
    this.spawnerType = type;

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
        ctx.drawImage(getImage(this.spawnerType + this.level), -this.size / 2, -this.size / 2, this.size, this.size);
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

    this.rotControlled = false;
    this.targetServerRot = 0;
    this.lastTargetServerRot = 0;
    this.rotLerpAmount = 00;
    this.rotLerpTime = 20;
    this.rotWatcher = 0;

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
            if(!this.rotControlled)
                this.shootRotation = 0;

            //Draw Head
            if(this.rotControlled)
            {
                if(this.rotWatcher != this.targetServerRot)
                {
                    this.lastTargetServerRot = this.rotWatcher;
                    this.rotWatcher = this.targetServerRot;

                    this.rotLerpTime = this.rotLerpAmount;
                    this.rotLerpAmount = 0;
                }
                
                if(this.rotLerpAmount <= this.rotLerpTime)
                    this.shootRotation = this.lastTargetServerRot + (this.targetServerRot - this.lastTargetServerRot) * this.rotLerpAmount / this.rotLerpTime;
                else
                    this.shootRotation = this.targetServerRot;

                this.rotLerpAmount++;

                this.headRotation = this.shootRotation * 180 / Math.PI;
            }
            else if(turretManualMode && !this.isFacade)
            {
                this.shootRotation = Math.atan2(mouse.y - headY, mouse.x - headX);
                this.headRotation = this.shootRotation * 180 / Math.PI;
            }
            else if(this.target)
            {
                var playerPos;

                if(this.target.id != clientId && this.target.displayPos && this.target.displayPos.y)
                    playerPos = cordsToScreenPos(this.target.displayPos.x, this.target.displayPos.y);
                else
                    playerPos = cordsToScreenPos(this.target.coordX, this.target.coordY);

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
            ctx.strokeStyle = "#636363";
            ctx.lineWidth= 2;
            ctx.fillRect(-this.headLength / 2 + this.headLength / 4, -this.headWidth / 2, this.headLength, this.headWidth);
            ctx.strokeRect(-this.headLength / 2 + this.headLength / 4, -this.headWidth / 2, this.headLength, this.headWidth);
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
         if((this.target || turretManualMode) && !this.isFacade){
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

        for (var id in allPlayers) {
            if (allPlayers.hasOwnProperty(id)) {
            
                var player = allPlayers[id];

                if(player.id == ownerId || player.alpha < 1)
                    continue;

                if((player.id.substring(0,5) == "enemy") && playerItems["crown"] >= 1)
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
}

function Item(coordX, coordY, size, type, id) {
    this.speed = 10;
    this.x;
    this.y;
    this.type = type;
    this.id = id;
    this.size = size;

    this.targetRotation = 0;
    this.rotation = 0;

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

    var jumpDistance = 50000;

    this.update = function(){
        
        var coords = new Vector(this.coordX, this.coordY);
        var lastCoords = new Vector(this.lastCoordX, this.lastCoordY);
        this.displayPos = coords;

        if(this.coordChangeWatcher.x != coords.x || this.coordChangeWatcher.y != coords.y)
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
        }

        this.lerpAmount++;

        if(this.rotLerpAmount <= this.rotLerpTime)
            this.rotation = this.lastRot + (this.targetRotation - this.lastRot) * this.rotLerpAmount / this.rotLerpTime;
        else
            this.rotation = this.targetRotation;

        this.rotLerpAmount++;

        var pos = cordsToScreenPos(this.displayPos.x, this.displayPos.y);

        this.x = pos.x;
        this.y = pos.y;

        this.draw();
    }

    this.draw = function() {
     
        if(type == "crown")
        {
            c.globalAlpha = .5;
            c.fillStyle = "#48f442"
            c.shadowBlur = -1;
            c.shadowColor = "#48f442";
            c.beginPath();
            c.arc(this.x,this.y, this.size * 2, 0,2*Math.PI);
            c.fill(); 
            c.shadowBlur = 0;
        }
        
        c.globalAlpha = 1;
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.drawImage(getImage(this.type), -this.size, -this.size, this.size * 2, this.size * 2);
        c.rotate(-this.rotation);
        c.translate(-this.x, -this.y);
        

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

    this.projectileDeathCounter = {time: 0, limit: 200};

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

            if(this.projectileDeathCounter.time <= this.projectileDeathCounter.limit)
                this.projectileDeathCounter.time++
            else
            {
                if(projectiles.contains(this))
                {
                    projectiles.splice(projectiles.indexOf(this), 1);
                }
            }

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
                var isShield = allStructures[id];

                if(isShield && isShield.type == "shield" && !isShield.planet.powered)
                {
                    this.shieldIgnored = id;
                    continue;
                }

                if((hittableObj.id.substring(0,5) == "enemy" || hittableObj.id == "hiveObj") && playerItems["crown"] >= 1)
                    continue;

                if(this.isFriendly(hittableObj.id) || this.hitObjects.contains(hittableObj.id) || !hittableObj.active)
                    continue;

                var pos = cordsToScreenPos(hittableObj.x, hittableObj.y);
                var hitObject = {x: pos.x, y: pos.y, radius: hittableObj.radius};

                if(isCollidingCircles(this, hitObject)){

                    var hitWorldObject = findObjectWithId(allWorldObjects, id);

                    if(hitWorldObject && (hitWorldObject.object.id == "hive"))
                        continue;

                    var ignoreShield = false;

                    if(hitWorldObject && hitWorldObject.object.structures && this.shieldIgnored != null)
                    {
                        var possibleShield = findObjectWithId(hitWorldObject.object.structures, this.shieldIgnored);
                        
                        if(possibleShield)
                            ignoreShield = true;
                    }
                        
                    sendProjectileHit(this.id, id, this.coord.x, this.coord.y, ignoreShield);

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
                spikyBall(c, this.x, this.y, this.radius - 3, 20, 0, -Math.PI/2, .75);
                c.strokeStyle = this.color;
                c.fillStyle = shadeColorHex(this.color, 10);
                c.lineWidth = 3;
                c.fill();
                c.stroke();
            break;
            case "asteroid":
                c.fillStyle = shadeColorHex(this.color, 10);
                c.strokeStyle = this.color;
                c.lineWidth = 4;
                c.beginPath();
                c.arc(this.x, this.y, this.radius - 2, 0, Math.PI * 2, false);
                c.fill();
                c.stroke();
            break;
            case "dirtthing":

                c.fillStyle = "#72ce56";
                c.strokeStyle = "#a0f771"
                c.lineWidth = 2;
                c.beginPath();
                c.arc(this.x, this.y, this.radius - 1, 0, Math.PI * 2, false);
                c.fill();
                c.stroke();

                c.beginPath();
                c.fillStyle = shadeColorHex(this.color, 0);
                spikyBall(c, this.x, this.y, this.radius - 6, 10, 0, -Math.PI/2, .9);
                c.fill();
                // c.fillStyle = "#58a83f";
                // c.strokeStyle = "#72ce56";
                // c.lineWidth = 2;
                // c.beginPath();
                // c.arc(this.x, this.y, this.radius - 1, 0, Math.PI * 2, false);
                // c.fill();
                // c.stroke();

                // c.fillStyle = shadeColorHex(this.color, 0);
                // c.beginPath();
                // c.arc(this.x, this.y, this.radius - 10, 0, Math.PI * 2, false);
                // c.fill();
            break;
            case "scrapmetal":

                if(this.rotation == null)
                    this.rotation = Math.random();
                else
                    this.rotation += .001;

                c.translate(this.x, this.y);
                c.rotate(this.rotation);
                c.drawImage(getImage("scrapmetal" + this.color), -this.radius * .75, -this.radius * .75, this.radius * 1.5, this.radius * 1.5);
                c.rotate(-this.rotation);
                c.translate(-this.x, -this.y);

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
            case "hiveObj":
                c.drawImage(getImage('hive'), this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
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
function SpaceShip(x, y, maxHealth, health, level, radius, speed, turningSpeed, fireRate, projectileSpeed, numUpgrades, id){
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
    this.numUpgrades = numUpgrades;
    this.level = level;
    this.id = id;

    this.alpha = 1;

    this.turret;

    this.oxygenRemaining;
    this.oxygenVignetteFade = {i: 0, time: 200};
    this.oxygenBarBlink = {i: 0, time: 50, legnth: 20};

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

    this.statLevels = {
        speed: 0,
        fireRate: 0,
        maxHealth: 0,
        damage: 0
    }

    this.draw = function(){

        var mouseRad = Math.atan2(mouse.y - centerY, mouse.x - centerX) + 90 * Math.PI / 180;
        
        var rad = this.rotation + shortAngleDist(this.rotation, mouseRad) * this.turningSpeed;

        c.globalAlpha = this.alpha;
        c.translate(centerX, centerY);
        c.rotate(rad);
        c.drawImage(getImage('spaceShip' + this.level), -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.rotate(-rad);
        c.translate(-centerX, -centerY);
        c.globalAlpha = 1;
        this.rotation = rad;
    }
    this.update = function(){
        this.draw();

        // if(this.oxygen)
        //     this.doOxygen();

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

        this.oxygenDispBarBGColor = "#bababa";

        if(this.oxygenRemaining == null)
            this.oxygenRemaining = this.oxygen;
        else
        {
            if(!currentPlanet)
            {
                if(this.oxygenRemaining > 0)
                {
                    if(this.oxygenRemaining - 1 <= 0)
                        socket.emit("oxygen", {has: false, worldId: worldId});
                    
                    this.oxygenRemaining--;
                } 
                else
                {
                    if(this.oxygenBarBlink.i < this.oxygenBarBlink.time)
                        this.oxygenBarBlink.i++;
                    else if(this.oxygenBarBlink.i < this.oxygenBarBlink.time + this.oxygenBarBlink.legnth)
                    {
                        this.oxygenDispBarBGColor = "red";
                        this.oxygenBarBlink.i++;
                    }
                    else
                        this.oxygenBarBlink.i = 0;
                        
                    if(this.oxygenVignetteFade.i < this.oxygenVignetteFade.time)
                    {
                        $("#vignetteOverlay").css("opacity", this.oxygenVignetteFade.i / this.oxygenVignetteFade.time);
                        this.oxygenVignetteFade.i++;
                    }                        
                }
                
            }
            else
            {
                this.oxygenBarBlink.i = 0;

                if(this.oxygenRemaining == 0)
                    socket.emit("oxygen", {has: true, worldId: worldId});

                if (this.oxygenRemaining < this.oxygen)
                    this.oxygenRemaining += this.oxygen / 25;

                if(this.oxygenRemaining > this.oxygen)
                    this.oxygenRemaining = this.oxygen

                if(this.oxygenVignetteFade.i > 0){
                    $("#vignetteOverlay").css("opacity", this.oxygenVignetteFade.i / this.oxygenVignetteFade.time);
                    this.oxygenVignetteFade.i--;
                }
            } 
        }
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

    var jumpDistance = 50000;

    this.turret;

    this.image = null;

    this.isEnemy = this.id.substring(0,5) == "enemy";

    this.draw = function(){

        if(this.alpha <= 0)
            return;

        var healthBarWidth = 50;
        var testpos = cordsToScreenPos(this.lastCoordX, this.lastCoordY);
        var testpostarget = cordsToScreenPos(this.coordX, this.coordY);

        if(this.isEnemy)
            this.image = getImage('enemy' + this.username + this.level);
        else
        {
            this.image = getImage('spaceShip' + this.level);

            if(this.id == master.id)
                c.drawImage(getImage("crown"), this.x - this.radius / 4, this.y - this.radius - 30 - this.radius / 2, this.radius / 2, this.radius / 2);

            //Display username above person
            c.font = "20px Arial";
            c.fillStyle = "white";
            c.globalAlpha = .5;
            c.textAlign = "center"; 
            c.fillText(this.username, this.x, this.y - this.radius - 20);

            c.textAlign = "left"; 
            c.globalAlpha = 1;
        }

        c.globalAlpha = this.alpha;
        c.translate(this.x, this.y);
        c.rotate(this.rotation);
        c.drawImage(this.image, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
        c.rotate(-this.rotation);
        c.translate(-this.x, -this.y);

        if(this.health != this.maxHealth)
            displayBar(this.x - healthBarWidth / 2, this.y - (this.radius + 10), healthBarWidth, 5, this.health / this.maxHealth, "#36a52c");

    }
    this.update = function(){
        var coords = new Vector(this.coordX, this.coordY);
        var lastCoords = new Vector(this.lastCoordX, this.lastCoordY);
        this.displayPos = coords;

        if(this.coordChangeWatcher.x != coords.x || this.coordChangeWatcher.y != coords.y)
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
            //console.log("jumped");
            this.lastCoordX = coords.x;
            this.lastCoordY = coords.y
            this.displayPos = coords;
        }
        else if (this.lerpAmount <= this.lerpTime) {
            var t = Math.round(this.lerpAmount / this.lerpTime * 100) / 100;
            var subCoord = Vector.prototype.subtract(coords, lastCoords);
            this.displayPos = Vector.prototype.addition(lastCoords, new Vector(subCoord.x * t, subCoord.y * t));
        }

        this.lerpAmount++;

        if(this.rotLerpAmount <= this.rotLerpTime)
            this.rotation = this.lastRot + (this.targetRotation - this.lastRot) * this.rotLerpAmount / this.rotLerpTime;
        else
            this.rotation = this.targetRotation;

        this.rotLerpAmount++;

        var pos = cordsToScreenPos(this.displayPos.x, this.displayPos.y);

        this.x = pos.x;
        this.y = pos.y;

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
        c.drawImage(getImage("shop" + this.upgradeType), this.x - this.radius / 2, this.y - this.radius / 2, this.radius, this.radius); 

        if(this.isInRange){

            var size = windowHeight / scale / 20;

            if(!shopOpen.open)
            {
                c.font = size + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('p#openShop').text(), centerX, infoPosY() / scale);
                c.textAlign="left"; 
                c.globalAlpha = 1;
            }
            else{
                c.font = size + "px Arial";
                c.fillStyle = "white";
                c.globalAlpha = .2;
                c.textAlign="center"; 
                c.fillText($('p#closeShop').text(), centerX, infoPosY() / scale);
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