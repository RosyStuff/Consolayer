const mineflayer = require('mineflayer');
const readline = require('readline');

let botNames = []; 
const activeBots = {};
let currentHost = null;
let currentPort = 25565;
let pvpInterval = null;
let pvpActive = false;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function printHelp() {
  console.log("\n=================== UNIVERSAL 21-COMMAND CONTROLLER ===================");
  console.log("  1. addtotalbots | 2. join     | 3. leave    | 4. register | 5. login");
  console.log("  6. command      | 7. say      | 8. select   | 9. clickslot| 10. items");
  console.log("  11. pvp         | 12. jump    | 13. list    | 14. exit    | 15. sayone");
  console.log("  16. look        | 17. crouch  | 18. uncrouch| 19. coords  | 20. players");
  console.log("  21. moveto [x] [y] [z] [howlong]");
  console.log("=======================================================================\n");
}

printHelp();

rl.on('line', (line) => {
  const input = line.trim();
  if (!input) return;

  const args = input.split(' ');
  const command = args[0].toLowerCase();

  // 1. COMMAND: addtotalbots
  if (command === 'addtotalbots') {
    const total = parseInt(args[1]);
    const names = args.slice(2);
    if (isNaN(total) || names.length === 0) return console.log("[ERROR] Syntax: addtotalbots [total] [name1] ...");

    botNames = [];
    for (let i = 0; i < total; i++) {
      const baseName = names[i] || names[names.length - 1] || 'Bot';
      botNames.push(names[i] ? baseName : `${baseName}_${i + 1}`);
    }
    console.log(`[SYSTEM] Configured ${total} bots: [${botNames.join(', ')}]`);
  }

  // 2. COMMAND: join
  else if (command === 'join') {
    if (botNames.length === 0) return console.log("[ERROR] Run 'addtotalbots' first.");
    const serverAddress = args[1];
    if (!serverAddress) return console.log("[ERROR] Missing address.");
    
    if (serverAddress.includes(':')) {
      const parts = serverAddress.split(':');
      currentHost = parts[0];
      currentPort = parseInt(parts[1]) || 25565;
    } else {
      currentHost = serverAddress;
      currentPort = 25565; 
    }
    
    console.log(`\n[SYSTEM] Deploying bots to: ${currentHost}:${currentPort}...`);
    disconnectAll();
    setTimeout(() => botNames.forEach(name => startBot(name)), 1000);
  } 

  // 3. COMMAND: leave
  else if (command === 'leave') {
    console.log("[SYSTEM] Disconnecting everyone...");
    clearInterval(pvpInterval);
    pvpActive = false;
    disconnectAll();
  }

  // 4. COMMAND: register
  else if (command === 'register') {
    const regArgs = args.slice(1).join(' '); 
    if (!regArgs) return console.log("[ERROR] Syntax: register [arguments]");
    forEachBot(b => b.chat(`/register ${regArgs}`));
  }

  // 5. COMMAND: login
  else if (command === 'login') {
    const loginArgs = args.slice(1).join(' ');
    if (!loginArgs) return console.log("[ERROR] Syntax: login [arguments]");
    forEachBot(b => b.chat(`/login ${loginArgs}`));
  }

  // 6. COMMAND: command
  else if (command === 'command') {
    const cmdArgs = args.slice(1).join(' ');
    if (!cmdArgs) return console.log("[ERROR] Syntax: command [text]");
    forEachBot(b => b.chat(`/${cmdArgs}`));
  }

  // 7. COMMAND: say
  else if (command === 'say') {
    const msg = args.slice(1).join(' ');
    if (!msg) return console.log("[ERROR] Message cannot be blank.");
    forEachBot(b => b.chat(msg));
  } 

  // 8. COMMAND: select
  else if (command === 'select') {
    const slot = parseInt(args[1]);
    if (isNaN(slot) || slot < 0 || slot > 8) return console.log("[ERROR] Slot must be 0-8.");
    forEachBot(b => { b.setQuickBarSlot(slot); b.activateItem(); });
  }

  // 9. COMMAND: clickslot
  else if (command === 'clickslot') {
    const slotID = parseInt(args[1]);
    forEachBot(b => { if (b.currentWindow) b.clickWindow(slotID, 0, 0); });
  }

  // 10. COMMAND: items
  else if (command === 'items') {
    const primaryBot = activeBots[botNames[0]];
    if (!primaryBot || !primaryBot.currentWindow) return console.log("[WARN] No layout open.");
    primaryBot.currentWindow.slots.forEach((item, idx) => {
      if (item) console.log(`  Slot [${idx}]: ${item.displayName}`);
    });
  }

  // 11. COMMAND: pvp
  else if (command === 'pvp') {
    pvpActive = !pvpActive;
    if (pvpActive) {
      console.log("\n[⚔️ COMBAT] SWARM ATTACK PROTOCOL ACTIVATED!");
      pvpInterval = setInterval(() => {
        forEachBot(bot => {
          if (!bot.entity) return;
          let closestTarget = null;
          let closestDistance = Infinity;
          for (const entityId in bot.entities) {
            const entity = bot.entities[entityId];
            if (entity.type === 'player' && entity.username && !botNames.includes(entity.username) && entity.username !== bot.username) {
              const dist = bot.entity.position.distanceTo(entity.position);
              if (closestDistance - dist > 0) { closestDistance = dist; closestTarget = entity; }
            }
          }
          if (closestTarget) {
            bot.lookAt(closestTarget.position.offset(0, closestTarget.height, 0));
            bot.setControlState('sprint', true); bot.setControlState('forward', true);
            if (4 - closestDistance > 0) bot.attack(closestTarget);
          } else { bot.setControlState('forward', false); bot.setControlState('sprint', false); }
        });
      }, 200);
    } else {
      console.log("\n[🛡️ COMBAT] Standing down.");
      clearInterval(pvpInterval);
      forEachBot(bot => { bot.setControlState('forward', false); bot.setControlState('sprint', false); });
    }
  }

  // 12. COMMAND: jump
  else if (command === 'jump') {
    forEachBot(b => {
      b.setControlState('jump', true);
      setTimeout(() => b.setControlState('jump', false), 400);
    });
  }

  // 13. COMMAND: list
  else if (command === 'list') {
    botNames.forEach(name => {
      console.log(`  ${name}: ${activeBots[name] ? 'ONLINE' : 'OFFLINE'}`);
    });
  }

  // 14. COMMAND: exit
  else if (command === 'exit') {
    console.log("[SYSTEM] Closing control suite cleanly...");
    clearInterval(pvpInterval); disconnectAll(); rl.close(); process.exit(0);
  }

  // 15. COMMAND: sayone
  else if (command === 'sayone') {
    const targetBot = args[1];
    const targetMsg = args.slice(2).join(' ');
    if (!activeBots[targetBot] || !targetMsg) return console.log("[ERROR] Syntax: sayone [botname] [message]");
    activeBots[targetBot].chat(targetMsg);
  }

  // 16. COMMAND: look
  else if (command === 'look') {
    const yaw = parseFloat(args[1]) * (Math.PI / 180);
    const pitch = parseFloat(args[2]) * (Math.PI / 180);
    if (isNaN(yaw) || isNaN(pitch)) return console.log("[ERROR] Syntax: look [yaw] [pitch]");
    forEachBot(b => b.look(yaw, pitch, true));
  }

  // 17. COMMAND: crouch
  else if (command === 'crouch') {
    forEachBot(b => b.setControlState('sneak', true));
    console.log("[SYSTEM] Crouching enabled across all bots.");
  }

  // 18. COMMAND: uncrouch
  else if (command === 'uncrouch') {
    forEachBot(b => b.setControlState('sneak', false));
    console.log("[SYSTEM] Crouching disabled across all bots.");
  }

  // 19. COMMAND: coords
  else if (command === 'coords') {
    console.log("\n=== CLUSTER COORDINATES ===");
    forEachBot(b => {
      if (b.entity) {
        console.log(`  ${b.username}: X: ${b.entity.position.x.toFixed(1)} | Y: ${b.entity.position.y.toFixed(1)} | Z: ${b.entity.position.z.toFixed(1)}`);
      }
    });
    console.log("===========================\n");
  }

  // 20. COMMAND: players
  else if (command === 'players') {
    const primary = activeBots[botNames[0]];
    if (!primary) return console.log("[ERROR] Connect bots first.");
    console.log("\n=== SERVER TAB LIST ===");
    console.log(Object.keys(primary.players).join(', '));
    console.log("=======================\n");
  }

  // --- 21. NEW COMMAND: moveto [x] [y] [z] [howlong] ---
  else if (command === 'moveto') {
    const x = parseFloat(args[1]);
    const y = parseFloat(args[2]);
    const z = parseFloat(args[3]);
    const duration = parseInt(args[4]);

    if (isNaN(x) || isNaN(y) || isNaN(z) || isNaN(duration)) {
      return console.log("[ERROR] Syntax: moveto [x] [y] [z] [howlong_ms]");
    }

    // Convert vector object elements for calculation tracking
    const targetVec = new (require('vec3'))(x, y, z);

    forEachBot(bot => {
      if (!bot.entity) return;

      // 1. Snap bots face toward coordinates orientation anchor
      bot.lookAt(targetVec);

      // 2. Trigger engines forward
      bot.setControlState('forward', true);
      console.log(`[WALK] ${bot.username} marching to vector [${x}, ${y}, ${z}] for ${duration}ms.`);

      // 3. Cut engines automatically when the time parameter finishes
      setTimeout(() => {
        bot.setControlState('forward', false);
        console.log(`[WALK] ${bot.username} reached target destination interval. Standing down.`);
      }, duration);
    });
  }
});

function startBot(name) {
  const bot = mineflayer.createBot({
    host: currentHost,
    port: currentPort,
    username: name,
    version: '1.20.1' 
  });

  activeBots[name] = bot;
  bot.on('spawn', () => console.log(`[+] ${name} spawned.`));
  
  bot.on('windowOpen', (window) => {
    if (bot.username === botNames[0]) console.log(`\n[GUI ALERT] Menu opened: "${window.title}"`);
  });

  bot.on('chat', (username, message) => {
    if (bot.username === botNames[0]) console.log(`[CHAT] <${username}> ${message}`);
  });

  bot.on('end', () => delete activeBots[name]);
  bot.on('error', (err) => console.error(`[!] ${name} Error:`, err.message));
}

function forEachBot(action) {
  botNames.forEach(name => { if (activeBots[name]) action(activeBots[name]); });
}

function disconnectAll() {
  botNames.forEach(name => {
    if (activeBots[name]) {
      activeBots[name].removeAllListeners('end');
      activeBots[name].quit();
      delete activeBots[name];
    }
  });
}
