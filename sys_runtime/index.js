/**
 * KYOTO BOT - ENTERPRISE CORE
 * Sistema otimizado sem web panel
 * Anti-crash inteligente com auto-repair
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { Client, Collection, GatewayIntentBits, Events, Options } = require('discord.js');

const CommandHandler = require('./net_protocol/commandHandler');
const EventHandler = require('./net_protocol/eventHandler');
const InteractionHandler = require('./net_protocol/interactionHandler');
const ButtonHandlers = require('./net_protocol/buttonHandlers');

const EconomyService = require('./math_core/economy');
const HealthMonitor = require('./math_core/healthMonitor');

const AntiCrash = require('./vault_manager/anticrash');
const Config = require('./vault_manager/config');
const Logger = require('./vault_manager/logger');
const Database = require('./vault_manager/database');

AntiCrash.init();

const logger = Logger.getInstance();
const config = Config.getInstance();
const RUNTIME_LOCK_PATH = path.join(process.cwd(), '.kyoto-bot.lock');

function acquireSingleInstanceLock() {
  try {
    const fd = fs.openSync(RUNTIME_LOCK_PATH, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
    return true;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      try {
        const rawPid = fs.readFileSync(RUNTIME_LOCK_PATH, 'utf8').trim();
        const runningPid = Number(rawPid);

        if (Number.isFinite(runningPid) && runningPid > 0) {
          try {
            process.kill(runningPid, 0);
            logger.error('INIT', `Outra instancia do bot ja esta em execucao (PID ${runningPid}).`, new Error('INSTANCE_LOCKED'));
            return false;
          } catch (_) {
            // lock antigo/stale: remove e tenta novamente
            fs.unlinkSync(RUNTIME_LOCK_PATH);
            return acquireSingleInstanceLock();
          }
        }

        fs.unlinkSync(RUNTIME_LOCK_PATH);
        return acquireSingleInstanceLock();
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

function releaseSingleInstanceLock() {
  try {
    if (!fs.existsSync(RUNTIME_LOCK_PATH)) return;
    const rawPid = fs.readFileSync(RUNTIME_LOCK_PATH, 'utf8').trim();
    if (String(process.pid) === rawPid) {
      fs.unlinkSync(RUNTIME_LOCK_PATH);
    }
  } catch (_) {
    // Nunca bloquear encerramento por lock file.
  }
}

if (!acquireSingleInstanceLock()) {
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration
  ],
  makeCache: Options.cacheWithLimits({
    MessageManager: 100,
    PresenceManager: 0,
    GuildMemberManager: {
      maxSize: 200,
      keepOverLimit: (member) => member.id === member.client.user.id
    },
    UserManager: 300
  }),
  sweepers: {
    messages: {
      interval: 120,
      lifetime: 600
    },
    users: {
      interval: 300,
      filter: () => (user) => !user.bot
    }
  }
});

client.commands = new Collection();

const commandHandler = new CommandHandler(client);
const eventHandler = new EventHandler(client);
const interactionHandler = new InteractionHandler(client);
const economy = EconomyService.getInstance();

client.commandHandler = commandHandler;
client.interactionHandler = interactionHandler;
client.economy = economy;

let buttonHandlers = null;
let healthMonitor = null;

async function initialize() {
  logger.system('Kyoto Bot starting...');

  try {
    const db = Database.getInstance();
    await db.initialize();
    logger.system('Database OK');
    await economy.syncFromDatabase();
    logger.system('Economy settings synced');

    await commandHandler.loadCommands();
    await eventHandler.loadEvents();
    buttonHandlers = new ButtonHandlers(interactionHandler, client);
    client.buttonHandlers = buttonHandlers;
    logger.system('Handlers OK');

    healthMonitor = new HealthMonitor(client);
    healthMonitor.start();
    logger.system('Health Monitor started');

    logger.system('Connecting to Discord...');
    const token = process.env.DISCORD_TOKEN;
    if (!token || token.length < 20) {
      throw new Error(`Token invalido ou ausente no process.env (comprimento: ${token?.length || 0})`);
    }
    await client.login(token);

  } catch (error) {
    logger.error('INIT', 'Startup failed', error);
    process.exit(1);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  logger.system(`Online as ${readyClient.user.tag} | ${readyClient.guilds.cache.size} servers`);
  console.log(`\n✅ ${readyClient.user.tag} online`);

  await commandHandler.registerCommands();
});

process.on('SIGINT', async () => {
  logger.system('Shutting down...');
  if (healthMonitor) healthMonitor.stop();
  client.destroy();
  releaseSingleInstanceLock();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.system('Shutting down...');
  if (healthMonitor) healthMonitor.stop();
  client.destroy();
  releaseSingleInstanceLock();
  process.exit(0);
});

process.on('exit', () => {
  releaseSingleInstanceLock();
});

initialize();
