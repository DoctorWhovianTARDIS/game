import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ======= GAME STATE =======
const baseW = 1000, baseH = 700;
const TURN_SPEED = Math.PI / 90;
const BULLET_SPEED = 12000;
const PLAYER_RADIUS = 10;

let players = {};
let bullets = [];
const namePool = ["Zyra","Rex","Nova","Echo","Luna","Brax","Orin","Tara","Zane","Miko","Vex","Dara","Ira","Kiro","Lexa","Nero","Sora","Trix","Kova","Pyra"];

// make 10 bots total always present
function randName() {
  return namePool[Math.floor(Math.random() * namePool.length)];
}

function spawnBots() {
  for (let i = 0; i < 10; i++) {
    const id = "bot" + i;
    if (!players[id]) {
      players[id] = {
        id,
        username: randName(),
        color: `hsl(${Math.random() * 360} 80% 60%)`,
        x: Math.random() * baseW,
        y: Math.random() * baseH,
        angle: Math.random() * Math.PI * 2,
        hp: 100,
        kills: 0,
        bot: true,
        target: null
      };
    }
  }
}
spawnBots();

// handle bots’ AI
function updateBots(dt) {
  for (const id in players) {
    const bot = players[id];
    if (!bot.bot) continue;

    if (!bot.target || Math.hypot(bot.target.x - bot.x, bot.target.y - bot.y) < 10)
      bot.target = { x: Math.random() * baseW, y: Math.random() * baseH };

    const dx = bot.target.x - bot.x, dy = bot.target.y - bot.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      bot.x += (dx / dist) * 50 * dt;
      bot.y += (dy / dist) * 50 * dt;
    }

    const others = Object.values(players).filter(p => p.id !== id);
    if (others.length) {
      const target = others[Math.floor(Math.random() * others.length)];
      const desired = Math.atan2(target.y - bot.y, target.x - bot.x);
      let diff = ((desired - bot.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (diff > TURN_SPEED) diff = TURN_SPEED;
      if (diff < -TURN_SPEED) diff = -TURN_SPEED;
      bot.angle += diff;
      if (Math.random() < 0.02) spawnBullet(bot.id, bot.x, bot.y, bot.angle);
    }
  }
}

function spawnBullet(owner, x, y, angle) {
  const vx = Math.cos(angle) * BULLET_SPEED * (16 / 1000);
  const vy = Math.sin(angle) * BULLET_SPEED * (16 / 1000);
  bullets.push({ x, y, vx, vy, owner });
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  bullets = bullets.filter(b => b.x > -20 && b.x < baseW + 20 && b.y > -20 && b.y < baseH + 20);

  // collisions
  for (const b of bullets) {
    for (const id in players) {
      const p = players[id];
      if (p.id === b.owner || p.hp <= 0) continue;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (Math.hypot(dx, dy) < PLAYER_RADIUS) {
        p.hp -= 1;
        if (p.hp <= 0) {
          if (players[b.owner]) players[b.owner].kills++;
        }
      }
    }
  }
}

function tick() {
  const dt = 16 / 1000;
  updateBots(dt);
  updateBullets(dt);
  io.emit("state", { players, bullets });
}
setInterval(tick, 16);

// ======= SOCKETS =======
io.on("connection", socket => {
  console.log("Player connected:", socket.id);

  socket.on("join", name => {
    players[socket.id] = {
      id: socket.id,
      username: name || "Player",
      color: `hsl(${Math.random() * 360} 80% 60%)`,
      x: Math.random() * baseW,
      y: Math.random() * baseH,
      angle: 0,
      hp: 100,
      kills: 0,
      bot: false
    };
    io.emit("state", { players, bullets });
  });

  socket.on("update", data => {
    const p = players[socket.id];
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.angle = data.angle;
  });

  socket.on("shoot", () => {
    const p = players[socket.id];
    if (!p) return;
    spawnBullet(p.id, p.x, p.y, p.angle);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

server.listen(PORT, () => console.log("Server running on port", PORT));
