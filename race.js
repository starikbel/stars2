// race.js – клиент для многопользовательской гонки
console.log('🚦 race.js загружен');

// === ВАШ НОВЫЙ АДРЕС СЕРВЕРА ===
const SERVER_URL = 'race-server-production.up.railway.app';

const socket = io(SERVER_URL, {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  timeout: 10000
});

console.log('🔄 Подключаюсь к серверу:', SERVER_URL);

// DOM элементы
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
const raceShootBtn = document.getElementById('raceShootBtn');
const racePlayerName = document.getElementById('racePlayerName');
const raceJoinBtn = document.getElementById('raceJoinBtn');
const raceAdminPass = document.getElementById('raceAdminPass');
const raceAdminJoinBtn = document.getElementById('raceAdminJoinBtn');
const raceToggleMusic = document.getElementById('raceToggleMusic');
const closeGameBtn = document.getElementById('closeGameBtn');
const raceExitBtn = document.getElementById('raceExitBtn');
const raceSpeedDisplay = document.getElementById('raceSpeedDisplay');

// Аудио
const bgMusic = document.getElementById('bgMusic');
const collisionSound = document.getElementById('collisionSound');
const crashSound = document.getElementById('crashSound');
const shootSound = document.getElementById('shootSound');

// Состояние игры
let gameState = { 
  players: [], 
  obstacles: [], 
  gameActive: false, 
  width: 600, 
  height: 800,
  currentSpeed: 2
};
let myId = null;
let myX = 300;
let hostId = null;
let isHost = false;
let musicEnabled = true;
let audioUnlocked = false;
let leaderboards = { race: [], whac: [], snake: [], guess: [] };

// Переменные для стрельбы
let bullets = [];
let bulletSpeed = 8;
let lastShootTime = 0;
const SHOOT_DELAY = 300;

// Визуальные эффекты
let collisionEffects = {};

// Флаги управления
let leftPressed = false;
let rightPressed = false;

// Троттлинг
let lastMoveTime = 0;
const MOVE_THROTTLE = 50;

// Загрузка имени из профиля
function loadProfileName() {
  const profileName = localStorage.getItem('profileName') || 'Игрок';
  if (racePlayerName) racePlayerName.value = profileName;
}

// Разблокировка аудио
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

// Управление музыкой
function updateMusic() {
  if (!isInGame) {
    if (bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
    return;
  }
  
  if (musicEnabled && gameState.gameActive && bgMusic) {
    bgMusic.play().catch(e => console.log('Не удалось запустить музыку:', e));
  } else if (bgMusic) {
    bgMusic.pause();
  }
}

if (raceToggleMusic) {
  raceToggleMusic.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    raceToggleMusic.textContent = musicEnabled ? '🔊' : '🔇';
    updateMusic();
    unlockAudio();
  });
}

// Безопасное воспроизведение звуков
function playRaceSound(sound) {
  if (!musicEnabled || !sound || !isInGame) return;
  sound.currentTime = 0;
  sound.play().catch(e => console.log('Ошибка звука:', e));
}

let isInGame = false;

// Выход из игры
function exitRace() {
  if (myId) {
    socket.emit('leave');
  }
  isInGame = false;
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
  bullets = [];
  myId = null;
}

if (closeGameBtn) {
  closeGameBtn.addEventListener('click', exitRace);
}

if (raceExitBtn) {
  raceExitBtn.addEventListener('click', exitRace);
}

// Обновление таблицы лидеров
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
  
  if (raceSpeedDisplay && gameState.gameActive) {
    html += `<div style="margin-top:10px; color:#ff0;">⚡ Скорость: ${gameState.currentSpeed.toFixed(1)}</div>`;
  }
  
  racePlayersList.innerHTML = html;
}

// Сокет-обработчики
socket.on('connect', () => console.log('✅ race connect', socket.id));
socket.on('disconnect', () => console.log('❌ race disconnect'));
socket.on('error', (msg) => { console.error('❌ race error:', msg); alert(msg); });

socket.on('leaderboards', (data) => {
  leaderboards = data;
  updateLeaderboardDisplay();
});

socket.on('speedUpdate', (speed) => {
  gameState.currentSpeed = speed;
  updateLeaderboardDisplay();
});

socket.on('gameClosed', (reason) => {
  if (isInGame) {
    alert(reason || 'Игра завершена');
    exitRace();
  }
});

socket.on('init', (data) => {
  gameState = data;
  myId = socket.id;
  hostId = data.hostId;
  isHost = (hostId === myId);
  isInGame = true;

  const me = gameState.players.find(p => p.id === myId);
  if (me) myX = me.x;

  raceLobby.style.display = 'block';
  raceGameArea.style.display = 'none';
  updateLeaderboardDisplay();
  raceHostPanel.style.display = isHost ? 'block' : 'none';
  updateMusic();
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

// Обработка пуль
socket.on('bulletFired', ({ x, y, ownerId, bulletId }) => {
  bullets.push({
    id: bulletId,
    x: x,
    y: y,
    ownerId: ownerId,
    active: true
  });
});

socket.on('bulletHit', ({ bulletId, obstacleId }) => {
  bullets = bullets.filter(b => b.id !== bulletId);
  gameState.obstacles = gameState.obstacles.filter(o => o.id !== obstacleId);
});

socket.on('playerCollision', ({ id1, id2, force }) => {
  const p1 = gameState.players.find(p => p.id === id1);
  const p2 = gameState.players.find(p => p.id === id2);
  
  if (p1 && p2) {
    const direction = p1.x < p2.x ? 'right' : 'left';
    
    collisionEffects[id1] = {
      flash: 12,
      direction: direction === 'right' ? 'right' : 'left',
      strength: Math.min(force / 10, 1)
    };
    
    collisionEffects[id2] = {
      flash: 12,
      direction: direction === 'right' ? 'left' : 'right',
      strength: Math.min(force / 10, 1)
    };
    
    playRaceSound(collisionSound);
  }
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
  updateMusic();
  bullets = [];
  requestAnimationFrame(raceGameLoop);
});

socket.on('gameOver', ({ winner, score, reason }) => {
  gameState.gameActive = false;
  if (isInGame) {
    updateMusic();
    let message = `🏁 Игра окончена!\n💰 Очки: ${score}`;
    if (winner) {
      message = `🏆 Победитель: ${winner}!\n💰 Очки: ${score}`;
    } else if (reason) {
      message = `📉 Игра окончена: ${reason}\n💰 Очки: ${score}`;
    }
    alert(message);
  }
  exitRace();
});

// Интерфейс лобби
if (raceJoinBtn) {
  raceJoinBtn.addEventListener('click', () => {
    const name = racePlayerName.value.trim() || 'Гонщик';
    localStorage.setItem('profileName', name);
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

// Функция стрельбы
function shoot() {
  if (!gameState.gameActive || !isInGame) return;
  
  const now = Date.now();
  if (now - lastShootTime < SHOOT_DELAY) return;
  
  lastShootTime = now;
  
  const bulletId = Math.random().toString(36).substring(2, 10);
  const bulletX = myX;
  const bulletY = raceCanvas.height - 70;
  
  bullets.push({
    id: bulletId,
    x: bulletX,
    y: bulletY,
    ownerId: myId,
    active: true
  });
  
  socket.emit('shoot', {
    x: bulletX,
    y: bulletY,
    bulletId: bulletId
  });
  
  playRaceSound(shootSound);
}

// Управление с клавиатуры
window.addEventListener('keydown', (e) => {
  if (!gameState.gameActive || !isInGame) return;
  
  switch(e.key) {
    case 'a':
    case 'ArrowLeft':
      leftPressed = true;
      e.preventDefault();
      break;
    case 'd':
    case 'ArrowRight':
      rightPressed = true;
      e.preventDefault();
      break;
    case ' ':
    case 'Space':
      shoot();
      e.preventDefault();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch(e.key) {
    case 'a':
    case 'ArrowLeft':
      leftPressed = false;
      break;
    case 'd':
    case 'ArrowRight':
      rightPressed = false;
      break;
  }
});

// Мобильные кнопки
function handleTouchStart(e, action) {
  e.preventDefault();
  switch(action) {
    case 'left':
      leftPressed = true;
      break;
    case 'right':
      rightPressed = true;
      break;
    case 'shoot':
      shoot();
      break;
  }
}

function handleTouchEnd(e, action) {
  e.preventDefault();
  switch(action) {
    case 'left':
      leftPressed = false;
      break;
    case 'right':
      rightPressed = false;
      break;
  }
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

if (raceShootBtn) {
  raceShootBtn.addEventListener('touchstart', (e) => handleTouchStart(e, 'shoot'));
  raceShootBtn.addEventListener('mousedown', (e) => { e.preventDefault(); shoot(); });
}

// Обновление движения
function updateRaceMovement() {
  if (!gameState.gameActive || !isInGame) return;
  let moved = false;
  const now = performance.now();
  if (leftPressed) {
    myX = Math.max(10, myX - 4);
    moved = true;
  }
  if (rightPressed) {
    myX = Math.min(gameState.width - 40, myX + 4);
    moved = true;
  }
  if (moved && now - lastMoveTime > MOVE_THROTTLE) {
    socket.emit('move', myX);
    lastMoveTime = now;
  }
}

// Обновление положения пуль
function updateBullets() {
  if (!gameState.gameActive) return;
  
  bullets.forEach(bullet => {
    bullet.y -= bulletSpeed;
  });
  
  bullets = bullets.filter(b => b.y > 0);
  
  bullets.forEach(bullet => {
    gameState.obstacles.forEach(obstacle => {
      if (bullet.active && 
          bullet.x > obstacle.x - 10 && 
          bullet.x < obstacle.x + obstacle.w + 10 &&
          bullet.y > obstacle.y - 10 &&
          bullet.y < obstacle.y + obstacle.h + 10) {
        
        bullet.active = false;
        
        socket.emit('bulletHit', {
          bulletId: bullet.id,
          obstacleId: obstacle.id
        });
      }
    });
  });
  
  bullets = bullets.filter(b => b.active);
}

// Отрисовка с эффектами
function drawRaceCar(x, y, color, effect = null) {
  const w = 30, h = 40;
  const left = x - w/2;
  const top = y - h/2;

  if (effect) {
    ctx.fillStyle = '#f00';
    ctx.fillRect(left, top, w, h);
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    
    if (effect.direction === 'left') {
      for (let i = 0; i < 3; i++) {
        const offset = i * 8;
        ctx.beginPath();
        ctx.moveTo(left - 10 - offset, top + 10);
        ctx.lineTo(left - 20 - offset, top + 30);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 - i * 0.2})`;
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const offset = i * 8;
        ctx.beginPath();
        ctx.moveTo(left + w + 10 + offset, top + 10);
        ctx.lineTo(left + w + 20 + offset, top + 30);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 - i * 0.2})`;
        ctx.stroke();
      }
    }
    
    for (let i = 0; i < 5; i++) {
      const sparkX = effect.direction === 'left' ? left - 10 - Math.random() * 20 : left + w + 10 + Math.random() * 20;
      const sparkY = top + 10 + Math.random() * 20;
      ctx.fillStyle = `rgba(255, ${Math.random() * 255}, 0, 0.8)`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(left, top, w, h);
  }

  ctx.fillStyle = effect ? '#fff' : '#aaf';
  ctx.fillRect(left + 5, top + 5, w - 10, 12);

  ctx.fillStyle = '#333';
  ctx.fillRect(left - 2, top + 5, 4, 8);
  ctx.fillRect(left - 2, top + h - 13, 4, 8);
  ctx.fillRect(left + w - 2, top + 5, 4, 8);
  ctx.fillRect(left + w - 2, top + h - 13, 4, 8);

  ctx.fillStyle = effect ? '#f00' : '#ff0';
  ctx.fillRect(left - 1, top + 15, 2, 5);
  ctx.fillRect(left + w - 1, top + 15, 2, 5);
}

function raceGameLoop() {
  if (!gameState.gameActive || !isInGame) return;
  
  Object.keys(collisionEffects).forEach(id => {
    collisionEffects[id].flash--;
    if (collisionEffects[id].flash <= 0) {
      delete collisionEffects[id];
    }
  });
  
  updateRaceMovement();
  updateBullets();
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

  bullets.forEach(b => {
    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x, b.y + 15);
    ctx.stroke();
  });

  const sortedPlayers = [...gameState.players].sort((a, b) => {
    const aHasEffect = collisionEffects[a.id] ? 1 : 0;
    const bHasEffect = collisionEffects[b.id] ? 1 : 0;
    return aHasEffect - bHasEffect;
  });

  sortedPlayers.forEach(p => {
    if (!p.active) return;
    let drawX = p.x;
    if (p.id === myId) drawX = myX;

    const effect = collisionEffects[p.id];
    const color = `hsl(${p.hue}, 100%, 50%)`;
    drawRaceCar(drawX, raceCanvas.height - 40, color, effect);

    ctx.fillStyle = effect ? '#ff0' : '#fff';
    ctx.font = effect ? 'bold 12px monospace' : '12px monospace';
    ctx.fillText(p.name.substring(0, 3), drawX - 15, raceCanvas.height - 70);
    
    if (effect) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(effect.direction === 'left' ? '←' : '→', drawX - 5, raceCanvas.height - 90);
    }
  });

  ctx.fillStyle = '#ff0';
  ctx.font = '12px monospace';
  ctx.fillText(`⚡ ${gameState.currentSpeed.toFixed(1)}`, 10, 30);
  ctx.fillText(`🔫 ${Math.floor((Date.now() - lastShootTime) / 100)}/3`, 10, 50);
}

loadProfileName();
