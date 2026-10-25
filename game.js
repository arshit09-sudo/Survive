"use strict";

const arenaBackground = new Image();
arenaBackground.src = "arena.png";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext('2d');

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const restartButton = document.getElementById("restartButton");
const pauseRestartButton = document.getElementById("pauseRestartButton");
const mainMenuButton = document.getElementById("mainMenuButton");
const soundButton = document.getElementById("soundButton");


const menuOverlay = document.getElementById("menuOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");


const healthFill = document.getElementById("healthFill");
const healthValue = document.getElementById("healthValue");
const knifeCount= document.getElementById("knifeCount");
const survivalTime = document.getElementById("survivalTime");
const killCount = document.getElementById("killCount");
const bestTime = document.getElementById("bestTime");
const gameOverBestTime = document.getElementById("gameOverBestTime");
const finalKills = document.getElementById("finalKills");
const toast = document.getElementById("toast");

// idea : will add a drop that will boost knife rotating speed


const ARENA_SCALE = Math.sqrt(10);

let worldWidth = 0;
let worldHeight = 0;
let cameraX = 0;
let cameraY = 0;

let width = 0;
let height = 0;
let lastFrame = 0;

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = rect.width;
    height = rect.height;

    worldWidth = width * ARENA_SCALE;
    worldHeight = height * ARENA_SCALE;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const keys = new Set();

let state = "menu";
let player;
let enemies = [];
let knives = [];
let particles = [];
let medkits = [];
let medkitSpawnTimer = 0;

let elapsed = 0;
let kills = 0;
let spawnTimer = 0;
let damageCooldown = 0;

let soundEnabled = true;
let audioContext = null;
let bestSeconds = 0;

try {
    bestSeconds = Number(localStorage.getItem("surviveBestTime")) || 0;
} catch {
    bestSeconds = 0;
}
bestTime.textContent = formatTime(bestSeconds);


function random(min, max) {
    return Math.random() * (max - min) + min;
}
function distance(a,b) {
    return Math.hypot(a.x - b.x, a.y-b.y);
}

function distanceToSegment(pointX, pointY, startX, startY, endX, endY){
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;

    const projection = Math.max(
        0,
        Math.min(
            1,
            ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / lengthSquared
        )
    );

    const closestX = startX + projection * segmentX;
    const closestY = startY + projection * segmentY;
    return Math.hypot(pointX - closestX, pointY - closestY);
}
function formatTime(seconds) {
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;

    return (
        String(minutes).padStart(2, "0") +
         ":" +
        String(secs).padStart(2, "0")
         );
}

function showToast(message) {
    toast.textContent = message;
}

// will continue audio from here v

function playsound(frequency = 440 , duration = 0.06) {
    if (!soundEnabled) return;

    try{
        audioContext ??= new AudioContext();
        
        if (audioContext.state === "suspended"){
            audioContext.resume();
        }
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = frequency;

        gain.gain.setValueAtTime(0.045, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioContext.currentTime + duration
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
    } catch {

    }
}

soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    soundButton.textContent = soundEnabled
       ? "SOUND ON"
       : "SOUND OFF";
       soundButton.setAttribute("aria-pressed", String(soundEnabled));

       if (soundEnabled) playsound(660);
});

// new game ke liye 

function resetGame() {
    player = {
        x: worldWidth / 2,
        y: worldHeight / 2,
        radius: 12,
        speed: 220,
        health: 100,
        maxHealth: 100
    };

    updateCamera();

    enemies = [];
    knives = [];
    particles = [];
    medkits = [];
    medkitSpawnTimer = random(15, 35);

    elapsed = 0;
    kills = 0;
    spawnTimer = 0.8;
    damageCooldown = 0;

    for (let i = 0 ; i < 3; i++) {
        knives.push({
            angle: (Math.PI * 2 * i) / 3,
            radius: 42,
            damage: 1,
            hitCooldowns: new Map()
        });
    }
    updateHUD();
}

// yaha se game controls 

function startGame() {
    resetGame();

    state = "playing";

    menuOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");

    showToast("SURVIVE");
    lastFrame = performance.now();
}

function pauseGame() {
    if (state !== "playing") return;

    state = "paused";
    pauseOverlay.classList.remove("hidden");
}

function resumeGame() {
    if (state !== "paused") return;

    state = "playing";
    pauseOverlay.classList.add("hidden");
    lastFrame = performance.now();
}

function returnToMenu() {
    state = "menu";

    pauseOverlay.classList.add("hidden");
    gameOverOverlay.classList.add("hidden");
    menuOverlay.classList.remove("hidden");

    showToast("");
}

function endGame() {
if (state !== "playing") return;

state = "gameover";

finalKills.textContent = kills;

if (elapsed > bestSeconds) {
    bestSeconds = Math.floor(elapsed);

    try {
        localStorage.setItem("surviveBestTime", bestSeconds);
    } catch {

    }
}

bestTime.textContent = formatTime(bestSeconds);
gameOverBestTime.textContent = formatTime(bestSeconds);

gameOverOverlay.classList.remove("hidden");

playsound(120, 0.25);
}

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
restartButton.addEventListener("click", startGame);
mainMenuButton.addEventListener("click", returnToMenu);
pauseRestartButton.addEventListener("click", startGame)

window.addEventListener("keydown", event => {
    const key = event.key.toLowerCase();

    if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "]
           .includes(key)
    ){
        event.preventDefault();
    }
    keys.add(key);

    if (key === "escape" || key === "p") {
        if (state === "playing") pauseGame();
        else if (state === "paused") resumeGame();
    }
});

window.addEventListener("keyup", event => {
    keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
    keys.clear();
 
    if (state === "playing") pauseGame();
});

//yaha monster banaunga 

function spawnEnemy(){
 const side = Math.floor(Math.random() * 4);

 let x;
 let y;

 if (side === 0){
    x = random(cameraX, cameraX + width);
    y = Math.max(0, cameraY -20);
 } else if (side === 1){
    x = Math.min(worldWidth, cameraX + width + 20);
    y = random(cameraY, cameraY + height);
 } else if (side === 2) {
    x = random(cameraX, cameraX + width);
    y = Math.min(worldHeight, cameraY + height +20);
 } else {
    x = Math.max(0, cameraX - 20);
    y = random(cameraY, cameraY + height);
 }


 enemies.push({
    x,
    y,
    radius: random(9, 14),
    speed: random(42, 68) + Math.min(elapsed * 0.35, 35),
    health: 2,
    attackCooldown: 0
 });
}

function spawnMedkit(){
    if (medkits.length >= 3) return;

    medkits.push({
        x: random(30, worldWidth - 30),
        y: random(30, worldHeight -30),
        pulse: 0
    });
}

function updateMedKits(dt) {
    medkitSpawnTimer -= dt;

    if (medkitSpawnTimer <= 0 ){
        spawnMedkit();
        medkitSpawnTimer = random(15, 35);
    }

    for (let i = medkits.length -1; i >=0; i--) {
        const medKit = medkits[i];
        medKit.pulse += dt;

        const touching = distance(player, medKit) < player.radius +14;
        const needsHealth = player.health < player.maxHealth;

        if (touching && needsHealth) {
            player.health = Math.min(player.maxHealth, player.health +35);
            medkits.splice(i, 1);

            createParticles(medKit.x, medKit.y, 12, "#71ff9b");
            showToast("+35 HEALTH");
            playsound(700, 0.08);
        }
    }
}

function createParticles(x, y, amount = 7, color = "#ff5687") {
    for (let i = 0; i < amount; i++) {
        const angle = random(0, Math.PI * 2);
        const speed = random(35,125);
        const life = random(0.2, 0.5);

        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life,
            maxLife: life,
            color
        });
    }
}  
// hamara update hoga idhar

function updatePlayer(dt) {
    let dx = 0;
    let dy = 0;

    if (keys.has("w") || keys.has("arrowup")) dy--;
    if (keys.has("s") || keys.has("arrowdown")) dy++;
    if (keys.has("a") || keys.has("arrowleft")) dx--;
    if (keys.has("d") || keys.has("arrowright")) dx++;

    const length = Math.hypot(dx, dy);

    if (length > 0) {
        dx /= length;
        dy /= length;
    }

    player.x += dx * player.speed * dt;
    player.y += dy * player.speed * dt;
    
    player.x = Math.max(
        player.radius,
        Math.min(worldWidth - player.radius, player.x)

    );
    player.y = Math.max(
        player.radius,
        Math.min(worldHeight - player.radius, player.y)
    );
}

function updateCamera() {
    if (!player) return;

    cameraX = Math.max(
        0,
        Math.min(worldWidth -width, player.x - width / 2)
    );

    cameraY = Math.max(
        0,
        Math.min(worldHeight - height, player.y - height /2)
    );
}


// chaku

function updateKnives(dt) {
    for ( const knife of knives) {
        knife.angle += dt * 2.8;
        
        knife.x = player.x + Math.cos(knife.angle) * knife.radius;
        knife.y = player.y + Math.sin(knife.angle) * knife.radius;

        const rodAngle = knife.angle + Math.PI / 1.75;

        const startX = knife.x + Math.sin(rodAngle) * 20;
        const StartY = knife.y - Math.cos(rodAngle) * 20;

        const endX = knife.x - Math.sin(rodAngle) * 20;
        const endY = knife.y + Math.cos(rodAngle) * 20;

        for (const enemy of enemies) {
            const id = enemy;

            const cooldown = knife.hitCooldowns.get(id) || 0;

            if(cooldown > 0) {
                knife.hitCooldowns.set(id, cooldown - dt);
                continue;
            }
// chaku ki collision ka radius
          if ( 
            enemy.health > 0 &&
            distanceToSegment(
                enemy.x,
                enemy.y,
                startX,
                StartY,
                endX,
                endY,
            )< enemy.radius +3
          ){
            enemy.health -= knife.damage;
            knife.hitCooldowns.set(id, 0.3);

            createParticles(enemy.x, enemy.y, 10);
            playsound(520, 0.035);
            if (enemy.health <= 0) {
                createParticles(enemy.x, enemy.y, 10);
                kills++;
                showToast("ENEMY ELIMINATED");

                if (medkits.length < 6 && Math.random() < 0.08) {
                    medkits.push({
                        x:enemy.x,
                        y: enemy.y,
                        pulse: 0
                    });
                }
            }
          }
        }
    }

    enemies = enemies.filter(enemy => enemy.health > 0);

    for (const knife of knives) {
        for (const enemy of knife.hitCooldowns.keys()) {
            if (!enemies.includes(enemy)) {
                knife.hitCooldowns.delete(enemy);
            }
        }
    }
}

// enemy ka update kaise hoga

function updateEnemies(dt) {
    damageCooldown = Math.max(0, damageCooldown - dt);

    for (const enemy of enemies) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;

        enemy.x += (dx / length) * enemy.speed * dt;
        enemy.y += (dy / length) * enemy.speed * dt;

        if (
            distance(player, enemy) <
            player.radius + enemy.radius
        ){
            if (damageCooldown <= 0) {
                player.health -= 12;
                damageCooldown = 0.65;

                createParticles(
                    player.x,
                    player.y,
                    6,
                    "#ff5687"
                );

                playsound(180, 0.08);

                if(player.health <= 0) {
                    player.health = 0;
                    updateHUD();
                    endGame();
                    return;
                }
            }
        }
    }
}


function updateParticles(dt) {
    for (const particle of particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        particle.vx *= Math.max(0, 1 -2 * dt);
        particle.vy *= Math.max(0, 1-2 * dt);

        particle.life -= dt;
    }
    particles = particles.filter(particle => particle.life > 0);
}

// hud ki bari

function updateHUD() {
    healthValue.textContent = Math.ceil(player.health);

    healthFill.style.width = 
    `${(player.health / player.maxHealth) * 100}%`;

    healthFill.style.background = 
    player.health <= 30 ? "#ff5687" : "#55f1e2";

    knifeCount.textContent = knives.length;
    survivalTime.textContent = formatTime(elapsed);
    killCount.textContent = kills;
}

// game update

function update(dt) {
    if (state !== "playing") return;

    elapsed +=dt;
    spawnTimer -= dt;

    if (spawnTimer <=0) {
        spawnEnemy();
        spawnTimer= Math.max(0.35, 1.3 - elapsed * 0.008);
    }

    updatePlayer(dt);
    updateCamera();
    updateKnives(dt);
    updateEnemies(dt);
    updateParticles(dt);
    updateMedKits(dt);
    updateHUD();
} 

// Arena

function drawArena() {
    ctx.fillStyle = "#0a1020";
    ctx.fillRect(0, 0, worldWidth, worldHeight);

    if (arenaBackground.complete && arenaBackground.naturalWidth > 0 ) {
         
            const pattern = ctx.createPattern(arenaBackground, "repeat"); 

            if (pattern) {
                ctx.fillStyle = pattern;
                ctx.fillRect(0, 0, worldWidth, worldHeight);
            }
    }

    ctx.strokeStyle = "#55f1e2";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, worldWidth, worldHeight);
}


//draw player knifes and enemies 

function drawPlayer() {
    if (!player) return;
    ctx.save();

    ctx.shadowColor = "#55f1e2";
    ctx.shadowBlur = 22;

    ctx.fillStyle = "#55f1e2"
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    ctx.fillStyle = "#08131b";
    ctx.beginPath();
    ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
//chaku dikhega kitna bada
function drawKnives() {
    for (const knife of knives) {
        ctx.save();

        ctx.translate(knife.x, knife.y);
        ctx.rotate(knife.angle + Math.PI / 1.75);

        ctx.shadowColor = "#55f1e2";
        ctx.shadowBlur = 12;

        ctx.fillStyle = "#d9fffb";
        ctx.fillRect(-3, -20, 6, 40);

        ctx.shadowBlur = 0;

        ctx.restore();
    }
}

function drawEnemies(){
    for (const enemy of enemies) {
        ctx.save();

        ctx.shadowColor = "#ff5687";
        ctx.shadowBlur = 14;

        ctx.fillStyle = "#4b102b";
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

function drawParticles() {

    for (const particle of particles) {   
    ctx.globalAlpha = Math.max(
        0,
        particle.life / particle.maxLife
    );

    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 3, 3);
}

ctx.globalAlpha = 1;
}

// main animation loop

function drawMedKits() {
    for (const medKit of medkits) {
        const pulseSize = 1 + Math.sin(medKit.pulse * 4) * 0.08;

        ctx.save();
        ctx.translate(medKit.x, medKit.y);
        ctx.scale(pulseSize, pulseSize);

        ctx.shadowColor = "#71ff9b"
        ctx.shadowBlur = 14;

        ctx.fillStyle = "#123322";
        ctx.fillRect(-11, -11, 22, 22);

        ctx.strokeStyle = "#71ff9b";
        ctx.lineWidth = 2;
        ctx.strokeRect(-11, -11, 22, 22);

        ctx.fillStyle = "#71ff9b";
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);

        ctx.restore();
    }
}

function render() {
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    drawArena();
    
    if (player) {
        drawKnives();
        drawEnemies();
        drawParticles();
        drawPlayer();
    }
    drawMedKits();
    ctx.restore();
}

function gameloop(timestamp) {
    const dt = Math.min((timestamp - lastFrame) / 1000, 0.033);

    lastFrame = timestamp;
    update(dt);
    render();

    requestAnimationFrame(gameloop);
}

lastFrame = performance.now();
requestAnimationFrame(gameloop);