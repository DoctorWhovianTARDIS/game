import { createServer } from '@render/client-sdk';

const server = createServer();
const room = server.channel('cursor-wars-room');

const BASE_W=1000,BASE_H=700;
const PLAYER_RADIUS=10,BULLET_SPEED=400,TICK=16;

let players={}, bullets=[], bots={};
const BOT_COUNT=10, BOT_NAMES=["Zyra","Rex","Nova","Echo","Luna","Brax","Orin","Tara","Zane","Miko","Vex"];

// Spawn bots
for(let i=0;i<BOT_COUNT;i++){
  const id='bot_'+i;
  bots[id]={id,username:BOT_NAMES[i],color:`hsl(${Math.floor(Math.random()*360)} 80% 60%)`,x:Math.random()*BASE_W,y:Math.random()*BASE_H,angle:Math.random()*Math.PI*2,hp:100,kills:0,alive:true,bot:true};
  players[id]=bots[id];
}

// Handle join
room.subscribe('join', msg => {
  const p = msg.data;
  players[p.id] = {...p,alive:true,kills:0,bot:false,angle:0,x:BASE_W/2,y:BASE_H/2};
  room.publish('state',{players,bullets});
});

// Handle update
room.subscribe('update', msg=>{
  const p = players[msg.data.id];
  if(p && p.alive){p.x=msg.data.x;p.y=msg.data.y;p.angle=msg.data.angle;}
});

// Handle fire
room.subscribe('fire', msg=>{
  const b=msg.data;
  bullets.push({x:b.x,y:b.y,vx:Math.cos(b.angle)*BULLET_SPEED*0.016,vy:Math.sin(b.angle)*BULLET_SPEED*0.016,owner:b.owner});
});

// Game tick
setInterval(()=>{
  // Move bullets and check hits
  bullets.forEach((b,i)=>{
    b.x+=b.vx;b.y+=b.vy;
    for(let id in players){
      const p=players[id];
      if(!p.alive || p.id===b.owner) continue;
      const dx=b.x-p.x,dy=b.y-p.y;
      if(dx*dx+dy*dy<PLAYER_RADIUS*PLAYER_RADIUS){
        p.hp--; bullets.splice(i,1);
        if(p.hp<=0){p.alive=false;if(players[b.owner]) players[b.owner].kills++;}
      }
    }
  });

  // Simple bot AI
  Object.values(bots).forEach(bot=>{
    if(!bot.alive) return;
    bot.x+=Math.cos(bot.angle)*1;
    bot.y+=Math.sin(bot.angle)*1;
    if(Math.random()<0.02) bot.angle=Math.random()*Math.PI*2;
    if(Math.random()<0.01){
      const targets=Object.values(players).filter(p=>p.alive && p.id!==bot.id);
      if(targets.length>0){
        const target=targets[Math.floor(Math.random()*targets.length)];
        bullets.push({
          x:bot.x,
          y:bot.y,
          vx:Math.cos(Math.atan2(target.y-bot.y,target.x-bot.x))*BULLET_SPEED*0.016,
          vy:Math.sin(Math.atan2(target.y-bot.y,target.x-bot.x))*BULLET_SPEED*0.016,
          owner:bot.id
        });
      }
    }
  });

  room.publish('state',{players,bullets});
},TICK);

server.listen(3000,()=>console.log('Render backend running on port 3000'));
