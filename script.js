/* ==========================================
   GAME ENGINE & SETUP
   ========================================== */
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("gameContainer");

// UI Elements
const homeScreen = document.getElementById("homeScreen");
const gameOverPopup = document.getElementById("gameOverPopup");
const levelPopup = document.getElementById("levelPopup");
const scoreDisplay = document.getElementById("scoreDisplay");

const currentScoreTxt = document.getElementById("currentScore");
const currentLevelTxt = document.getElementById("currentLevel");
const homeHighScoreTxt = document.getElementById("homeHighScore");
const homeHighLevelTxt = document.getElementById("homeHighLevel");
const completedLevelNum = document.getElementById("completedLevelNum");
const finalScoreTxt = document.getElementById("finalScore");
const finalLevelTxt = document.getElementById("finalLevel");

const startButton = document.getElementById("startButton");
const retryButton = document.getElementById("retryButton");
const homeButton = document.getElementById("homeButton");
const nextLevelButton = document.getElementById("nextLevelButton");
const muteBtn = document.getElementById("muteBtn");

// Asset Setup
const birdImg = new Image();
birdImg.src = "./bird.jpeg";

const personImg = new Image();
personImg.src = "./person.png";

const chemistrySound = new Audio("./chemistry-won.mp3");
const physicsSound = new Audio("./physics-won.mp3");

// Audio Synthesizer Fallback (for zero-latency sound without audio file crashes)
let audioCtx = null;
let muted = false;

function initAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSynthSound(freq, duration, type = "sine") {
    if (muted) return;
    try {
        initAudioContext();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

function playSound(audio, fallbackFreq) {
    if (muted) return;
    try {
        audio.currentTime = 0;
        const p = audio.play();
        if (p !== undefined) {
            p.catch(() => playSynthSound(fallbackFreq, 0.4, "triangle"));
        }
    } catch (e) {
        playSynthSound(fallbackFreq, 0.4, "triangle");
    }
}

muteBtn.onclick = (e) => {
    e.stopPropagation();
    muted = !muted;
    muteBtn.textContent = muted ? "🔇" : "🔊";
};

/* ==========================================
   CANVAS & RESPONSIVENESS
   ========================================== */
let canvasWidth = 550;
let canvasHeight = 900;

function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ==========================================
   GAME STATE & EASIER PHYSICS
   ========================================== */
let animationId = null;
let gameRunning = false;
let score = 0;
let level = 1;
let passedInLevel = 0;

let highScore = Number(localStorage.getItem("flappy_highScore")) || 0;
let highLevel = Number(localStorage.getItem("flappy_highLevel")) || 1;

let cameraShakeTime = 0;
let particles = [];
let trailParticles = [];
let floatingTexts = [];
let clouds = [];

// EASY CONTROL CONFIGURATION
let bird = {
    x: 80,
    y: 0,
    width: 54,
    height: 40,
    velocity: 0,
    gravity: 0.28,    // Lighter gravity (easier float)
    jump: -6.2,       // Gentle jump height
    rotation: 0
};

let pipes = [];

/* ==========================================
   INITIALIZATION
   ========================================== */
function updateUIStats() {
    homeHighScoreTxt.textContent = highScore;
    homeHighLevelTxt.textContent = highLevel;
}
updateUIStats();

function initClouds() {
    clouds = [];
    // 2 Layers for Parallax Depth
    for (let i = 0; i < 7; i++) {
        clouds.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * (canvasHeight * 0.6),
            size: 25 + Math.random() * 35,
            speed: 0.2 + Math.random() * 0.5,
            layer: Math.random() > 0.5 ? 1 : 2
        });
    }
}
initClouds();

/* ==========================================
   INPUT HANDLING
   ========================================== */
function handleFly() {
    initAudioContext();
    if (!gameRunning) return;
    bird.velocity = bird.jump;
    playSynthSound(420, 0.08, "sine"); // Jump sound
}

window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleFly();
    }
});

canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    handleFly();
});

canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleFly();
}, { passive: false });

/* ==========================================
   GAME LOGIC & EASY PIPE GENERATION
   ========================================== */
function startNewGame() {
    score = 0;
    level = 1;
    passedInLevel = 0;
    startLevel();
}

function startLevel() {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    bird.x = canvasWidth * 0.22;
    bird.y = canvasHeight * 0.45;
    bird.velocity = 0;
    bird.rotation = 0;

    pipes = [];
    particles = [];
    trailParticles = [];
    floatingTexts = [];
    passedInLevel = 0;
    cameraShakeTime = 0;

    currentScoreTxt.textContent = score;
    currentLevelTxt.textContent = level;

    // Spawns initial pipe comfortably out of immediate view
    createPipe(canvasWidth + 120);

    gameRunning = true;
    animationId = requestAnimationFrame(gameLoop);
}

function createPipe(xPosition) {
    // ACCESSIBLE WIDE GAP (Easier clearance)
    const baseGap = 200; 
    const gap = Math.max(155, baseGap - (level - 1) * 3);
    const minTop = 90;
    const maxTop = canvasHeight - gap - 130;
    const top = Math.floor(Math.random() * (maxTop - minTop)) + minTop;

    pipes.push({
        x: xPosition,
        width: 68,
        top: top,
        gap: gap,
        passed: false
    });
}

function addParticleExplosion(x, y) {
    for (let i = 0; i < 22; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            radius: Math.random() * 5 + 2,
            color: `hsl(${Math.random() * 50 + 40}, 100%, 65%)`,
            alpha: 1
        });
    }
}

function addFloatingText(x, y, text) {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        alpha: 1,
        scale: 1.5
    });
}

function collisionCheck(pipe) {
    // FORGIVING HITBOX PADDING (Prevents cheap deaths)
    const padX = 12;
    const padY = 10;
    const bx = bird.x + padX;
    const by = bird.y + padY;
    const bw = bird.width - (padX * 2);
    const bh = bird.height - (padY * 2);

    if (bx + bw > pipe.x && bx < pipe.x + pipe.width) {
        if (by < pipe.top || by + bh > pipe.top + pipe.gap) {
            return true;
        }
    }
    return false;
}

/* ==========================================
   VISUAL EFFECTS & DRAWING ENGINE
   ========================================== */
function drawBackground() {
    // Dynamic Sky Gradient based on Level
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, "#0284c7");
    grad.addColorStop(0.6, "#38bdf8");
    grad.addColorStop(1, "#bae6fd");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Multilayer Parallax Clouds
    clouds.forEach(cloud => {
        cloud.x -= cloud.speed;
        if (cloud.x + cloud.size * 3 < 0) {
            cloud.x = canvasWidth + cloud.size;
            cloud.y = Math.random() * (canvasHeight * 0.5);
        }
        
        ctx.fillStyle = cloud.layer === 1 ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.75)";
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.size, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 0.7, cloud.y - cloud.size * 0.2, cloud.size * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.size * 1.3, cloud.y, cloud.size * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawHead(x, y, size) {
    const radius = size / 2;
    const cx = x + radius;
    const cy = y + radius;

    ctx.save();
    if (personImg.complete && personImg.naturalWidth > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(personImg, x, y, size, size);
    } else {
        // High quality fallback circular head
        ctx.fillStyle = "#ffcc99";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#334155";
        ctx.beginPath();
        ctx.arc(cx - 7, cy - 4, 3.5, 0, Math.PI * 2);
        ctx.arc(cx + 7, cy - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Subtle 3D Shadow & Edge Ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
}

function drawPillar(pipe) {
    const headSize = pipe.width;

    // Upper Pillar Stack
    for (let y = 0; y < pipe.top; y += headSize) {
        drawHead(pipe.x, y, headSize);
    }

    // Lower Pillar Stack
    const bottomStart = pipe.top + pipe.gap;
    for (let y = bottomStart; y < canvasHeight; y += headSize) {
        drawHead(pipe.x, y, headSize);
    }
}

function updateAndDrawTrail() {
    // Add new point to trail
    trailParticles.push({
        x: bird.x + 8,
        y: bird.y + bird.height / 2,
        alpha: 0.6,
        radius: 8
    });

    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const t = trailParticles[i];
        t.x -= 2;
        t.alpha -= 0.03;
        t.radius *= 0.94;

        if (t.alpha <= 0) {
            trailParticles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.fillStyle = `rgba(250, 204, 21, ${t.alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    
    // Smooth, gentle bird tilt
    bird.rotation = Math.min(Math.PI / 5, Math.max(-Math.PI / 7, bird.velocity * 0.07));
    ctx.rotate(bird.rotation);

    if (birdImg.complete && birdImg.naturalWidth > 0) {
        ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
    } else {
        // Fallback Golden Bird
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(0, 0, bird.height / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f97316";
        ctx.beginPath();
        ctx.arc(10, 2, 6, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

function updateAndDrawFX() {
    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.025;

        if (p.alpha <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Floating Text FX (+1 Popups)
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1.8;
        ft.alpha -= 0.02;
        ft.scale = Math.max(1, ft.scale - 0.02);

        if (ft.alpha <= 0) {
            floatingTexts.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = `900 ${Math.floor(22 * ft.scale)}px sans-serif`;
        ctx.fillStyle = "#facc15";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }
}

/* ==========================================
   MAIN GAME LOOP
   ========================================== */
function gameLoop() {
    if (!gameRunning) return;

    ctx.save();

    // Camera Shake
    if (cameraShakeTime > 0) {
        const dx = (Math.random() - 0.5) * 14;
        const dy = (Math.random() - 0.5) * 14;
        ctx.translate(dx, dy);
        cameraShakeTime--;
    }

    drawBackground();

    // Player Physics Update
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    updateAndDrawTrail();
    drawBird();

    // Gentle Speed Progression
    const pipeSpeed = 2.0 + (level - 1) * 0.35;
    const pipeSpacing = Math.max(200, 260 - level * 4);

    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.x -= pipeSpeed;
        drawPillar(pipe);

        // Check Collisions
        if (collisionCheck(pipe)) {
            triggerGameOver();
            ctx.restore();
            return;
        }

        // Pass & Score Logic
        if (!pipe.passed && pipe.x + pipe.width < bird.x) {
            pipe.passed = true;
            score++;
            passedInLevel++;

            currentScoreTxt.textContent = score;
            addParticleExplosion(pipe.x + pipe.width, bird.y + bird.height / 2);
            addFloatingText(bird.x, bird.y - 10, "+1");
            playSynthSound(580, 0.12, "triangle");

            if (score > highScore) {
                highScore = score;
                localStorage.setItem("flappy_highScore", highScore);
            }

            // Exactly 5 Pillars per Level
            if (passedInLevel >= 5) {
                triggerLevelComplete();
                ctx.restore();
                return;
            }
        }

        // Remove Offscreen Pipes
        if (pipe.x + pipe.width < 0) {
            pipes.splice(i, 1);
        }
    }

    // Dynamic Spawner
    if (pipes.length > 0) {
        const lastPipe = pipes[pipes.length - 1];
        if (lastPipe.x < canvasWidth - pipeSpacing) {
            createPipe(canvasWidth);
        }
    }

    updateAndDrawFX();

    // Floor / Ceiling Boundaries
    if (bird.y <= 0 || bird.y + bird.height >= canvasHeight) {
        triggerGameOver();
        ctx.restore();
        return;
    }

    ctx.restore();
    animationId = requestAnimationFrame(gameLoop);
}

/* ==========================================
   TRANSITIONS & STATE MODALS
   ========================================== */
function triggerLevelComplete() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    playSound(chemistrySound, 880);

    if (level > highLevel) {
        highLevel = level;
        localStorage.setItem("flappy_highLevel", highLevel);
    }

    completedLevelNum.textContent = level;
    levelPopup.classList.remove("hidden");
}

function triggerGameOver() {
    gameRunning = false;
    cameraShakeTime = 12;
    playSound(physicsSound, 180);

    finalScoreTxt.textContent = score;
    finalLevelTxt.textContent = level;

    gameOverPopup.classList.remove("hidden");
}

/* ==========================================
   BUTTON EVENT HANDLERS
   ========================================== */
startButton.onclick = () => {
    initAudioContext();
    homeScreen.classList.add("hidden");
    scoreDisplay.classList.remove("hidden");
    startNewGame();
};

nextLevelButton.onclick = () => {
    levelPopup.classList.add("hidden");
    level++;
    startLevel();
};

retryButton.onclick = () => {
    gameOverPopup.classList.add("hidden");
    startNewGame();
};

homeButton.onclick = () => {
    gameRunning = false;
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    gameOverPopup.classList.add("hidden");
    levelPopup.classList.add("hidden");
    scoreDisplay.classList.add("hidden");

    updateUIStats();
    homeScreen.classList.remove("hidden");
};