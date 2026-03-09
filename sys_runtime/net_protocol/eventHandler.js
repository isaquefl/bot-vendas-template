/**
 * KYOTO BOT - EVENT HANDLER
 * Carregador modular de eventos com proteção anti-crash
 * Versão: 2.0.0
 */

const fs = require('fs');
const path = require('path');
const Logger = require('../vault_manager/logger');
const AntiCrash = require('../vault_manager/anticrash');

class EventHandler {
  constructor(client) {
    this.client = client;
    this.logger = Logger.getInstance();
    this.events = new Map();
  }

  async loadEvents() {
    const eventsPath = path.join(process.cwd(), 'events');
    
    if (!fs.existsSync(eventsPath)) {
      this.logger.warn('EVENTS', 'Events directory not found');
      return;
    }

    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      try {
        delete require.cache[require.resolve(path.join(eventsPath, file))];
        const event = require(path.join(eventsPath, file));
        
        if (!event.name || !event.execute) {
          this.logger.warn('EVENTS', `Invalid event structure: ${file}`);
          continue;
        }

        const wrappedExecute = this._wrapEventHandler(event.name, event.execute);

        if (event.once) {
          this.client.once(event.name, (...args) => wrappedExecute(...args, this.client));
        } else {
          this.client.on(event.name, (...args) => wrappedExecute(...args, this.client));
        }

        this.events.set(event.name, event);
        this.logger.debug('EVENTS', `Loaded: ${event.name}`);
      } catch (error) {
        this.logger.error('EVENTS', `Failed to load: ${file}`, error);
      }
    }

    this.logger.system('Events loaded', { count: this.events.size });
  }

  _wrapEventHandler(eventName, handler) {
    return async (...args) => {
      try {
        await handler(...args);
      } catch (error) {
        this.logger.error('EVENTS', `Error in ${eventName}`, error);
      }
    };
  }

  getLoadedEvents() {
    return Array.from(this.events.keys());
  }
}

module.exports = EventHandler;
