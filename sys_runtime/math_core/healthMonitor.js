/**
 * HEALTH MONITOR - Auto-repair system
 * Monitora e corrige problemas automaticamente
 */

const Logger = require('../vault_manager/logger');
const Database = require('../vault_manager/database');

class HealthMonitor {
  constructor(client) {
    this.client = client;
    this.logger = Logger.getInstance();
    this.interval = null;
    this.checkInterval = 60000;
    this.errorCount = 0;
    this.maxErrors = 5;
    this.lastCheck = null;
    this.repairs = [];
    this.startTime = Date.now();
    this.warmupPeriod = 30000;
  }

  start() {
    this.logger.info('HEALTH', 'Monitor started');
    this.startTime = Date.now();
    setTimeout(() => {
      this.interval = setInterval(() => this.runCheck(), this.checkInterval);
    }, this.warmupPeriod);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.logger.info('HEALTH', 'Monitor stopped');
  }

  async runCheck() {
    this.lastCheck = new Date();
    const issues = [];

    try {
      const discordOk = await this.checkDiscord();
      const dbOk = await this.checkDatabase();
      const memOk = await this.checkMemory();

      if (!dbOk) issues.push('database');
      if (!memOk) issues.push('memory');
      if (!discordOk && this.client.isReady()) issues.push('discord');

      if (issues.length > 0) {
        this.errorCount++;
        this.logger.warn('HEALTH', `Issues: ${issues.join(', ')} | Attempt ${this.errorCount}/${this.maxErrors}`);
        await this.autoRepair(issues);
      } else {
        if (this.errorCount > 0) this.errorCount = 0;
      }

      if (this.errorCount >= this.maxErrors) {
        this.logger.error('HEALTH', 'Max errors reached, full recovery');
        await this.fullRecovery();
      }

    } catch (error) {
      this.logger.error('HEALTH', 'Check failed', error);
    }
  }

  async checkDiscord() {
    try {
      if (!this.client.isReady()) return true;
      const ping = this.client.ws.ping;
      return ping >= 0 && ping < 10000;
    } catch (e) {
      return true;
    }
  }

  async checkDatabase() {
    try {
      const db = Database.getInstance();
      await db.get('SELECT 1');
      return true;
    } catch (e) {
      return false;
    }
  }

  async checkMemory() {
    const used = process.memoryUsage();
    const heapUsedMB = used.heapUsed / 1024 / 1024;
    if (heapUsedMB > 450) {
      this.logger.warn('HEALTH', `High memory: ${heapUsedMB.toFixed(0)}MB`);
      return false;
    }
    return true;
  }

  async autoRepair(issues) {
    for (const issue of issues) {
      try {
        switch (issue) {
          case 'database':
            await this.repairDatabase();
            break;
          case 'memory':
            await this.repairMemory();
            break;
          case 'discord':
            break;
        }
        this.repairs.push({ issue, time: new Date(), success: true });
      } catch (e) {
        this.repairs.push({ issue, time: new Date(), success: false, error: e.message });
        this.logger.error('HEALTH', `Repair failed: ${issue}`, e);
      }
    }
  }

  async repairDatabase() {
    this.logger.info('HEALTH', 'Repairing database...');
    const db = Database.getInstance();
    await db.initialize();
    this.logger.info('HEALTH', 'Database repaired');
  }

  async repairMemory() {
    this.logger.info('HEALTH', 'Cleaning memory...');
    if (global.gc) {
      global.gc();
    }
    this.client.sweepMessages(60);
    this.logger.info('HEALTH', 'Memory cleaned');
  }

  async fullRecovery() {
    this.logger.warn('HEALTH', 'Full recovery initiated');
    this.errorCount = 0;
    
    try {
      await this.repairDatabase();
      await this.repairMemory();
      this.logger.info('HEALTH', 'Full recovery complete');
    } catch (e) {
      this.logger.error('HEALTH', 'Full recovery failed', e);
    }
  }

  getStatus() {
    return {
      running: !!this.interval,
      lastCheck: this.lastCheck,
      errorCount: this.errorCount,
      recentRepairs: this.repairs.slice(-10),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      discord: {
        ready: this.client.isReady(),
        ping: this.client.ws.ping,
        guilds: this.client.guilds.cache.size
      }
    };
  }
}

module.exports = HealthMonitor;
