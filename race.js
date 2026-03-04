// race.js – клиент для многопользовательской гонки

const socket = io('https://race-server.onrender.com'); // замените на адрес вашего сервера

// Элементы DOM
const raceContainer = document.getElementById('raceContainer');
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

// Аудио
const bgMusic = document.getElementById('bgMusic');
const collisionSound = document.getElementById('collisionSound');
const crashSound = document.getElementById('crashSound');

// Состояние игры
let gameState = { players: [], obstacles: [], gameActive: false, width: 600, height: 800 };
let myId = null;
let myX = 300;
let hostId = null;
let isHost = false;
let musicEnabled = true;

// Управление
let leftPressed = false;
let rightPressed = false;

// --- Управление музыкой ---
raceToggleMusic.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    raceToggleMusic.textContent = musicEnabled ? '🔊' : '🔇';
    if (musicEnabled) {
        if (gameState.gameActive) bgMusic.play().catch(e => {});
    } else {
        bgMusic.pause();
    }
});

// --- Сокет-обработчики ---
socket.on('connect', () => console.log('✅ race connect', socket.id));
socket.on('disconnect', () => console.log('❌ race disconnect'));
socket.on('error', (msg) => { console.error('❌ race error:', msg); alert(msg); });

socket.on('init', (data) => {
    console.log('📦 race init', data);
    gameState = data;
    myId = socket.id;
    hostId = data.hostId;
    isHost = (hostId === myId);

    const me = gameState.players.find(p => p.id === myId);
    if (me) myX = me.x;

    raceLobby.style.display = 'block';
    raceGameArea.style.display = 'none';
    updateRacePlayersList();
    raceHostPanel.style.display = isHost ? 'block' : 'none';
});

socket.on('playersUpdate', (players) => {
    gameState.players = players;
    updateRacePlayersList();
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

socket.on('playerCrashed', () => {
    playRaceSound(crashSound);
});

socket.on('countdown', (sec) => {
    console.log('⏱ race countdown', sec);
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
    console.log('🎮 race gameStarted');
    gameState.gameActive = true;
    if (musicEnabled) bgMusic.play().catch(e => {});
    requestAnimationFrame(raceGameLoop);
});

socket.on('gameOver', ({ winner }) => {
    console.log('🏁 race gameOver', winner);
    gameState.gameActive = false;
    bgMusic.pause();
    bgMusic.currentTime = 0;
    alert(`Победитель: ${winner || 'никто'}`);
    raceGameArea.style.display = 'none';
    raceLobby.style.display = 'block';
    ctx.clearRect(0, 0, raceCanvas.width, raceCanvas.height);
});

// --- Интерфейс ---
raceJoinBtn.addEventListener('click', () => {
    const name = racePlayerName.value.trim() || 'Гонщик';
    socket.emit('join', { name, isAdmin: false, password: '' });
});

raceAdminJoinBtn.addEventListener('click', () => {
    const name = racePlayerName.value.trim() || 'Админ';
    const pass = raceAdminPass.value;
    socket.emit('join', { name, isAdmin: true, password: pass });
});

raceStartBtn.addEventListener('click', () => {
    socket.emit('startGame');
});

function updateRacePlayersList() {
    racePlayersList.innerHTML = '<h4>Игроки:</h4>';
    gameState.players.forEach(p => {
        racePlayersList.innerHTML += `<div>${p.name} ${p.id === hostId ? '👑' : ''} ${p.active ? '' : '💀'}</div>`;
    });
}

function playRaceSound(sound) {
    if (!sound) return;
    sound.currentTime = 0;
    sound.play().catch(e => {});
}

// --- Управление ---
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

raceMoveLeft.addEventListener('touchstart', (e) => { e.preventDefault(); leftPressed = true; });
raceMoveLeft.addEventListener('touchend', () => { leftPressed = false; });
raceMoveLeft.addEventListener('mousedown', (e) => { e.preventDefault(); leftPressed = true; });
raceMoveLeft.addEventListener('mouseup', () => { leftPressed = false; });
raceMoveLeft.addEventListener('mouseleave', () => { leftPressed = false; });

raceMoveRight.addEventListener('touchstart', (e) => { e.preventDefault(); rightPressed = true; });
raceMoveRight.addEventListener('touchend', () => { rightPressed = false; });
raceMoveRight.addEventListener('mousedown', (e) => { e.preventDefault(); rightPressed = true; });
raceMoveRight.addEventListener('mouseup', () => { rightPressed = false; });
raceMoveRight.addEventListener('mouseleave', () => { leftPressed = false; });

function updateRaceMovement() {
    if (!gameState.gameActive) return;
    let moved = false;
    if (leftPressed) {
        myX = Math.max(10, myX - 3);
        moved = true;
    }
    if (rightPressed) {
        myX = Math.min(gameState.width - 40, myX + 3);
        moved = true;
    }
    if (moved) {
        socket.emit('move', myX);
        playRaceSound(collisionSound);
    }
}

// --- Отрисовка ---
function drawRaceCar(x, y, color) {
    const w = 30, h = 40;
    const left = x - w/2;
    const top = y - h/2;

    // Кузов
    ctx.fillStyle = color;
    ctx.fillRect(left, top, w, h);

    // Окно
    ctx.fillStyle = '#aaf';
    ctx.fillRect(left + 5, top + 5, w - 10, 12);

    // Колёса
    ctx.fillStyle = '#333';
    ctx.fillRect(left - 2, top + 5, 4, 8);
    ctx.fillRect(left - 2, top + h - 13, 4, 8);
    ctx.fillRect(left + w - 2, top + 5, 4, 8);
    ctx.fillRect(left + w - 2, top + h - 13, 4, 8);

    // Фары
    ctx.fillStyle = '#ff0';
    ctx.fillRect(left - 1, top + 15, 2, 5);
    ctx.fillRect(left + w - 1, top + 15, 2, 5);
}

function raceGameLoop() {
    if (!gameState.gameActive) return;
    updateRaceMovement();
    drawRace();
    requestAnimationFrame(raceGameLoop);
}

function drawRace() {
    ctx.clearRect(0, 0, raceCanvas.width, raceCanvas.height);

    // Дорога
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

    // Препятствия
    ctx.fillStyle = '#f00';
    gameState.obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

    // Игроки
    gameState.players.forEach(p => {
        if (!p.active) return;
        let drawX = p.x;
        if (p.id === myId) drawX = myX;

        const color = `hsl(${p.hue}, 100%, 50%)`;
        drawRaceCar(drawX, raceCanvas.height - 40, color);

        // Ник
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(p.name.substring(0, 3), drawX - 15, raceCanvas.height - 70);
    });
}