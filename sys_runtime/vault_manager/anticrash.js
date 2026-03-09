/**
 * KYOTO BOT - ANTI-CRASH SYSTEM
 * Sistema de proteção contra quedas e erros não tratados
 * Versão: 2.0.0
 */

const Logger = require('./logger');

class AntiCrash {
  static initialized = false;

  static init() {
    if (this.initialized) return;
    this.initialized = true;

    const logger = Logger.getInstance();

    process.on('unhandledRejection', (reason, promise) => {
      logger.anticrash('UnhandledRejection', reason);
    });

    process.on('uncaughtException', (error, origin) => {
      logger.anticrash('UncaughtException', error);
      if (error.message?.includes('TOKEN_INVALID')) {
        logger.error('FATAL', 'Token do Discord inválido. Encerrando...');
        process.exit(1);
      }
    });

    process.on('uncaughtExceptionMonitor', (error, origin) => {
      logger.anticrash('UncaughtExceptionMonitor', error);
    });

    process.on('warning', (warning) => {
      logger.warn('PROCESS', warning.message);
    });

    process.on('SIGINT', () => {
      logger.system('Recebido SIGINT - Encerrando graciosamente...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.system('Recebido SIGTERM - Encerrando graciosamente...');
      process.exit(0);
    });

    logger.system('AntiCrash system initialized');
  }

  static wrapAsync(fn, context = 'Unknown') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const logger = Logger.getInstance();
        logger.error(context, 'Async operation failed', error);
        return null;
      }
    };
  }

  static async safeExecute(fn, fallback = null, context = 'Unknown') {
    try {
      return await fn();
    } catch (error) {
      const logger = Logger.getInstance();
      logger.error(context, 'Safe execution failed', error);
      return fallback;
    }
  }

  static withTimeout(promise, ms = 30000, context = 'Unknown') {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout after ${ms}ms in ${context}`)), ms)
      )
    ]);
  }

  static async retry(fn, maxRetries = 3, delay = 1000, context = 'Unknown') {
    const logger = Logger.getInstance();
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        logger.warn(context, `Attempt ${attempt}/${maxRetries} failed`, { error: error.message });
        
        if (attempt === maxRetries) {
          logger.error(context, 'All retry attempts exhausted', error);
          throw error;
        }
        
        const backoffDelay = delay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
}

module.exports = AntiCrash;
