/**
 * KYOTO BOT - INTERACTION CREATE EVENT
 * Processa todas as interações (comandos, botões, menus, modais)
 * Versão: 3.0.0
 */

const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commandCache = new Map();
const userThrottle = new Map();
const interactionDedup = new Map();
const THROTTLE_MS = 300;

function canProcessInteraction(interaction) {
  if (!interaction?.user) return false;

  const key = `${interaction.user.id}:${interaction.type}`;
  const now = Date.now();
  const last = userThrottle.get(key) || 0;

  if (now - last < THROTTLE_MS) {
    return false;
  }

  userThrottle.set(key, now);

  if (userThrottle.size > 5000) {
    const cutoff = now - 60000;
    for (const [entryKey, timestamp] of userThrottle) {
      if (timestamp < cutoff) userThrottle.delete(entryKey);
    }
  }

  return true;
}

function shouldSkipDuplicate(interaction) {
  const id = interaction?.id;
  if (!id) return false;

  const now = Date.now();
  const existing = interactionDedup.get(id);
  if (existing && now - existing < 60000) {
    return true;
  }

  interactionDedup.set(id, now);

  if (interactionDedup.size > 5000) {
    const cutoff = now - 60000;
    for (const [key, timestamp] of interactionDedup) {
      if (timestamp < cutoff) interactionDedup.delete(key);
    }
  }

  return false;
}

function getCachedCommand(commandPath) {
  if (commandCache.has(commandPath)) {
    return commandCache.get(commandPath);
  }

  const command = require(commandPath);
  commandCache.set(commandPath, command);
  return command;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction || interaction.user?.bot) return;
    if (!canProcessInteraction(interaction)) return;
    if (shouldSkipDuplicate(interaction)) return;
    
    if (interaction.isChatInputCommand()) {
      if (client.commandHandler?.handleInteraction) {
        try {
          await client.commandHandler.handleInteraction(interaction);
        } catch (error) {
          console.error(`Erro ao executar comando ${interaction.commandName}:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'Erro ao executar este comando.', 
              flags: 64 
            }).catch(() => {});
          }
        }
        return;
      }

      const commandName = interaction.commandName;
      const commandPath = path.join(__dirname, '..', 'commands', `${commandName}.js`);
      
      if (fs.existsSync(commandPath)) {
        try {
          const command = getCachedCommand(commandPath);
          await command.execute(interaction, client);
        } catch (error) {
          console.error(`Erro ao executar comando ${commandName}:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'Erro ao executar este comando.', 
              flags: 64 
            }).catch(() => {});
          }
        }
      }
      return;
    }

    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      if (client.interactionHandler) {
        try {
          await client.interactionHandler.handleInteraction(interaction);
        } catch (error) {
          console.error('Erro ao processar interacao:', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'Erro ao processar esta acao.', 
              flags: 64 
            }).catch(() => {});
          }
        }
      } else {
        console.error('InteractionHandler nao encontrado no client');
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ 
            content: 'Sistema em inicializacao. Tente novamente.', 
            flags: 64 
          }).catch(() => {});
        }
      }
      return;
    }
  }
};
