// ==================== CANVAS SETUP ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// DOM Elements
const startOverlay = document.getElementById('start-overlay');
const mainMenu = document.getElementById('main-menu');
const gameOverMenu = document.getElementById('game-over');
const tapHint = document.getElementById('tap-hint');
const hudLevel = document.getElementById('hud-level');
const hudScore = document.getElementById('hud-score');
const hudTarget = document.getElementById('hud-target');
const menuTargetDesc = document.getElementById('menu-target-desc');
const finalScoreEl = document.getElementById('final-score');
const highScoreEl = document.getElementById('high-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
// Force title change dynamically via JavaScript
document.querySelectorAll('.glass-card h1').forEach(h1 => {
  h1.innerText = 'APS KA BAAP';
});

// ==================== IMAGE SPRITES ====================
const imgBird = new Image();
imgBird.src = 'bird.jpeg';

const imgPillarHead = new Image();
imgPillarHead.src = 'person.png';

const imgBg = new Image();
imgBg.src = 'bg.png';

let birdLoaded = false;
let headLoaded = false;
let bgLoaded = false;

imgBird.onload = () => { birdLoaded = true; };
imgPillarHead.onload = () => { headLoaded = true; };
imgBg.onload = () => { bgLoaded = true; };

// ==================== AUDIO SETUP ====================
let audioCtx = null;

function initAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 1. Main Menu Background Music
const menuAudio = new Audio('subway-surfers.mp3');
menuAudio.loop = true;
menuAudio.volume = 0.8;

// 2. Preload Multi-track Win Sounds (won1.mp3 to won5.mp3)
const winAudios = [];
for (let i = 1; i <= 5; i++) {
  const audio = new Audio(`won${i}.mp3`);
  winAudios.push(audio);
}

// 3. Preload Multi-track Lose Sounds (lost1.mp3 to lost5.mp3)
const loseAudios = [];
for (let i = 1; i <= 5; i++) {
  const audio = new Audio(`lost${i}.mp3`);
  loseAudios.push(audio);
}

// Play / Stop Menu Audio
function playMenuAudio() {
  menuAudio.currentTime = 0;
  menuAudio.play().catch(() => {});
}

function stopMenuAudio() {
  try {
    menuAudio.pause();
    menuAudio.currentTime = 0;
  } catch(e) {}
}

// ==================== SFX TRIGGERS ====================

// Bird Click / Flap Sound (Web Audio Synthesizer)
function playBirdFlapSFX() {
  initAudioContext();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    
    osc.frequency.setValueAtTime(450, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.09);
  } catch(e) {}
}

// Target Score Win Sound (Random won1 to won5)
function playRandomWinSFX() {
  const randomIndex = Math.floor(Math.random() * winAudios.length);
  const selectedAudio = winAudios[randomIndex];
  selectedAudio.currentTime = 0;
  selectedAudio.play().catch(() => {});
}

// Game Over Lose Sound (Random lost1 to lost5)
function playRandomLoseSFX() {
  const randomIndex = Math.floor(Math.random() * loseAudios.length);
  const selectedAudio = loseAudios[randomIndex];
  selectedAudio.currentTime = 0;
  selectedAudio.play().catch(() => {});
}

// Normal Score (+1) Sound
function playScorePointSFX() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch(e) {}
}

// Unmute Audio Listener
let audioStarted = false;
function enableAudioAndStart() {
  initAudioContext();
  if (!audioStarted) {
    audioStarted = true;
    if (startOverlay) startOverlay.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    playMenuAudio();
  }
}

if (startOverlay) {
  startOverlay.addEventListener('click', enableAudioAndStart);
  startOverlay.addEventListener('touchstart', enableAudioAndStart);
}

window.addEventListener('click', () => {
  initAudioContext();
  if (!audioStarted) enableAudioAndStart();
});

// ==================== GAME STATE & VARIABLES ====================
let gameState = 'MENU'; 
let score = 0;
let level = 1;
let targetScore = 5;
let highScore = localStorage.getItem('flappy_high_score') || 0;
let frameCount = 0;
let bgX = 0;

const levelTargets = [5, 8, 12, 16, 22, 30, 40, 50];

function getTargetForLevel(lvl) {
  if (lvl <= levelTargets.length) {
    return levelTargets[lvl - 1];
  }
  return levelTargets[levelTargets.length - 1] + (lvl - levelTargets.length) * 10;
}

// BIRD PHYSICS
const bird = {
  x: 80,
  y: 280,
  width: 60,
  height: 60,
  gravity: 0.32,
  lift: -7.2,
  velocity: 0,
  rotation: 0
};

let pipes = [];
let popups = [];

// ==================== EVENT LISTENERS ====================
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  enableAudioAndStart();
  startGame();
});

restartBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  enableAudioAndStart();
  returnToMainMenu();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') handleInput();
});

canvas.addEventListener('mousedown', handleInput);
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleInput();
}, { passive: false });

function handleInput() {
  initAudioContext();
  if (gameState === 'READY') {
    gameState = 'PLAYING';
    tapHint.classList.add('hidden');
    bird.velocity = bird.lift;
    playBirdFlapSFX();
  } else if (gameState === 'PLAYING') {
    bird.velocity = bird.lift;
    playBirdFlapSFX();
  }
}

// ==================== ENGINE FLOW ====================
function startGame() {
  stopMenuAudio(); 

  score = 0;
  level = 1;
  targetScore = getTargetForLevel(level);

  resetBird();
  pipes = [];
  popups = [];

  updateHUD();
  mainMenu.classList.add('hidden');
  gameOverMenu.classList.add('hidden');
  tapHint.classList.remove('hidden');

  gameState = 'READY';
}

function returnToMainMenu() {
  gameState = 'MENU';
  gameOverMenu.classList.add('hidden');
  mainMenu.classList.remove('hidden');
  tapHint.classList.add('hidden');
  resetBird();
  updateHUD();
  playMenuAudio(); 
}

function resetBird() {
  bird.x = 80;
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.rotation = 0;
}

function updateHUD() {
  hudLevel.innerText = level;
  hudScore.innerText = score;
  hudTarget.innerText = targetScore;
  menuTargetDesc.innerText = `SCORE ${targetScore} TO ADVANCE`;
}

function addScorePopup(text, x, y) {
  popups.push({ text, x, y, alpha: 1 });
}

// ==================== MAIN GAME LOOP ====================
function gameLoop() {
  frameCount++;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawBackground();

  if (gameState === 'READY') {
    bird.y = canvas.height / 2 + Math.sin(frameCount * 0.08) * 8;
    bird.rotation = 0;
    drawBird();
  } else if (gameState === 'PLAYING') {
    updatePhysics();
    updatePipes();
    drawPipes();
    drawBird();
    checkCollisions();
  } else if (gameState === 'GAMEOVER') {
    drawPipes();
    drawBird();
  }

  updateAndDrawPopups();
  requestAnimationFrame(gameLoop);
}

function updatePhysics() {
  bird.velocity += bird.gravity;
  bird.y += bird.velocity;

  if (bird.velocity < 0) {
    bird.rotation = -20 * Math.PI / 180;
  } else {
    bird.rotation = Math.min(60, bird.velocity * 3) * Math.PI / 180;
  }
}

function updatePipes() {
  if (frameCount % 110 === 0) {
    const gap = Math.max(180, 240 - level * 4);
    const minTop = 60;
    const maxTop = canvas.height - gap - 100;
    const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;

    pipes.push({
      x: canvas.width,
      top: topHeight,
      bottom: canvas.height - topHeight - gap,
      passed: false
    });
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= (1.8 + Math.min(2, level * 0.2));

    if (!pipes[i].passed && pipes[i].x + 60 < bird.x) {
      pipes[i].passed = true;
      score++;
      addScorePopup("+1", bird.x + 20, bird.y - 10);

      // Check Target Reached
      if (score >= targetScore) {
        level++;
        targetScore = getTargetForLevel(level);
        playRandomWinSFX(); // Plays random won1.mp3 - won5.mp3
        addScorePopup("TARGET PASSED!", canvas.width / 2 - 60, 150);
      } else {
        playScorePointSFX();
      }

      updateHUD();
    }

    if (pipes[i].x < -70) {
      pipes.splice(i, 1);
    }
  }
}

function checkCollisions() {
  if (bird.y - bird.height / 2 <= 0 || bird.y + bird.height / 2 >= canvas.height - 20) {
    triggerGameOver();
    return;
  }

  const pipeWidth = 60;
  for (let p of pipes) {
    if (bird.x + bird.width / 2 > p.x && bird.x - bird.width / 2 < p.x + pipeWidth) {
      if (bird.y - bird.height / 2 < p.top || bird.y + bird.height / 2 > canvas.height - p.bottom) {
        triggerGameOver();
        return;
      }
    }
  }
}

// ==================== DRAW FUNCTIONS ====================
function drawBackground() {
  if (bgLoaded || (imgBg.complete && imgBg.naturalWidth !== 0)) {
    bgX = (bgX - 0.5) % canvas.width;
    ctx.drawImage(imgBg, bgX, 0, canvas.width, canvas.height);
    ctx.drawImage(imgBg, bgX + canvas.width, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = "#4ec0ca";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  if (birdLoaded || (imgBird.complete && imgBird.naturalWidth !== 0)) {
    ctx.beginPath();
    ctx.arc(0, 0, bird.width / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imgBird, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
  } else {
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(0, 0, bird.width / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStackedPillarHeads(x, startY, totalHeight, direction) {
  const headSize = 56; 
  const count = Math.ceil(totalHeight / headSize);

  for (let i = 0; i < count; i++) {
    let yPos = direction === 'top' 
      ? startY - (i + 1) * headSize 
      : startY + i * headSize;

    if (headLoaded || (imgPillarHead.complete && imgPillarHead.naturalWidth !== 0)) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + headSize / 2, yPos + headSize / 2, headSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgPillarHead, x, yPos, headSize, headSize);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ff007f';
      ctx.beginPath();
      ctx.arc(x + headSize / 2, yPos + headSize / 2, headSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPipes() {
  pipes.forEach(p => {
    drawStackedPillarHeads(p.x, p.top, p.top, 'top');
    const bottomY = canvas.height - p.bottom;
    drawStackedPillarHeads(p.x, bottomY, p.bottom, 'bottom');
  });
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  playRandomLoseSFX(); // Plays random lost1.mp3 - lost5.mp3

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('flappy_high_score', highScore);
  }

  finalScoreEl.innerText = score;
  highScoreEl.innerText = highScore;

  setTimeout(() => {
    gameOverMenu.classList.remove('hidden');
  }, 400);
}

function updateAndDrawPopups() {
  for (let i = popups.length - 1; i >= 0; i--) {
    let pop = popups[i];
    pop.y -= 1.5;
    pop.alpha -= 0.02;

    if (pop.alpha <= 0) {
      popups.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = pop.alpha;
    ctx.font = '900 20px "Poppins", sans-serif';
    ctx.fillStyle = '#00ffcc';
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }
}

// Start Main Loop
requestAnimationFrame(gameLoop);
