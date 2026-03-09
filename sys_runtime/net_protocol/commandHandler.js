/**
 * KYOTO BOT - COMMAND HANDLER
 * Carregador modular de comandos slash
 * Versão: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes, PermissionFlagsBits } = require('discord.js');
const Logger = require('../vault_manager/logger');
const Config = require('../vault_manager/config');
const AntiCrash = require('../vault_manager/anticrash');
const Database = require('../vault_manager/database');
const ExecutionGuard = require('./executionGuard');

const ADMIN_COMMANDS = new Set([
  'autenticacao',
  'adminhelp',
  'configurar',
  'criar-painel',
  'criar-painel-robux',
  'criar-produto',
  'fluxos-canais',
  'loja',
  'paineiscalculo',
  'refreshpaineis',
  'logs-check',
  'setbranding',
  'setlogs',
  'setvendas'
]);

class CommandHandler {
  constructor(client) {
    this.client = client;
    this.logger = Logger.getInstance();
    this.config = Config.getInstance();
    this.commands = new Collection();
    this.cooldowns = new Collection();
    this.commandLocks = new Map();
    this.auditChannelCache = new Map();
    this.processedInteractionIds = new Map();
    this.execGuard = new ExecutionGuard();
  }

  isAdminCommand(commandName) {
    return ADMIN_COMMANDS.has(commandName);
  }

  hasAdminPermission(interaction) {
    return Boolean(interaction?.member?.permissions?.has(PermissionFlagsBits.Administrator));
  }

  _serializeOptions(options = []) {
    const output = [];

    const walk = (items, prefix = '') => {
      for (const item of items || []) {
        const name = prefix ? `${prefix}.${item.name}` : item.name;
        if (item.options?.length) {
          walk(item.options, name);
        } else {
          output.push(`${name}=${String(item.value)}`);
        }
      }
    };

    walk(options);
    const text = output.join(' | ');
    return text.length > 900 ? `${text.slice(0, 900)}...` : (text || 'sem-opcoes');
  }

  async _resolveAuditChannel(guildId) {
    const cached = this.auditChannelCache.get(guildId);
    if (cached && Date.now() - cached.time < 30000) {
      return cached.id;
    }

    const db = Database.getInstance();
    const row = await db.get('SELECT value FROM cache WHERE key = ? LIMIT 1', [`logs_${guildId}_info`]).catch(() => null);
    const channelId = row?.value || null;
    this.auditChannelCache.set(guildId, { id: channelId, time: Date.now() });
    return channelId;
  }

  async _sendAudit(interaction, phase, extra = '') {
    try {
      if (!interaction.guildId) return;
      const channelId = await this._resolveAuditChannel(interaction.guildId);
      if (!channelId) return;

      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel) return;

      const optionsText = this._serializeOptions(interaction.options?.data || []);
      const msg = [
        `AdminCmd ${phase}`,
        `Comando: /${interaction.commandName}`,
        `Por: ${interaction.user.tag} (${interaction.user.id})`,
        `Canal: ${interaction.channel?.name || 'desconhecido'} (${interaction.channelId || 'n/a'})`,
        `Opcoes: ${optionsText}`,
        extra ? `Detalhe: ${extra}` : ''
      ].filter(Boolean).join('\n');

      await channel.send({ content: `\`\`\`txt\n${msg}\n\`\`\`` }).catch(() => {});
    } catch (_) {
      // Falha de auditoria nunca pode bloquear execucao.
    }
  }

  async loadCommands() {
    const commandsPath = path.join(process.cwd(), 'commands');
    
    if (!fs.existsSync(commandsPath)) {
      this.logger.warn('COMMANDS', 'Commands directory not found');
      return;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
      try {
        delete require.cache[require.resolve(path.join(commandsPath, file))];
        const command = require(path.join(commandsPath, file));
        
        if ('data' in command && 'execute' in command) {
          this.commands.set(command.data.name, command);
          this.logger.debug('COMMANDS', `Loaded: ${command.data.name}`);
        } else {
          this.logger.warn('COMMANDS', `Invalid command structure: ${file}`);
        }
      } catch (error) {
        this.logger.error('COMMANDS', `Failed to load: ${file}`, error);
      }
    }

    this.client.commands = this.commands;
    this.logger.system('Commands loaded', { count: this.commands.size });
  }

  async registerCommands() {
    const rest = new REST({ version: '10' }).setToken(this.config.discord.token);
    const commandData = this.commands.map(cmd => cmd.data.toJSON());

    try {
      this.logger.info('COMMANDS', 'Registering slash commands...');
      
      await rest.put(
        Routes.applicationCommands(this.config.discord.clientId),
        { body: commandData }
      );

      this.logger.system('Slash commands registered', { count: commandData.length });
    } catch (error) {
      this.logger.error('COMMANDS', 'Failed to register commands', error);
    }
  }

  checkCooldown(interaction, command) {
    if (!command.cooldown) return { allowed: true };

    const cooldownKey = `${command.data.name}-${interaction.user.id}`;
    const now = Date.now();
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (this.cooldowns.has(cooldownKey)) {
      const expirationTime = this.cooldowns.get(cooldownKey) + cooldownAmount;
      
      if (now < expirationTime) {
        const timeLeft = (expirationTime - now) / 1000;
        return { 
          allowed: false, 
          timeLeft: timeLeft.toFixed(1)
        };
      }
    }

    this.cooldowns.set(cooldownKey, now);
    setTimeout(() => this.cooldowns.delete(cooldownKey), cooldownAmount);
    
    return { allowed: true };
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const interactionId = interaction.id;
    const nowTs = Date.now();
    const seenAt = this.processedInteractionIds.get(interactionId) || 0;
    if (seenAt && (nowTs - seenAt < 120000)) {
      return;
    }
    this.processedInteractionIds.set(interactionId, nowTs);

    if (this.processedInteractionIds.size > 5000) {
      const cutoff = nowTs - 120000;
      for (const [id, ts] of this.processedInteractionIds.entries()) {
        if (ts < cutoff) this.processedInteractionIds.delete(id);
      }
    }

    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    const lockKey = `${interaction.user.id}:${interaction.commandName}`;
    const now = Date.now();
    const lockTs = this.commandLocks.get(lockKey) || 0;
    if (now - lockTs < 1200) {
      return;
    }
    this.commandLocks.set(lockKey, now);

    if (this.commandLocks.size > 3000) {
      const cutoff = now - 10000;
      for (const [key, ts] of this.commandLocks.entries()) {
        if (ts < cutoff) this.commandLocks.delete(key);
      }
    }

    if (this.isAdminCommand(interaction.commandName) && !this.hasAdminPermission(interaction)) {
      await this._sendAudit(interaction, 'NEGADO', 'usuario sem permissao de administrador');
      return interaction.reply({
        content: 'Este comando e administrativo. Apenas administradores podem executar.',
        flags: 64
      }).catch(() => {});
    }

    const action = interaction.commandName;
    const cooldownMs = Math.max(0, Number(command.cooldown || 2) * 1000);
    const remainingMs = this.execGuard.getRemainingMs('cmd', interaction.user.id, action);
    if (remainingMs > 0) {
      const timeLeft = (remainingMs / 1000).toFixed(1);
      return interaction.reply({
        content: `Aguarde ${timeLeft}s antes de usar este comando novamente.`,
        flags: 64
      }).catch(() => {});
    }

    if (!this.execGuard.acquire('cmd', interaction.user.id, action)) {
      return interaction.reply({
        content: 'Esta acao ja esta em execucao. Aguarde alguns segundos.',
        flags: 64
      }).catch(() => {});
    }

    try {
      this.logger.command(
        interaction.commandName,
        interaction.user.id,
        interaction.guildId
      );

      if (this.isAdminCommand(interaction.commandName)) {
        await this._sendAudit(interaction, 'INICIO');
      }

      if (command.defer) {
        await interaction.deferReply({ flags: command.ephemeral ? 64 : 0 });
      }

      await command.execute(interaction, this.client);

      this.execGuard.setCooldown('cmd', interaction.user.id, action, cooldownMs);

      if (this.isAdminCommand(interaction.commandName)) {
        await this._sendAudit(interaction, 'SUCESSO');
      }
    } catch (error) {
      this.logger.error('COMMANDS', `Error executing: ${interaction.commandName}`, error);
      if (this.isAdminCommand(interaction.commandName)) {
        await this._sendAudit(interaction, 'ERRO', error.message || 'erro sem mensagem');
      }
      
      const errorMessage = {
        content: 'Ocorreu um erro ao executar este comando.',
        flags: 64
      };

      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(errorMessage);
        } else {
          await interaction.reply(errorMessage);
        }
      } catch (replyError) {
        this.logger.error('COMMANDS', 'Failed to send error response', replyError);
      }
    } finally {
      this.execGuard.release('cmd', interaction.user.id, action);
    }
  }
}

module.exports = CommandHandler;
