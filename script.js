// === Car Pixel Run: movimiento suave + selector de skins ===
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = document.getElementById('score');
  const speedEl = document.getElementById('speed');
  const livesEl = document.getElementById('lives');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const leftBtn = document.getElementById('leftBtn');
  const rightBtn = document.getElementById('rightBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const skinsEl = document.getElementById('skins');

  const W = canvas.width;   // 240
  const H = canvas.height;  // 320

  // Carriles
  const lanes = [W*0.25, W*0.5, W*0.75];
  const laneWidth = W/3;

  // Estado
  let running = false, paused = false, gameOver = false;
  let score = 0, speed = 1, lives = 3;

  // === Skins ===
  const SKINS = {
    sky:    { main:'#49b6ff', shadow:'#2b6bb0', glass:'#bfe9ff', lightR:'#ff6388', lightW:'#ffe7a3' },
    sunset: { main:'#ff7e67', shadow:'#b23c3c', glass:'#ffd1c9', lightR:'#ff5a7a', lightW:'#fff3bf' },
    lime:   { main:'#7cff5b', shadow:'#3b7c2f', glass:'#e3ffd9', lightR:'#ff718b', lightW:'#fff2b3' },
    violet: { main:'#b78cff', shadow:'#6b4fb8', glass:'#e6dbff', lightR:'#ff6e9a', lightW:'#fff1c6' },
    gold:   { main:'#ffc857', shadow:'#b78627', glass:'#fff0c3', lightR:'#ff5e7a', lightW:'#fff2b8' },
    mint:   { main:'#6ef5cf', shadow:'#2aa58d', glass:'#dffff2', lightR:'#ff6a8a', lightW:'#fff4c8' },
  };
  let playerColors = { ...SKINS.sky };

  // Jugador (x se interpola hacia targetX para movimiento suave)
  const player = {
    laneIndex: 1,
    x: lanes[1],
    targetX: lanes[1],
    y: H - 60,
    w: 20, h: 28,
    invuln: 0,
    vx: 0 // velocidad horizontal para “derrape” e inclinación
  };

  // Entidades
  const obstacles = [];
  const coins = [];
  const particles = [];

  // Patrones de carros
  const carPattern = [
    ".....1111.....","...11111111...","..1111111111..","..1221111121..",".122211111221.",
    ".122211111221.",".111111111111.",".111133331111.",".111133331111.",".111111111111.",
    ".122211111221.",".122211111221.","..1221111121..","..1111111111..","...11111111...",".....1555....."
  ];
  const enemyPattern = [
    ".....2222.....","...22222222...","..2222222222..","..2442222242..",".244422222442.",
    ".244422222442.",".222222222222.",".222233332222.",".222233332222.",".222222222222.",
    ".244422222442.",".244422222442.","..2442222242..","..2222222222..","...22222222...",".....4444....."
  ];
  const carW = carPattern[0].length, carH = carPattern.length;

  // Entrada
  window.addEventListener('keydown', (e)=>{
    if (['ArrowLeft','ArrowRight','KeyA','KeyD','Space','KeyR'].includes(e.code)) e.preventDefault();
    if (e.code === 'Space') togglePause();
    if (e.code === 'KeyR') reset(true);
    if (['ArrowLeft','KeyA'].includes(e.code)) moveLane(-1);
    if (['ArrowRight','KeyD'].includes(e.code)) moveLane(1);
  });
  leftBtn.addEventListener('click', ()=> moveLane(-1));
  rightBtn.addEventListener('click', ()=> moveLane(1));
  pauseBtn.addEventListener('click', ()=> togglePause());
  startBtn.addEventListener('click', ()=> start());

  // Selección de skins
  skinsEl.addEventListener('click', (e)=>{
    const btn = e.target.closest('.skin-btn');
    if (!btn) return;
    const key = btn.dataset.skin;
    setSkin(key);
    [...skinsEl.querySelectorAll('.skin-btn')].forEach(b=>b.classList.toggle('selected', b===btn));
  });
  function setSkin(key){
    playerColors = { ...(SKINS[key] || SKINS.sky) };
  }

  function moveLane(dir){
    if (!running || paused) return;
    player.laneIndex = Math.max(0, Math.min(2, player.laneIndex + dir));
    player.targetX = lanes[player.laneIndex];
  }

  function togglePause(){
    if (!running || gameOver) return;
    paused = !paused;
    overlay.classList.toggle('hidden', paused);
    document.getElementById('title').textContent = paused ? 'PAUSA' : 'CAR PIXEL RUN';
    document.getElementById('subtitle').textContent = paused ? 'Pulsa ESPACIO para continuar' : 'Elige un skin, ¡y corre!';
    startBtn.textContent = paused ? 'Reanudar' : 'Jugar';
    if (!paused) lastTime = performance.now();
  }

  function start(){
    if (running && !gameOver){
      paused = false; overlay.classList.add('hidden'); lastTime = performance.now(); return;
    }
    reset(false);
    running = true; paused = false; overlay.classList.add('hidden'); lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function reset(hard=false){
    score = 0; speed = 1; if (hard) lives = 3;
    player.laneIndex = 1; player.x = lanes[1]; player.targetX = lanes[1];
    player.invuln = 0; player.vx = 0;
    obstacles.length = 0; coins.length = 0; particles.length = 0;
    gameOver = false; updateHUD();
    document.getElementById('title').textContent = 'CAR PIXEL RUN';
    document.getElementById('subtitle').textContent = 'Elige un skin, ¡y corre!';
    startBtn.textContent = 'Jugar';
  }

  // Utilidades
  function rect(x,y,w,h,color){ ctx.fillStyle = color; ctx.fillRect(x|0, y|0, w|0, h|0); }
  function drawPattern(pattern, x, y, palette){
    for(let j=0;j<pattern.length;j++){
      for(let i=0;i<pattern[j].length;i++){
        const cell = pattern[j][i]; if (cell === '.') continue;
        let color = '#fff';
        if (cell==='1') color = palette.main;
        else if (cell==='2') color = palette.shadow;
        else if (cell==='3') color = palette.glass;
        else if (cell==='4') color = palette.lightR;
        else if (cell==='5') color = palette.lightW;
        rect(x + i, y + j, 1, 1, color);
      }
    }
  }

  function drawRoad(){
    rect(0,0,W,H,'#0b0d14');
    rect(0,0, (W - laneWidth*3)/2, H, '#121427');
    rect(W - (W - laneWidth*3)/2, 0, (W - laneWidth*3)/2, H, '#121427');

    const dashH = 18, gap = 14;
    const offset = (time * 0.22 * speed) % (dashH+gap);
    for(let i=1;i<3;i++){
      const x = i*laneWidth - 2 + (W - laneWidth*3)/2;
      for(let y=-dashH; y<H + dashH; y += dashH + gap){
        rect(x, y + offset, 4, dashH, '#3f4b7a');
      }
    }
  }

  const ENEMY_SKINS = [
    { main:'#f55f5f', shadow:'#aa2d2d', glass:'#ffd0d0', lightR:'#ff5a7a', lightW:'#fff3bf' },
    { main:'#ffa24f', shadow:'#b85f20', glass:'#ffe1c4', lightR:'#ff6a8a', lightW:'#fff2c2' },
    { main:'#7dd3fc', shadow:'#2563eb', glass:'#cfe8ff', lightR:'#ff6e9a', lightW:'#fff3bf' },
    { main:'#4ade80', shadow:'#15803d', glass:'#d7ffe7', lightR:'#ff5a7a', lightW:'#fff3bf' },
  ];

  function spawnObstacle(){
    const lane = (Math.random()*3)|0;
    obstacles.push({
      laneIndex: lane,
      x: lanes[lane] - carW/2,
      y: -carH - 8,
      w: carW, h: carH,
      vy: 45 + Math.random()*25,
      palette: ENEMY_SKINS[(Math.random()*ENEMY_SKINS.length)|0]
    });
  }
  function spawnCoin(){
    const lane = (Math.random()*3)|0;
    coins.push({ laneIndex: lane, x: lanes[lane] - 5, y: -12, w: 10, h: 10, vy: 40 + Math.random()*20 });
  }
  function drawCoin(c){
    rect(c.x, c.y, 10, 10, '#ffd84d');
    rect(c.x, c.y, 10, 1, '#f9e17a');
    rect(c.x, c.y+9, 10, 1, '#f9e17a');
    rect(c.x, c.y, 1, 10, '#f9e17a');
    rect(c.x+9, c.y, 1, 10, '#f9e17a');
    rect(c.x+2, c.y+2, 2, 2, '#fff7c2');
  }

  function collide(a,b){
    return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
  }

  function damage(){
    if (player.invuln > 0) return;
    lives--; player.invuln = 90; shakeTime = 10;
    for(let i=0;i<28;i++){
      particles.push({
        x: player.x - carW/2 + Math.random()*carW,
        y: player.y + Math.random()*carH,
        vx: (Math.random()2-1)*1.8, vy: (Math.random()-2),
        life: 40 + Math.random()*20, color: i%2 ? '#fca5a5' : '#fecaca'
      });
    }
    if (lives <= 0){
      gameOver = true; running = false; overlay.classList.remove('hidden');
      document.getElementById('title').textContent = 'GAME OVER';
      document.getElementById('subtitle').textContent = Puntuación: ${score};
      startBtn.textContent = 'Reiniciar (R)';
    }
    updateHUD();
  }

  function updateHUD(){
    scoreEl.textContent = score;
    speedEl.textContent = ${speed.toFixed(1)}x;
    livesEl.textContent = lives;
  }

  // Shake
  let shakeTime = 0;
  function applyShake(){
    if (shakeTime <= 0) return;
    shakeTime--;
    const dx = (Math.random()*2-1)*2, dy = (Math.random()*2-1)*2;
    ctx.setTransform(1,0,0,1,dx,dy);
  }

  // Bucle
  let lastTime = 0, time = 0;
  function loop(ts){
    if (!running || paused) return;
    const dt = Math.min(1/30, (ts - lastTime)/1000);
    lastTime = ts; time += dt;

    // Spawns
    if (Math.random() < 0.02 * speed) spawnObstacle();
    if (Math.random() < 0.015 * speed) spawnCoin();

    // Velocidad progresiva
    speed += 0.0009;
    const worldVy = 50 * speed;

    // Movimiento suave del jugador hacia targetX (lerp)
    const prevX = player.x;
    const LERP = 0.22; // factor de suavidad (más alto = más rápido)
    player.x += (player.targetX - player.x) * LERP;
    player.vx = player.x - prevX; // usado para “derrape” e inclinación

    // Actualizar entidades
    for (const o of obstacles) o.y += (o.vy + worldVy) * dt;
    for (const c of coins) c.y += (c.vy + worldVy * 0.9) * dt;

    // Limpieza
    while (obstacles.length && obstacles[0].y > H + 40){ obstacles.shift(); score += 5; }
    while (coins.length && coins[0].y > H + 20) coins.shift();

    // Colisiones
    const playerBox = { x: player.x - carW/2, y: player.y, w: carW, h: carH };
    for (let i=obstacles.length-1; i>=0; i--){
      const o = obstacles[i];
      if (collide(playerBox, o)){ obstacles.splice(i,1); damage(); }
    }
    for (let i=coins.length-1; i>=0; i--){
      const c = coins[i];
      if (collide(playerBox, c)){
        coins.splice(i,1); score += 10; speed += 0.03;
        for(let k=0;k<12;k++){
          particles.push({
            x: c.x+5, y:c.y+5, vx:(Math.random()2-1).8, vy:(Math.random()*-1.2),
            life:30+Math.random()*20, color:k%2?'#ffe066':'#fff1a8'
          });
        }
        updateHUD();
      }
    }

    // Partículas
    for (let i=particles.length-1;i>=0;i--){
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life--; if (p.life<=0) particles.splice(i,1);
    }
    if (player.invuln>0) player.invuln--;

    // Render
    ctx.setTransform(1,0,0,1,0,0);
    drawRoad();

    for (const c of coins) drawCoin(c);
    for (const o of obstacles) drawPattern(enemyPattern, o.x, o.y, o.palette);

    // “Inclinación”: desplazamos unas filas según la velocidad horizontal
    // (truco pixel para simular tilt sin rotar el canvas).
    const tilt = Math.max(-2, Math.min(2, player.vx * 40)); // -2..2 px
    if (player.invuln%10 < 7){
      // dibuja el coche con un offset por fila
      for(let j=0;j<carPattern.length;j++){
        const row = carPattern[j];
        const rowOffset = (tilt>0) ? Math.floor((j/ carH) * tilt) : Math.ceil((j/ carH) * tilt);
        for(let i=0;i<row.length;i++){
          const cell = row[i]; if (cell==='.') continue;
          let color='#fff';
          if (cell==='1') color = playerColors.main;
          else if (cell==='2') color = playerColors.shadow;
          else if (cell==='3') color = playerColors.glass;
          else if (cell==='4') color = playerColors.lightR;
          else if (cell==='5') color = playerColors.lightW;
          rect((player.x - carW/2 + i + rowOffset), (player.y + j), 1, 1, color);
        }
      }
    }

    // Partículas
    for (const p of particles) rect(p.x, p.y, 2, 2, p.color);

    applyShake();

    // Marcador
    score += (dt * 8 * speed) | 0;
    updateHUD();

    if (!gameOver) requestAnimationFrame(loop);
  }

  // Overlay visible al inicio
  overlay.classList.remove('hidden');

  document.addEventListener('keydown', (e)=>{
    if (e.code === 'KeyR'){
      reset(true);
      if (!running){
        running = true; gameOver = false; paused=false; overlay.classList.add('hidden'); lastTime = performance.now(); requestAnimationFrame(loop);
      }
    }
  });
})();