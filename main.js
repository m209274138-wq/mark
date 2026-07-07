const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* =====================
   全屏
===================== */
function resize(){
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* =====================
   游戏状态
===================== */
const Game = {
    speed: 7,
    distance: 0,
    gameOver: false,
    shake: 0
};

const particles = [];

function spawnLandingParticles(x, y){
    for(let i=0;i<24;i++){
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 4.8,
            vy: -Math.random() * 3.8,
            life: 24 + Math.random() * 14,
            size: 1.6 + Math.random() * 2.4,
            color: i % 2 === 0 ? "#7a4a21" : "#b87a3a"
        });
    }

    for(let i=0;i<10;i++){
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 5.6,
            vy: -Math.random() * 2.2,
            life: 10 + Math.random() * 8,
            size: 2.2 + Math.random() * 2.8,
            color: i % 2 === 0 ? "#c97b2f" : "#ffcf6b"
        });
    }
}

function spawnShieldExplosion(x, y){
    const colors = ["#ff4d4d", "#ff7a00", "#ffd166", "#fff2a8", "#ff3b3b"];

    for(let i=0;i<34;i++){
        const angle = (Math.PI * 2 * i) / 34 + Math.random() * 0.3;
        const speed = 2.2 + Math.random() * 4.8;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            life: 14 + Math.random() * 16,
            size: 1.4 + Math.random() * 2.6,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    for(let i=0;i<10;i++){
        particles.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 3.6,
            vy: (Math.random() - 0.5) * 3.6,
            life: 8 + Math.random() * 10,
            size: 2.2 + Math.random() * 3.2,
            color: i % 2 === 0 ? "#fff6a6" : "#ff7a00"
        });
    }

    Game.shake = Math.max(Game.shake, 14);
}

/* =====================
   摄像机
===================== */
const camera = { x: 0 };

/* =====================
   玩家
===================== */
const player = {
    x: 120,
    y: 0,
    w: 40,
    h: 60,
    vy: 0,
    onGround: false,
    jumpsLeft: 2,
    jumpQueued: false,
    flightTimer: 0,
    invulnerableTimer: 0,
    flightLandingInvulnerable: false,
    flightTargetY: null,
    shieldTimer: 0,

    // 新增能力
    dash: false,
    dashTime: 0,
    dashCooldown: 0,

    hp: 1
};

/* =====================
   地面
===================== */
const groundY = () => canvas.height - 120;

/* =====================
   障碍物
===================== */
const obstacles = [];
const powerups = [];
const shieldPowerups = [];
let nextPowerupDistance = 1000 + Math.random() * 1000;
let powerupSpawnCooldown = 0;
const MIN_POWERUP_CLEAR_DISTANCE = 100;

function spawnObstacle(){
    obstacles.push({
        x: canvas.width + 200 + camera.x,
        y: groundY(),
        w: 40 + Math.random()*30,
        h: 60,
        passed: false
    });
}

function isSafePowerupSpawn(x, y, w, h){
    return !obstacles.some(ob => {
        const obstacleX = ob.x;
        const obstacleY = ob.y - ob.h;
        const obstacleRight = obstacleX + ob.w;
        const obstacleBottom = obstacleY + ob.h;

        const horizontalGap = Math.max(obstacleX - (x + w), x - (obstacleRight), 0);
        const verticalGap = Math.max(obstacleY - (y + h), y - (obstacleBottom), 0);
        const distance = Math.sqrt(horizontalGap * horizontalGap + verticalGap * verticalGap);

        return distance < MIN_POWERUP_CLEAR_DISTANCE;
    });
}

function getDoubleJumpPeakY(){
    return groundY() - player.h - 250;
}

function spawnPowerup(){
    let x = camera.x + canvas.width + 300 + Math.random() * 250;
    let y = getDoubleJumpPeakY();
    let tries = 0;

    while(!isSafePowerupSpawn(x, y, 24, 24) && tries < 20){
        x = camera.x + canvas.width + 300 + Math.random() * 250;
        y = getDoubleJumpPeakY();
        tries++;
    }

    powerups.push({
        x,
        y,
        r: 12,
        collected: false
    });
}

function spawnShieldPowerup(){
    let x = camera.x + canvas.width + 300 + Math.random() * 250;
    let y = groundY() - 40;
    let tries = 0;

    while(!isSafePowerupSpawn(x, y, 18, 18) && tries < 20){
        x = camera.x + canvas.width + 300 + Math.random() * 250;
        y = groundY() - 40;
        tries++;
    }

    shieldPowerups.push({
        x,
        y,
        w: 18,
        h: 18,
        collected: false
    });
}

function trySpawnPowerups(){
    if(Game.distance >= nextPowerupDistance && powerups.length === 0 && shieldPowerups.length === 0){
        const spawnShield = Math.random() < 0.5;
        if(spawnShield){
            spawnShieldPowerup();
        } else {
            spawnPowerup();
        }
        nextPowerupDistance = Game.distance + 1000 + Math.random() * 1000;
    }
}

/* =====================
   输入
===================== */
const keys = {};
const touchControls = document.getElementById("touch-controls");
const jumpButton = document.getElementById("jump-button");
const fallButton = document.getElementById("fall-button");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

if(isTouchDevice){
    touchControls.classList.add("visible");
}

function setControlState(code, pressed){
    keys[code] = pressed;

    if(code === "Space"){
        player.jumpQueued = pressed;
    }
}

function bindTouchButton(button, code){
    const setPressed = pressed => {
        button.classList.toggle("active", pressed);
        setControlState(code, pressed);
    };

    const handleStart = e=>{
        e.preventDefault();
        setPressed(true);
        if(typeof button.setPointerCapture === "function" && e.pointerId !== undefined){
            try{ button.setPointerCapture(e.pointerId); }catch(err){}
        }
    };

    const handleEnd = e=>{
        e.preventDefault();
        setPressed(false);
        if(typeof button.releasePointerCapture === "function" && e.pointerId !== undefined){
            try{ button.releasePointerCapture(e.pointerId); }catch(err){}
        }
    };

    button.addEventListener("pointerdown", handleStart);
    button.addEventListener("pointerup", handleEnd);
    button.addEventListener("pointercancel", handleEnd);
    button.addEventListener("pointerleave", e=>{
        if(e.buttons === 0){
            setPressed(false);
        }
    });

    button.addEventListener("touchstart", handleStart, { passive: false });
    button.addEventListener("touchend", handleEnd, { passive: false });
    button.addEventListener("touchcancel", handleEnd, { passive: false });
    button.addEventListener("mousedown", handleStart);
    button.addEventListener("mouseup", handleEnd);
    button.addEventListener("mouseleave", ()=>setPressed(false));
}

bindTouchButton(jumpButton, "Space");
bindTouchButton(fallButton, "KeyS");

window.addEventListener("keydown", e=>{
    keys[e.code] = true;

    if(e.code === "Space"){
        player.jumpQueued = true;
    }

    if(e.code === "KeyR" && Game.gameOver){
        location.reload();
    }
});

window.addEventListener("keyup", e=>{
    keys[e.code] = false;

    if(e.code === "Space"){
        player.jumpQueued = false;
    }
});

/* =====================
   更新
===================== */
function update(step){

    if(Game.gameOver) return;

    Game.distance += Game.speed * step;

    camera.x = Game.distance - 200;
    const wasOnGround = player.onGround;

    /* 跳跃 */
    if(player.jumpQueued && player.jumpsLeft > 0){
        player.vy = -18 * step;
        player.onGround = false;
        player.jumpsLeft--;
        player.jumpQueued = false;
    }

    /* S 键快速落下 */
    if(keys["KeyS"] && !player.onGround){
        player.vy += 1.2 * step;
        player.y += 8 * step;
    }

    if(keys["KeyS"] && player.flightTimer > 0){
        player.flightTimer = 0;
        player.flightTargetY = null;
    }

    /* 飞行状态 */
    if(player.flightTimer > 0){
        player.flightTimer = Math.max(0, player.flightTimer - step);
        if(player.flightTargetY === null){
            player.flightTargetY = Math.max(80, Math.min(groundY() - player.h - 120, canvas.height * 0.22));
        }

        const easing = 0.06;
        const deltaY = (player.flightTargetY - player.y) * easing * step;
        player.y += deltaY;
        player.vy = deltaY;

        if(Math.abs(player.flightTargetY - player.y) < 0.4){
            player.y = player.flightTargetY;
            player.vy = 0;
        }
    } else {
        player.flightTargetY = null;
        player.vy += 0.9 * step;
    }
    player.y += player.vy * step;

    if(!wasOnGround && player.y >= groundY() - player.h){
        if(player.flightTimer <= 0 && player.flightLandingInvulnerable){
            const feetX = player.x + player.w / 2;
            const feetY = player.y + player.h;
            spawnLandingParticles(feetX, feetY);
            Game.shake = 16;
        }
        player.y = groundY() - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumpsLeft = 2;
        if(player.flightLandingInvulnerable){
            player.invulnerableTimer = 120;
            player.flightLandingInvulnerable = false;
        }
    }

    if(player.y > groundY() - player.h){
        player.y = groundY() - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumpsLeft = 2;
    }

    if(player.invulnerableTimer > 0){
        player.invulnerableTimer = Math.max(0, player.invulnerableTimer - step);
    }

    if(player.shieldTimer > 0){
        player.shieldTimer = Math.max(0, player.shieldTimer - step);
    }

    /* 速度变化 */
    let currentSpeed = player.dash ? Game.speed * 2 : Game.speed;

    trySpawnPowerups();

    /* 更新粒子 */
    for(let i=particles.length-1;i>=0;i--){
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
        if(p.life <= 0){
            particles.splice(i,1);
        }
    }

    if(Game.shake > 0){
        Game.shake = Math.max(0, Game.shake - step);
    }

    /* 更新飞行道具 */
    for(let i=powerups.length-1;i>=0;i--){
        let p = powerups[i];
        p.x -= currentSpeed * step;

        const px = p.x - camera.x;
        const py = p.y;

        if(!p.collected &&
            player.x < px + p.r * 2 &&
            player.x + player.w > px &&
            player.y < py + p.r * 2 &&
            player.y + player.h > py){
            p.collected = true;
            player.flightTimer = 300;
            player.flightLandingInvulnerable = true;
            player.flightTargetY = Math.max(80, Math.min(groundY() - player.h - 120, canvas.height * 0.22));
            powerups.splice(i,1);
        }

        if(px < -100){
            powerups.splice(i,1);
        }
    }

    /* 更新护盾道具 */
    for(let i=shieldPowerups.length-1;i>=0;i--){
        let s = shieldPowerups[i];
        s.x -= currentSpeed * step;

        const sx = s.x - camera.x;
        const sy = s.y;

        if(!s.collected &&
            player.x < sx + s.w &&
            player.x + player.w > sx &&
            player.y < sy + s.h &&
            player.y + player.h > sy){
            s.collected = true;
            player.shieldTimer = 300;
            shieldPowerups.splice(i,1);
        }

        if(sx < -100){
            shieldPowerups.splice(i,1);
        }
    }

    /* 冲刺逻辑 */
    if(player.dash){
        player.dashTime = Math.max(0, player.dashTime - step);
        if(player.dashTime <= 0){
            player.dash = false;
        }
    }

    if(player.dashCooldown > 0){
        player.dashCooldown = Math.max(0, player.dashCooldown - step);
    }

    /* 生成障碍物 */
    if(Math.random() < 0.02 * step){
        spawnObstacle();
    }

    /* 更新障碍物 */
    for(let i=obstacles.length-1;i>=0;i--){
        let o = obstacles[i];
        o.x -= currentSpeed * step;

        const screenX = o.x - camera.x;
        const screenY = o.y - o.h;
        const obstacleRight = screenX + o.w;
        const obstacleBottom = screenY + o.h;
        const playerRight = player.x + player.w;
        const playerBottom = player.y + player.h;

        // 碰撞检测（标准矩形重叠检测，和渲染坐标一致）
        const hitObstacle = player.x < obstacleRight &&
            playerRight > screenX &&
            player.y < obstacleBottom &&
            playerBottom > screenY;

        if(hitObstacle && !player.dash && player.flightTimer <= 0 && player.invulnerableTimer <= 0){
            if(player.shieldTimer > 0){
                player.shieldTimer = 0;
                player.invulnerableTimer = 120;
                const explosionX = screenX + o.w / 2;
                const explosionY = screenY + o.h / 2;
                o.x = -1000;
                spawnShieldExplosion(explosionX, explosionY);
                obstacles.forEach(ob => {
                    if(ob.x > -200 && ob.x < canvas.width + 200){
                        ob.x = -1000;
                    }
                });
            } else {
                Game.gameOver = true;
            }
        }

        // 删除
        if(screenX < -100){
            obstacles.splice(i,1);
        }
    }
}

/* =====================
   背景
===================== */
function drawBackground(){

    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0,"#050816");
    g.addColorStop(1,"#0a1b2a");

    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

/* =====================
   地面
===================== */
function drawGround(){

    const y = groundY();

    ctx.fillStyle = "#1aff7a";

    // 关键修复：不用 %，改成循环补齐屏幕
    let start = Math.floor(camera.x / 50) * 50;

    for(let i = start; i < camera.x + canvas.width + 100; i += 50){

        let x = i - camera.x;

        ctx.fillRect(x, y, 50, 120);
    }
}

/* =====================
   玩家
===================== */
function drawPlayer(){
    const blink = Math.floor(Date.now() / 120) % 2 === 0;
    const showPlayer = player.invulnerableTimer <= 0 || blink;

    if(!showPlayer) return;

    const isRunning = player.onGround || Math.abs(player.y - (groundY() - player.h)) < 4;
    const frame = Math.floor(Date.now() / 90) % 2;
    const swing = frame === 0 ? 12 : -12;

    ctx.save();
    ctx.translate(player.x, player.y);

    ctx.strokeStyle = player.dash ? "#ff00ff" : "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if(player.shieldTimer > 0){
        ctx.strokeStyle = "#4de0ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(14, 18, 18, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = player.dash ? "#ff00ff" : "#ffffff";
        ctx.lineWidth = 3;
    }

    // 头
    ctx.beginPath();
    ctx.arc(14, 10, 6, 0, Math.PI * 2);
    ctx.stroke();

    // 身体
    ctx.beginPath();
    ctx.moveTo(14, 16);
    ctx.lineTo(14, 34);
    ctx.stroke();

    // 手臂
    ctx.beginPath();
    ctx.moveTo(14, 22);
    if(isRunning){
        ctx.lineTo(6 + swing * 0.2, 28);
    } else {
        ctx.lineTo(6, 28);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14, 22);
    if(isRunning){
        ctx.lineTo(22 - swing * 0.2, 28);
    } else {
        ctx.lineTo(22, 28);
    }
    ctx.stroke();

    // 双腿
    ctx.beginPath();
    ctx.moveTo(14, 34);
    if(isRunning){
        ctx.lineTo(8 + swing, 48);
        ctx.moveTo(14, 34);
        ctx.lineTo(20 - swing, 48);
    } else {
        ctx.lineTo(8, 48);
        ctx.moveTo(14, 34);
        ctx.lineTo(20, 48);
    }
    ctx.stroke();

    ctx.restore();
}

function drawParticles(){
    particles.forEach(p=>{
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}

/* =====================
   障碍物
===================== */
function drawObstacles(){

    ctx.fillStyle = "#ff3b3b";

    obstacles.forEach(o=>{
        ctx.fillRect(o.x - camera.x, o.y - o.h, o.w, o.h);
    });
}

function drawPowerups(){
    powerups.forEach(p=>{
        const x = p.x - camera.x;
        const y = p.y;

        ctx.save();
        ctx.translate(x, y);

        for(let i = 0; i < 5; i++){
            const radius = p.r * (0.7 + i * 0.12);
            ctx.beginPath();
            ctx.lineWidth = 2;
            ctx.strokeStyle = i === 0 ? "#ffd166" : "#ffb703";
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = "#fff2a8";
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function drawShieldPowerups(){
    const t = Date.now() / 320;

    shieldPowerups.forEach(s=>{
        const x = s.x - camera.x;
        const y = s.y;

        ctx.save();
        ctx.translate(x + s.w / 2, y + s.h / 2);
        ctx.rotate(Math.sin(t + s.x * 0.01) * 0.35);
        ctx.translate(-(s.w / 2), -(s.h / 2));

        const grad = ctx.createLinearGradient(0, 0, s.w, s.h);
        grad.addColorStop(0, "#8df2ff");
        grad.addColorStop(0.5, "#2f7cff");
        grad.addColorStop(1, "#0b2a8f");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(s.w * 0.5, 1);
        ctx.lineTo(s.w - 2, s.h * 0.18);
        ctx.quadraticCurveTo(s.w * 0.95, s.h * 0.4, s.w * 0.72, s.h * 0.5);
        ctx.quadraticCurveTo(s.w * 0.95, s.h * 0.62, s.w - 2, s.h * 0.82);
        ctx.lineTo(s.w * 0.5, s.h - 2);
        ctx.lineTo(2, s.h * 0.82);
        ctx.quadraticCurveTo(s.w * 0.06, s.h * 0.62, s.w * 0.28, s.h * 0.5);
        ctx.quadraticCurveTo(s.w * 0.06, s.h * 0.4, 2, s.h * 0.18);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#e7fbff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#e7fbff";
        ctx.beginPath();
        ctx.arc(s.w * 0.5, s.h * 0.5, s.w * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

/* =====================
   UI
===================== */
function drawUI(){

    ctx.fillStyle = "#fff";
    ctx.font = "20px Arial";

    ctx.fillText("Distance: " + Math.floor(Game.distance/10), 20, 40);

    if(player.dashCooldown > 0){
        ctx.fillText("Dash CD: " + player.dashCooldown, 20, 70);
    }

    if(player.flightTimer > 0){
        ctx.fillText("Flight: " + Math.ceil(player.flightTimer / 60), 20, 100);
    }

    if(player.shieldTimer > 0){
        ctx.fillText("Shield: " + Math.ceil(player.shieldTimer / 60), 20, 130);
    }

    if(Game.gameOver){
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.fillStyle = "#fff";
        ctx.font = "60px Arial";
        ctx.fillText("GAME OVER", canvas.width/2 - 180, canvas.height/2);

        ctx.font = "25px Arial";
        ctx.fillText("Press R to Restart", canvas.width/2 - 120, canvas.height/2 + 50);
    }
}

/* =====================
   主循环
===================== */
let lastTime = performance.now();

function loop(timestamp = performance.now()){
    const delta = timestamp - lastTime;
    const step = delta <= 0 ? 1 : Math.min(2, delta / 16.6667);
    lastTime = timestamp;

    update(step);

    const shakeX = (Math.random() - 0.5) * Game.shake;
    const shakeY = (Math.random() - 0.5) * Game.shake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    drawBackground();
    drawGround();
    drawObstacles();
    drawPowerups();
    drawShieldPowerups();
    drawParticles();
    drawPlayer();
    ctx.restore();
    drawUI();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);