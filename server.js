import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);
app.use(express.static("public"));

const baseW = 1000;
const baseH = 700;
const TURN_SPEED = Math.PI / 90;

const players = {};
const bullets = [];
const bots = {};
const namePool = ["Zyra","Rex","Nova","Echo","Luna","Brax","Orin","Tara","Zane","Miko","Vex","Dara","Ira","Kiro","Lexa","Nero","Sora","Trix","Kova","Pyra"];

function randName() {
  return namePool[Math.floor(Math.random() * namePool.length)];
}

// create bots
for (let i = 0; i < 9; i++) {
  bots["bot" + i] = {
    id: "bot" + i,
    username: randName(),
    color: `hsl(${Math.random() * 360} 80% 60%)`,
    x: Math.random() * baseW,
    y: Math.random() * baseH,
    angle: Math.random() * Math.PI * 2,
    hp: 100,
    kills: 0,
  };
}

io.on("connection", (socket) => {
  socket.on("join", (username) => {
    players[socket.id] = {
      id: socket.id,
      username,
      color: `hsl(${Math.random() * 360} 80% 60%)`,
      x: Math.random() * baseW,
      y: Math.random() * baseH,
      angle: 0,
      hp: 100,
      kills: 0,
    };
    socket.emit("init", { id: socket.id, players, bots });
    io.emit("updatePlayers", { players, bots });
  });

  socket.on("move", (data) => {
    const p = players[socket.id];
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.angle = data.angle;
  });

  socket.on("shoot", (b) => {
    bullets.push({ ...b, owner: socket.id });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updatePlayers", { players, bots });
  });
});

// update loop
setInterval(() => {
  // move bullets
  for (const b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
  }
  // collision
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const targets = { ...players, ...bots };
    for (const id in targets) {
      if (id === b.owner) continue;
      const t = targets[id];
      if (!t) continue;
      const dx = t.x - b.x;
      const dy = t.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < 10) {
        t.hp -= 10;
        bullets.splice(i, 1);
        if (t.hp <= 0) {
          if (players[b.owner]) players[b.owner].kills++;
          if (bots[b.owner]) bots[b.owner].kills++;
          if (players[id]) delete players[id];
          if (bots[id]) bots[id].hp = 100;
        }
        break;
      }
    }
  }
  io.emit("state", { players, bots, bullets });
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
