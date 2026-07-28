(() => {
  const canvas = document.querySelector('#game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const scoreEl = document.querySelector('#score');
  const highScoreEl = document.querySelector('#high-score');
  const energyEl = document.querySelector('#energy');
  const shieldEl = document.querySelector('#shield');
  const statusEl = document.querySelector('#game-status');
  const startButton = document.querySelector('#start-game');
  const pauseButton = document.querySelector('#pause-game');
  const restartPrompt = document.querySelector('#restart-prompt');
  const restartYes = document.querySelector('#restart-yes');
  const restartNo = document.querySelector('#restart-no');
  const storedHigh = Number.parseInt(localStorage.getItem('worm-high-score') || '0', 10);
  const state = {
    cols: 24, rows: 14, cell: 30, worm: [], direction: { x: 1, y: 0 }, nextDirection: { x: 1, y: 0 },
    food: [], bullets: [], enemy: { x: 4, y: 2, direction: 1, drop: 0 }, score: 0, energy: 10, shield: 3,
    highScore: Number.isFinite(storedHigh) ? storedHigh : 0, timer: null, bulletTimer: null, running: false, paused: false,
    level: 0, tickMs: 260
  };
  highScoreEl.textContent = String(state.highScore);

  const same = (a, b) => a.x === b.x && a.y === b.y;
  const randomFreeCell = () => {
    const taken = [...state.worm, ...state.food, state.enemy, ...state.bullets];
    for (let tries = 0; tries < 100; tries += 1) {
      const cell = { x: Math.floor(Math.random() * state.cols), y: Math.floor(Math.random() * state.rows) };
      if (!taken.some((item) => same(item, cell))) return cell;
    }
    return { x: 18, y: 10 };
  };
  const updateHud = () => {
    scoreEl.textContent = String(state.score);
    highScoreEl.textContent = String(state.highScore);
    energyEl.textContent = String(state.energy);
    shieldEl.textContent = `${state.shield}/3`;
  };
  const setStatus = (message) => { statusEl.textContent = message; };
  const stopTimers = () => {
    if (state.timer) window.clearInterval(state.timer);
    if (state.bulletTimer) window.clearInterval(state.bulletTimer);
    state.timer = null;
    state.bulletTimer = null;
  };
  const addFood = (count) => {
    while (state.food.length < count) state.food.push({ ...randomFreeCell(), level: Math.min(5, state.food.length + 1) });
  };
  const reset = () => {
    stopTimers();
    state.worm = [{ x: 5, y: 7 }, { x: 4, y: 7 }, { x: 3, y: 7 }];
    state.direction = { x: 1, y: 0 }; state.nextDirection = { x: 1, y: 0 }; state.food = []; state.bullets = [];
    state.enemy = { x: 5, y: 2, direction: 1, drop: 0 }; state.score = 0; state.energy = 10; state.shield = 3; state.level = 0; state.paused = false;
    addFood(5); updateHud(); draw();
  };
  const drawCell = (x, y, color, radius = 0) => {
    const px = x * state.cell; const py = y * state.cell;
    ctx.fillStyle = color;
    if (!radius) { ctx.fillRect(px + 2, py + 2, state.cell - 4, state.cell - 4); return; }
    ctx.beginPath(); ctx.arc(px + state.cell / 2, py + state.cell / 2, radius, 0, Math.PI * 2); ctx.fill();
  };
  const drawFood = (food) => {
    const px = food.x * state.cell; const py = food.y * state.cell; const centerX = px + state.cell / 2; const centerY = py + state.cell / 2;
    const size = 9 + food.level;
    ctx.fillStyle = ['#6fe7ff', '#79d7ff', '#91a8ff', '#c28cff', '#ff9bd0'][food.level - 1];
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - size);
    ctx.lineTo(centerX + size, centerY + size);
    ctx.lineTo(centerX - size, centerY + size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#080a18';
    ctx.font = '700 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(food.level), centerX, centerY + 3);
  };
  const drawWormHead = (segment) => {
    const centerX = segment.x * state.cell + state.cell / 2; const centerY = segment.y * state.cell + state.cell / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(Math.atan2(state.direction.y, state.direction.x));
    ctx.fillStyle = '#f4f7ff'; ctx.strokeStyle = '#82c9ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#080a18';
    ctx.beginPath(); ctx.arc(4, -4, 1.8, 0, Math.PI * 2); ctx.arc(4, 4, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#080a18'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, -2); ctx.quadraticCurveTo(7, 4, 2, 2); ctx.stroke();
    ctx.restore();
  };
  const drawEnemyStar = (enemy) => {
    const centerX = enemy.x * state.cell + state.cell / 2; const centerY = enemy.y * state.cell + state.cell / 2;
    const outer = 11; const inner = 5; const points = 5;
    ctx.save(); ctx.translate(centerX, centerY); ctx.fillStyle = '#ff668d'; ctx.beginPath();
    for (let index = 0; index < points * 2; index += 1) {
      const radius = index % 2 === 0 ? outer : inner; const angle = -Math.PI / 2 + (index * Math.PI) / points;
      const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#ffd1e0'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  };
  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#090d24'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < 36; i += 1) drawCell((i * 17) % state.cols, (i * 7) % state.rows, i % 3 ? 'rgba(130,201,255,.24)' : '#82c9ff', i % 3 ? 1 : 2);
    state.food.forEach(drawFood);
    state.bullets.forEach((bullet) => drawCell(bullet.x, bullet.y, '#ffca7a', 3));
    drawEnemyStar(state.enemy);
    state.worm.forEach((segment, index) => index === 0 ? drawWormHead(segment) : drawCell(segment.x, segment.y, '#82c9ff', 8));
    if (state.shield > 0 && state.running) { ctx.strokeStyle = `rgba(124, 220, 255, ${.18 + state.shield * .12})`; ctx.lineWidth = 3; ctx.strokeRect((state.worm[0].x - 1) * state.cell, (state.worm[0].y - 1) * state.cell, state.cell * 3, state.cell * 3); }
  };
  const setDirection = (direction) => {
    const vectors = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const next = vectors[direction];
    if (!next || (next.x + state.direction.x === 0 && next.y + state.direction.y === 0)) return;
    state.nextDirection = next;
  };
  const fire = () => {
    const dx = state.worm[0].x - state.enemy.x; const dy = state.worm[0].y - state.enemy.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    state.bullets.push({ x: state.enemy.x, y: state.enemy.y, vx: dx / length, vy: dy / length });
  };
  const moveEnemy = () => {
    const nextX = state.enemy.x + state.enemy.direction;
    if (nextX < 1 || nextX >= state.cols - 1) { state.enemy.direction *= -1; state.enemy.y = Math.min(state.rows - 2, state.enemy.y + 1); }
    else state.enemy.x = nextX;
  };
  const isInside = (cell) => cell.x >= 0 && cell.x < state.cols && cell.y >= 0 && cell.y < state.rows;
  const isWormCell = (cell) => state.worm.some((segment) => same(segment, cell));
  const turnAtBoundary = (head) => {
    if (isInside(head)) return head;
    const atHorizontalEdge = head.x < 0 || head.x >= state.cols;
    const candidates = atHorizontalEdge
      ? (state.worm[0].y < state.rows - 1 ? [{ x: 0, y: 1 }, { x: 0, y: -1 }] : [{ x: 0, y: -1 }, { x: 0, y: 1 }])
      : (state.worm[0].x < state.cols - 1 ? [{ x: 1, y: 0 }, { x: -1, y: 0 }] : [{ x: -1, y: 0 }, { x: 1, y: 0 }]);
    const next = candidates.map((direction) => ({ direction, head: { x: state.worm[0].x + direction.x, y: state.worm[0].y + direction.y } })).find((candidate) => isInside(candidate.head) && !isWormCell(candidate.head));
    if (!next) return null;
    state.direction = next.direction; state.nextDirection = next.direction;
    return next.head;
  };
  const hit = () => {
    if (state.shield > 0) { state.shield -= 1; setStatus(`방패가 충격을 흡수했습니다. 남은 방패: ${state.shield}/3`); }
    else { state.energy -= 1; setStatus(`직접 피격! 에너지 ${state.energy}/10`); }
    updateHud();
    if (state.energy <= 0) end(false);
  };
  const tick = () => {
    if (!state.running || state.paused) return;
    state.direction = state.nextDirection;
    const proposedHead = { x: state.worm[0].x + state.direction.x, y: state.worm[0].y + state.direction.y };
    const head = turnAtBoundary(proposedHead);
    if (!head || isWormCell(head)) return end(false);
    state.worm.unshift(head);
    const foodIndex = state.food.findIndex((food) => same(food, head));
    if (foodIndex >= 0) { const food = state.food.splice(foodIndex, 1)[0]; state.score += food.level; state.level += 1; setStatus(`레벨 ${food.level} 먹이 획득! 지렁이가 성장했습니다.`); if (!state.food.length) return end(true); }
    else state.worm.pop();
    state.bullets = state.bullets.map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx, y: bullet.y + bullet.vy })).filter((bullet) => bullet.x >= 0 && bullet.x < state.cols && bullet.y >= 0 && bullet.y < state.rows);
    const bulletHit = state.bullets.some((bullet) => Math.round(bullet.x) === head.x && Math.round(bullet.y) === head.y);
    if (bulletHit) { state.bullets = state.bullets.filter((bullet) => !(Math.round(bullet.x) === head.x && Math.round(bullet.y) === head.y)); hit(); }
    moveEnemy(); draw();
  };
  const end = (won) => { state.running = false; state.paused = false; stopTimers(); if (state.score > state.highScore) { state.highScore = state.score; localStorage.setItem('worm-high-score', String(state.highScore)); } updateHud(); draw(); setStatus(won ? 'MISSION COMPLETE — 이제 여자친구를 만나러 갑니다.' : 'GAME OVER — 다시 시작하겠습니까?'); restartPrompt.hidden = won; startButton.textContent = 'RESTART'; pauseButton.disabled = true; };
  const start = () => { restartPrompt.hidden = true; reset(); state.running = true; startButton.textContent = 'RESTART'; pauseButton.disabled = false; state.timer = window.setInterval(tick, state.tickMs); state.bulletTimer = window.setInterval(fire, 5000); setStatus('탐사 시작 — 방향키, WASD 또는 터치 버튼으로 이동하세요.'); draw(); };
  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', () => { if (!state.running) return; state.paused = !state.paused; pauseButton.textContent = state.paused ? 'RESUME' : 'PAUSE'; setStatus(state.paused ? '일시정지 — RESUME을 눌러 계속하세요.' : '탐사 재개'); draw(); });
  restartYes.addEventListener('click', start);
  restartNo.addEventListener('click', () => { restartPrompt.hidden = true; setStatus('탐사는 종료되었습니다. START를 누르면 다시 시작합니다.'); });
  document.querySelectorAll('[data-direction]').forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
  document.addEventListener('keydown', (event) => { const keys = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' }; if (keys[event.key]) { event.preventDefault(); setDirection(keys[event.key]); } if (event.key === ' ' && state.running) pauseButton.click(); });
  reset();
})();
