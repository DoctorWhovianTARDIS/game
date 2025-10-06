// backend/server.js
import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

const players = {}; // {id: {x,y,angle,username,color,hp,kills}}
const bullets = []; // {x,y,vx,vy,owner,created}

const TICK = 16; // ms
const BULLET_SPEED = 400; // px/sec
const BULLET_LIFETIME = 3000; // ms
const PLAYER_RADIUS = 12;
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

function broadcastGameState() {
  const state = { players, bullets };
  const msg = JSON.stringify({ type: 'state', data: state });
  wss.clients.forEach(client => {
    if(client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

function update(dt) {
  // Move bullets
  const now = Date.now();
  for(const b of bullets) {
    b.x += b.vx*dt;
    b.y += b.vy*dt;

    // Collision with players
    for(const id in players) {
      if(id === b.owner) continue; // skip owner
      const p = players[id];
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if(Math.sqrt(dx*dx+dy*dy) < PLAYER_RADIUS) {
        p.hp -= 20;
        if(p.hp <=0){
          players[b.owner].kills = (players[b.owner].kills||0)+1;
          p.hp = 100;
          p.x = Math.random()*CANVAS_WIDTH;
          p.y = Math.random()*CANVAS_HEIGHT;
        }
        b.hit = true;
      }
    }

    if(now - b.created > BULLET_LIFETIME) b.hit = true;
  }
  // Remove hit bullets
  for(let i=bullets.length-1;i>=0;i--) if(bullets[i].hit) bullets.splice(i,1);
}

setInterval(()=>{
  const dt = TICK/1000;
  update(dt);
  broadcastGameState();
}, TICK);

wss.on('connection', ws => {
  const id = uuidv4();
  ws.id = id;
  players[id] = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2, angle:0, username:'Player', color:'hsl('+Math.floor(Math.random()*360)+' 80% 60%)', hp:100, kills:0 };

  ws.send(JSON.stringify({ type:'init', id }));

  ws.on('message', msg => {
    try {
      const data = JSON.parse(msg);
      if(data.type === 'update') {
        const p = players[id];
        if(!p) return;
        p.x = Math.max(0, Math.min(CANVAS_WIDTH, data.x));
        p.y = Math.max(0, Math.min(CANVAS_HEIGHT, data.y));
        p.angle = data.angle;
        p.username = data.username;
        p.color = data.color;

        if(data.shots) {
          for(const s of data.shots) {
            bullets.push({
              x: s.x,
              y: s.y,
              vx: Math.cos(s.angle)*BULLET_SPEED*TICK/1000,
              vy: Math.sin(s.angle)*BULLET_SPEED*TICK/1000,
              owner: id,
              created: Date.now()
            });
          }
        }
      }
    } catch(e){console.error(e);}
  });

  ws.on('close', ()=>{ delete players[id]; });
});

console.log('WebSocket server running on port', process.env.PORT || 8080);
