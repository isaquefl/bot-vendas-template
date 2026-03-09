/**
 * KYOTO BOT - ENTERPRISE LOGGER
 * Sistema de logging profissional com análise de performance
 * Versão: 2.0.0
 */

const fs = require('fs');
const path = require('path');

class Logger {
  static instance = null;
  
  constructor() {
    if (Logger.instance) {
      return Logger.instance;
    }
    Logger.instance = this;
    
    this.logDir = path.join(process.cwd(), 'logs');
    this._ensureLogDir();
    this.metrics = {
      commands: {},
      errors: 0,
      startTime: Date.now()
    };
  }

  _ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _formatTimestamp() {
    return new Date().toISOString();
  }

  _formatMessage(level, module, message, data = null) {
    const base = `${this._formatTimestamp()} | ${level.padEnd(5)} | ${module.padEnd(15)} | ${message}`;
    return data ? `${base} | ${JSON.stringify(data)}` : base;
  }

  _writeToFile(message) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `kyoto_${date}.log`);
    fs.appendFileSync(logFile, message + '\n');
  }

  info(module, message, data = null) {
    // Info silenciada para otimização de RAM
    if (process.env.DEBUG_LOGS === 'true') {
        const formatted = this._formatMessage('INFO', module, message, data);
        console.log(`\x1b[36m${formatted}\x1b[0m`);
        this._writeToFile(formatted);
    }
  }

  warn(module, message, data = null) {
    const formatted = this._formatMessage('WARN', module, message, data);
    console.log(`\x1b[33m${formatted}\x1b[0m`);
    this._writeToFile(formatted);
  }

  error(module, message, error = null) {
    this.metrics.errors++;
    const errorData = error ? { 
      message: error.message, 
      stack: error.stack?.split('\n').slice(0, 3).join(' -> ')
    } : null;
    const formatted = this._formatMessage('ERROR', module, message, errorData);
    console.error(`\x1b[31m${formatted}\x1b[0m`);
    this._writeToFile(formatted);
  }

  debug(module, message, data = null) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LOGS === 'true') {
      const formatted = this._formatMessage('DEBUG', module, message, data);
      console.log(`\x1b[90m${formatted}\x1b[0m`);
    }
  }

  transaction(userId, action, value = null) {
    const data = { userId, action };
    if (value !== null) data.value = `R$${value.toFixed(2)}`;
    
    // Transações sempre logadas por serem críticas
    const formatted = this._formatMessage('TRANSACTION', 'WALLET', `${action} by ${userId}`, data);
    console.log(`\x1b[32m${formatted}\x1b[0m`);
    this._writeToFile(formatted);
  }

  command(commandName, userId, guildId) {
    if (!this.metrics.commands[commandName]) {
      this.metrics.commands[commandName] = 0;
    }
    this.metrics.commands[commandName]++;
    this.info('COMMAND', `/${commandName}`, { userId, guildId });
  }

  system(status, details = null) {
    this.info('SYSTEM', status, details);
  }

  anticrash(type, error) {
    this.error('ANTICRASH', `${type} caught`, error);
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    return {
      uptime: Math.floor(uptime / 1000),
      errors: this.metrics.errors,
      commands: this.metrics.commands,
      topCommands: Object.entries(this.metrics.commands)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  static getInstance() {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
}

module.exports = Logger;
