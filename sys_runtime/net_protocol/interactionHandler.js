/**
 * KYOTO BOT - INTERACTION HANDLER
 * Handler centralizado para todas as interações (botões, menus, modais)
 * Versão: 3.0.0 - CORRECAO TOTAL
 */

const Logger = require('../vault_manager/logger');
const ExecutionGuard = require('./executionGuard');

class InteractionHandler {
  constructor(client) {
    this.client = client;
    this.logger = Logger.getInstance();
    this.buttonHandlers = new Map();
    this.selectMenuHandlers = new Map();
    this.modalHandlers = new Map();
    this.componentDebounce = new Map();
    this.execGuard = new ExecutionGuard();
  }

  _buildComponentKey(interaction) {
    const userId = interaction?.user?.id || 'unknown';
    const channelId = interaction?.channelId || 'unknown';

    if (interaction.isButton()) {
      return `btn:${userId}:${channelId}:${interaction.customId}`;
    }

    if (interaction.isStringSelectMenu()) {
      const selected = (interaction.values || []).join(',');
      return `sel:${userId}:${channelId}:${interaction.customId}:${selected}`;
    }

    if (interaction.isModalSubmit()) {
      return `mdl:${userId}:${channelId}:${interaction.customId}`;
    }

    return null;
  }

  _isDuplicateComponentInteraction(interaction) {
    const key = this._buildComponentKey(interaction);
    if (!key) return false;

    const now = Date.now();
    const last = this.componentDebounce.get(key) || 0;

    if (now - last < 1500) {
      return true;
    }

    this.componentDebounce.set(key, now);

    if (this.componentDebounce.size > 5000) {
      const cutoff = now - 15000;
      for (const [mapKey, timestamp] of this.componentDebounce.entries()) {
        if (timestamp < cutoff) this.componentDebounce.delete(mapKey);
      }
    }

    return false;
  }

  async _ackDuplicate(interaction) {
    try {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({ content: 'Acao ja recebida. Aguarde alguns segundos.', flags: 64 }).catch(() => {});
        }
      }
    } catch (_) {
      // Nao bloquear fluxo por falha de ACK em duplicidade.
    }
  }

  registerButton(customId, handler) {
    this.buttonHandlers.set(customId, handler);
  }

  registerButtonPrefix(prefix, handler) {
    this.buttonHandlers.set(`prefix:${prefix}`, handler);
  }

  registerSelectMenu(customId, handler) {
    this.selectMenuHandlers.set(customId, handler);
  }

  registerSelectMenuPrefix(prefix, handler) {
    this.selectMenuHandlers.set(`prefix:${prefix}`, handler);
  }

  registerModal(customId, handler) {
    this.modalHandlers.set(customId, handler);
  }

  registerModalPrefix(prefix, handler) {
    this.modalHandlers.set(`prefix:${prefix}`, handler);
  }

  async handleInteraction(interaction) {
    const userId = interaction?.user?.id;
    if (!userId) return;

    const action = interaction.customId || interaction.id;
    const scope = interaction.isButton() ? 'btn' : (interaction.isStringSelectMenu() ? 'sel' : 'mdl');

    const remainingMs = this.execGuard.getRemainingMs(scope, userId, action);
    if (remainingMs > 0) {
      const timeLeft = (remainingMs / 1000).toFixed(1);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: `Aguarde ${timeLeft}s para repetir esta acao.`, flags: 64 }).catch(() => {});
      }
      return;
    }

    if (!this.execGuard.acquire(scope, userId, action)) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Esta acao ja esta sendo processada. Aguarde.', flags: 64 }).catch(() => {});
      }
      return;
    }

    try {
      if (this._isDuplicateComponentInteraction(interaction)) {
        await this._ackDuplicate(interaction);
        return;
      }

      if (interaction.isButton()) {
        await this._handleButton(interaction);
      } else if (interaction.isStringSelectMenu()) {
        await this._handleSelectMenu(interaction);
      } else if (interaction.isModalSubmit()) {
        await this._handleModal(interaction);
      }
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('unknown interaction') || message.includes('already been acknowledged')) {
        return;
      }
      this.logger.error('INTERACTION', 'Handler error', error);
      await this._sendErrorResponse(interaction);
    } finally {
      this.execGuard.release(scope, userId, action);
      this.execGuard.setCooldown(scope, userId, action, 1000);
    }
  }

  async _handleButton(interaction) {
    const customId = interaction.customId;
    
    let handler = this.buttonHandlers.get(customId);
    
    if (!handler) {
      for (const [key, h] of this.buttonHandlers) {
        if (key.startsWith('prefix:')) {
          const prefix = key.replace('prefix:', '');
          if (customId.startsWith(prefix)) {
            handler = h;
            break;
          }
        }
      }
    }

    if (handler) {
      await handler(interaction, this.client);
    } else {
      this.logger.warn('INTERACTION', `No handler for button: ${customId}`);
      await interaction.reply({ content: 'Acao nao reconhecida.', flags: 64 }).catch(() => {});
    }
  }

  async _handleSelectMenu(interaction) {
    const customId = interaction.customId;
    
    let handler = this.selectMenuHandlers.get(customId);

    if (!handler) {
      for (const [key, h] of this.selectMenuHandlers) {
        if (key.startsWith('prefix:')) {
          const prefix = key.replace('prefix:', '');
          if (customId.startsWith(prefix)) {
            handler = h;
            break;
          }
        }
      }
    }

    if (handler) {
      await handler(interaction, this.client);
    } else {
      this.logger.warn('INTERACTION', `No handler for select menu: ${customId}`);
      await interaction.reply({ content: 'Menu nao reconhecido.', flags: 64 }).catch(() => {});
    }
  }

  async _handleModal(interaction) {
    const customId = interaction.customId;
    
    let handler = this.modalHandlers.get(customId);
    
    if (!handler) {
      for (const [key, h] of this.modalHandlers) {
        if (key.startsWith('prefix:')) {
          const prefix = key.replace('prefix:', '');
          if (customId.startsWith(prefix)) {
            handler = h;
            break;
          }
        }
      }
    }

    if (handler) {
      await handler(interaction, this.client);
    } else {
      this.logger.warn('INTERACTION', `No handler for modal: ${customId}`);
      await interaction.reply({ content: 'Modal nao reconhecido.', flags: 64 }).catch(() => {});
    }
  }

  async _sendErrorResponse(interaction) {
    const errorMessage = {
      content: 'Ocorreu um erro ao processar esta acao. Tente novamente.',
      flags: 64
    };

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    } catch (error) {
      this.logger.error('INTERACTION', 'Failed to send error response', error);
    }
  }
}

module.exports = InteractionHandler;
