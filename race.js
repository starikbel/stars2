// race.js – клиент для многопользовательской гонки (улучшенная визуализация)

const socket = io('https://race-server.onrender.com', {
  transports: ['websocket'],
  reconnectionAttempts: 5,
  timeout: 10000
});

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
let leaderboards = { race: [], whac: [], snake: [] };

// ===== УЛУЧШЕННАЯ ВИЗУАЛИЗАЦИЯ СТОЛКНОВЕНИЙ =====
let collisionEffects = {}; // { playerId: { flash: 5, direction: 'left/right', strength: 0.5 } }

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

// ===== УЛУЧШЕННАЯ ОБРАБОТКА СТОЛКНОВЕНИЙ =====
socket.on('playerCollision', ({ id1, id2, force }) => {
  const p1 = gameState.players.find(p => p.id === id1);
  const p2 = gameState.players.find(p => p.id === id2);
  
  if (p1 && p2) {
    // Определяем направление отталкивания
    const direction = p1.x < p2.x ? 'right' : 'left';
    
    // Создаём визуальные эффекты для обоих игроков
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
  requestAnimationFrame(raceGameLoop);
});

socket.on('gameOver', ({ winner, score }) => {
  gameState.gameActive = false;
  if (isInGame) {
    updateMusic();
    alert(`🏆 Победитель: ${winner || 'никто'}!\n💰 Очки: ${score}`);
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

// Управление
window.addEventListener('keydown', (e) => {
  if (!gameState.gameActive || !isInGame) return;
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

// Мобильные кнопки
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

// ===== УЛУЧШЕННАЯ ОТРИСОВКА С ЭФФЕКТАМИ СТОЛКНОВЕНИЙ =====
function drawRaceCar(x, y, color, effect = null) {
  const w = 30, h = 40;
  const left = x - w/2;
  const top = y - h/2;

  // Эффект отталкивания - рисуем "след" в направлении удара
  if (effect) {
    // Красная вспышка
    ctx.fillStyle = '#f00';
    ctx.fillRect(left, top, w, h);
    
    // Рисуем направленные полосы
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    
    if (effect.direction === 'left') {
      // Полосы влево
      for (let i = 0; i < 3; i++) {
        const offset = i * 8;
        ctx.beginPath();
        ctx.moveTo(left - 10 - offset, top + 10);
        ctx.lineTo(left - 20 - offset, top + 30);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 - i * 0.2})`;
        ctx.stroke();
      }
    } else {
      // Полосы вправо
      for (let i = 0; i < 3; i++) {
        const offset = i * 8;
        ctx.beginPath();
        ctx.moveTo(left + w + 10 + offset, top + 10);
        ctx.lineTo(left + w + 20 + offset, top + 30);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 - i * 0.2})`;
        ctx.stroke();
      }
    }
    
    // Добавляем искры
    for (let i = 0; i < 5; i++) {
      const sparkX = effect.direction === 'left' ? left - 10 - Math.random() * 20 : left + w + 10 + Math.random() * 20;
      const sparkY = top + 10 + Math.random() * 20;
      ctx.fillStyle = `rgba(255, ${Math.random() * 255}, 0, 0.8)`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 2 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Обычная отрисовка
    ctx.fillStyle = color;
    ctx.fillRect(left, top, w, h);
  }

  // Окно (всегда видно)
  ctx.fillStyle = effect ? '#fff' : '#aaf';
  ctx.fillRect(left + 5, top + 5, w - 10, 12);

  // Колёса
  ctx.fillStyle = '#333';
  ctx.fillRect(left - 2, top + 5, 4, 8);
  ctx.fillRect(left - 2, top + h - 13, 4, 8);
  ctx.fillRect(left + w - 2, top + 5, 4, 8);
  ctx.fillRect(left + w - 2, top + h - 13, 4, 8);

  // Фары (мигают при столкновении)
  ctx.fillStyle = effect ? '#f00' : '#ff0';
  ctx.fillRect(left - 1, top + 15, 2, 5);
  ctx.fillRect(left + w - 1, top + 15, 2, 5);
}

function raceGameLoop() {
  if (!gameState.gameActive || !isInGame) return;
  
  // Обновляем эффекты столкновений
  Object.keys(collisionEffects).forEach(id => {
    collisionEffects[id].flash--;
    if (collisionEffects[id].flash <= 0) {
      delete collisionEffects[id];
    }
  });
  
  updateRaceMovement();
  drawRace();
  requestAnimationFrame(raceGameLoop);
}

function drawRace() {
  ctx.clearRect(0, 0, raceCanvas.width, raceCanvas.height);

  // Дорога
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, raceCanvas.width, raceCanvas.height);

  // Разметка (динамическая, создаёт иллюзию движения)
  ctx.strokeStyle = '#0f0';
  ctx.lineWidth = 2;
  ctx.setLineDash([20, 20]);
  ctx.beginPath();
  ctx.moveTo(raceCanvas.width / 2, 0);
  ctx.lineTo(raceCanvas.width / 2, raceCanvas.height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Препятствия
  ctx.fillStyle = '#f00';
  gameState.obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

  // Игроки (рисуем в порядке от дальних к ближним, чтобы эффекты не перекрывались)
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    // Сначала рисуем тех, у кого нет эффектов
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

    // Ник (с подсветкой при столкновении)
    ctx.fillStyle = effect ? '#ff0' : '#fff';
    ctx.font = effect ? 'bold 12px monospace' : '12px monospace';
    ctx.fillText(p.name.substring(0, 3), drawX - 15, raceCanvas.height - 70);
    
    // Добавляем стрелочку направления при столкновении
    if (effect) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.fillText(effect.direction === 'left' ? '←' : '→', drawX - 5, raceCanvas.height - 90);
    }
  });

  // Дополнительная информация о скорости
  ctx.fillStyle = '#ff0';
  ctx.font = '12px monospace';
  ctx.fillText(`⚡ ${gameState.currentSpeed.toFixed(1)}`, 10, 30);
}

// Загружаем имя из профиля при старте
loadProfileName();
