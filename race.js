// race.js – клиент для многопользовательской гонки (исправленная версия)

const socket = io('https://race-server-o3u6.onrender.com/', {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  timeout: 10000
});

// --- DOM элементы ---
const raceLobby = document.getElementById('raceLobby');
const raceGameArea = document.getElementById('raceGameArea');
const raceCanvas = document.getElementById('raceCanvas');
const ctx = raceCanvas.getContext('2d');
const raceCountdown = document.getElementById('raceCountdown');
const racePlayersList = document.getElementById('racePlayersList');
const raceHostPanel = document.getElementById('raceHostPanel');
const raceStartBtn = document.getElementById('raceStartBtn');
const raceMoveLeft = document.getElementById('raceMoveLeft');
const raceMoveRight = document.getElementById('raceMoveRight');
const racePlayerName = document.getElementById('racePlayerName');
const raceJoinBtn = document.getElementById('raceJoinBtn');
const raceAdminPass = document.getElementById('raceAdminPass');
const raceAdminJoinBtn = document.getElementById('raceAdminJoinBtn');
const raceToggleMusic = document.getElementById('raceToggleMusic');
const closeGameBtn = document.getElementById('closeGameBtn');

// --- Аудио ---
const bgMusic = document.getElementById('bgMusic');
const collisionSound = document.getElementById('collisionSound');
const crashSound = document.getElementById('crashSound');

// --- Состояние игры ---
let gameState = { players: [], obstacles: [], gameActive: false, width: 600, height: 800 };
let myId = null;
let myX = 300;
let hostId = null;
let isHost = false;
let musicEnabled = true;
let audioUnlocked = false;
let leaderboards = { race: [], whac: [], snake: [] };
let collisionFlash = {};

// --- Флаги управления ---
let leftPressed = false;
let rightPressed = false;

// --- Троттлинг отправки move ---
let lastMoveTime = 0;
const MOVE_THROTTLE = 50;

// --- Загрузка имени из профиля ---
function loadProfileName() {
  const profileName = localStorage.getItem('profileName') || 'Игрок';
  if (racePlayerName) racePlayerName.value = profileName;
}

// --- Сохранение имени в профиль ---
function saveProfileName(name) {
  localStorage.setItem('profileName', name);
}

// --- Обновление таблицы лидеров в лобби ---
function updateLeaderboardDisplay() {
  if (!racePlayersList) return;
  let html = '<h4>Игроки в комнате:</h4>';
  gameState.players.forEach(p => {
    html += `<div>${p.name} ${p.id === hostId ? '👑' : ''} ${p.active ? '' : '💀'}</div>`;
  });
  
  if (leaderboards.race && leaderboards.race.length > 0) {
    html += '<h4 style="margin-top:15px;">🏆 Лучшие гонщики:</h4>';
    leaderboards.race.slice(0, 5).forEach((entry, i) => {
      html += `<div>${i+1}. ${entry.name} — ${entry.score} очков</div>`;
    });
  }
  racePlayersList.innerHTML = html;
}

// --- Разблокировка аудио ---
function unlockAudio() {
  if (audioUnlocked) return;
  const actx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  gain.gain.value = 0.01;
  osc.connect(gain);
  gain.connect(actx.destination);
  osc.start();
  osc.stop(actx.currentTime + 0.01);
  audioUnlocked = true;
}

// --- Управление музыкой ---
if (raceToggleMusic) {
  raceToggleMusic.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    raceToggleMusic.textContent = musicEnabled ? '🔊' : '🔇';
    if (musicEnabled && gameState.gameActive && bgMusic) {
      bgMusic.play().catch(e => console.log('Не удалось запустить музыку:', e));
    } else if (!musicEnabled && bgMusic) {
      bgMusic.pause();
    }
    unlockAudio();
  });
}

// --- Безопасное воспроизведение звуков ---
function playRaceSound(sound) {
  if (!musicEnabled || !sound) return;
  sound.currentTime = 0;
  sound.play().catch(e => console.log('Ошибка звука:', e));
}

// --- Выход из игры при закрытии модалки ---
function exitRace() {
  if (myId) {
    socket.emit('leave');
  }
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
  raceGameArea.style.display = 'none';
  raceLobby.style.display = 'block';
  gameState.gameActive = false;
  ctx.clearRect(0, 0, raceCanvas.width, raceCanvas.height);
  leftPressed = false;
  rightPressed = false;
  myId = null;
}

if (closeGameBtn) {
  closeGameBtn.addEventListener('click', exitRace);
}

// --- Сокет-обработчики ---
socket.on('connect', () => console.log('✅ race connect', socket.id));
socket.on('disconnect', () => console.log('❌ race disconnect'));
socket.on('error', (msg) => { console.error('❌ race error:', msg); alert(msg); });

socket.on('leaderboards', (data) => {
  leaderboards = data;
  updateLeaderboardDisplay();
});

socket.on('init', (data) => {
  gameState = data;
  myId = socket.id;
  hostId = data.hostId;
  isHost = (hostId === myId);

  const me = gameState.players.find(p => p.id === myId);
  if (me) myX = me.x;

  raceLobby.style.display = 'block';
  raceGameArea.style.display = 'none';
  updateLeaderboardDisplay();
  raceHostPanel.style.display = isHost ? 'block' : 'none';
});

socket.on('playersUpdate', (players) => {
  gameState.players = players;
  updateLeaderboardDisplay();
});

socket.on('hostStatus', (status) => {
  isHost = status;
  raceHostPanel.style.display = isHost ? 'block' : 'none';
});

socket.on('obstacles', (obs) => {
  gameState.obstacles = obs;
});

socket.on('playerMoved', ({ id, x }) => {
  const p = gameState.players.find(p => p.id === id);
  if (p) p.x = x;
});

socket.on('playerCollision', ({ id1, id2 }) => {
  collisionFlash[id1] = 5;
  collisionFlash[id2] = 5;
  playRaceSound(collisionSound);
});

socket.on('playerCrashed', () => {
  playRaceSound(crashSound);
});

socket.on('countdown', (sec) => {
  if (raceCountdown) {
    if (raceLobby.style.display !== 'none') {
      raceLobby.style.display = 'none';
      raceGameArea.style.display = 'block';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, raceCanvas.width, raceCanvas.height);
    }
    raceCountdown.style.display = 'block';
    raceCountdown.textContent = sec;
    if (sec === 0) {
      raceCountdown.textContent = 'GO!';
      setTimeout(() => raceCountdown.style.display = 'none', 1000);
    }
  }
});

socket.on('gameStarted', () => {
  gameState.gameActive = true;
  unlockAudio();
  if (musicEnabled && bgMusic) {
    bgMusic.play().catch(e => console.log('Не удалось воспроизвести музыку:', e));
  }
  requestAnimationFrame(raceGameLoop);
});

socket.on('gameOver', ({ winner, score }) => {
  gameState.gameActive = false;
  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
  alert(`🏆 Победитель: ${winner || 'никто'}!\n💰 Очки: ${score}`);
  // Не переключаем интерфейс, даём серверу обновить список игроков
});

// --- Интерфейс лобби ---
if (raceJoinBtn) {
  raceJoinBtn.addEventListener('click', () => {
    const name = racePlayerName.value.trim() || 'Гонщик';
    saveProfileName(name);
    socket.emit('join', { name, isAdmin: false, password: '' });
    unlockAudio();
  });
}

if (raceAdminJoinBtn) {
  raceAdminJoinBtn.addEventListener('click', () => {
    const name = racePlayerName.value.trim() || 'Админ';
    const pass = raceAdminPass.value;
    socket.emit('join', { name, isAdmin: true, password: pass });
    unlockAudio();
  });
}

if (raceStartBtn) {
  raceStartBtn.addEventListener('click', () => {
    socket.emit('startGame');
    unlockAudio();
  });
}

// --- Управление с клавиатуры ---
window.addEventListener('keydown', (e) => {
  if (!gameState.gameActive) return;
  if (e.key === 'a' || e.key === 'ArrowLeft') {
    leftPressed = true;
    e.preventDefault();
  } else if (e.key === 'd' || e.key === 'ArrowRight') {
    rightPressed = true;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'a' || e.key === 'ArrowLeft') leftPressed = false;
  if (e.key === 'd' || e.key === 'ArrowRight') rightPressed = false;
});

// --- Мобильные кнопки ---
function handleTouchStart(e, direction) {
  e.preventDefault();
  if (direction === 'left') leftPressed = true;
  else rightPressed = true;
}

function handleTouchEnd(e, direction) {
  e.preventDefault();
  if (direction === 'left') leftPressed = false;
  else rightPressed = false;
}

if (raceMoveLeft) {
  raceMoveLeft.addEventListener('touchstart', (e) => handleTouchStart(e, 'left'));
  raceMoveLeft.addEventListener('touchend', (e) => handleTouchEnd(e, 'left'));
  raceMoveLeft.addEventListener('touchcancel', (e) => handleTouchEnd(e, 'left'));
  raceMoveLeft.addEventListener('mousedown', (e) => { e.preventDefault(); leftPressed = true; });
  raceMoveLeft.addEventListener('mouseup', () => { leftPressed = false; });
  raceMoveLeft.addEventListener('mouseleave', () => { leftPressed = false; });
}

if (raceMoveRight) {
  raceMoveRight.addEventListener('touchstart', (e) => handleTouchStart(e, 'right'));
  raceMoveRight.addEventListener('touchend', (e) => handleTouchEnd(e, 'right'));
  raceMoveRight.addEventListener('touchcancel', (e) => handleTouchEnd(e, 'right'));
  raceMoveRight.addEventListener('mousedown', (e) => { e.preventDefault(); rightPressed = true; });
  raceMoveRight.addEventListener('mouseup', () => { rightPressed = false; });
  raceMoveRight.addEventListener('mouseleave', () => { rightPressed = false; });
}

// --- Обновление движения с троттлингом ---
function updateRaceMovement() {
  if (!gameState.gameActive) return;
  let moved = false;
  const now = performance.now();
  if (leftPressed) {
    myX = Math.max(10, myX - 3);
    moved = true;
  }
  if (rightPressed) {
    myX = Math.min(gameState.width - 40, myX + 3);
    moved = true;
  }
  if (moved && now - lastMoveTime > MOVE_THROTTLE) {
    socket.emit('move', myX);
    lastMoveTime = now;
  }
}

// --- Отрисовка ---
function drawRaceCar(x, y, color, flash = false) {
  const w = 30, h = 40;
  const left = x - w/2;
  const top = y - h/2;

  ctx.fillStyle = flash ? '#f00' : color;
  ctx.fillRect(left, top, w, h);

  ctx.fillStyle = flash ? '#fff' : '#aaf';
  ctx.fillRect(left + 5, top + 5, w - 10, 12);

  ctx.fillStyle = '#333';
  ctx.fillRect(left - 2, top + 5, 4, 8);
  ctx.fillRect(left - 2, top + h - 13, 4, 8);
  ctx.fillRect(left + w - 2, top + 5, 4, 8);
  ctx.fillRect(left + w - 2, top + h - 13, 4, 8);

  ctx.fillStyle = '#ff0';
  ctx.fillRect(left - 1, top + 15, 2, 5);
  ctx.fillRect(left + w - 1, top + 15, 2, 5);
}

function raceGameLoop() {
  if (!gameState.gameActive) return;
  
  Object.keys(collisionFlash).forEach(id => {
    collisionFlash[id]--;
    if (collisionFlash[id] <= 0) delete collisionFlash[id];
  });
  
  updateRaceMovement();
  drawRace();
  requestAnimationFrame(raceGameLoop);
}

function drawRace() {
  ctx.clearRect(0, 0, raceCanvas.width, raceCanvas.height);

  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, raceCanvas.width, raceCanvas.height);

  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(raceCanvas.width / 2, 0);
  ctx.lineTo(raceCanvas.width / 2, raceCanvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#f00';
  gameState.obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

  gameState.players.forEach(p => {
    if (!p.active) return;
    let drawX = p.x;
    if (p.id === myId) drawX = myX;

    const flash = !!collisionFlash[p.id];
    const color = `hsl(${p.hue}, 100%, 50%)`;
    drawRaceCar(drawX, raceCanvas.height - 40, color, flash);

    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(p.name.substring(0, 3), drawX - 15, raceCanvas.height - 70);
  });
}

// --- Загружаем имя из профиля при старте ---
loadProfileName();
