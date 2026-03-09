/**
 * KYOTO BOT - ENTERPRISE CONFIGURATION
 * Sistema de configuração centralizado
 * Versão: 2.0.0
 */

const path = require('path');

class Config {
  static instance = null;

  constructor() {
    if (Config.instance) {
      return Config.instance;
    }
    Config.instance = this;
    this._loadEnvironment();
  }

  _loadEnvironment() {
    this.discord = {
      token: process.env.DISCORD_TOKEN,
      clientId: process.env.CLIENT_ID,
      intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent', 'GuildModeration']
    };

    this.mercadoPago = {
      accessToken: process.env.MP_ACCESS_TOKEN,
      webhookSecret: process.env.MP_WEBHOOK_SECRET,
      taxRate: 0.0099
    };

    this.server = {
      port: parseInt(process.env.PORT) || 5000,
      host: '0.0.0.0',
      sessionSecret: process.env.SESSION_SECRET || 'kyoto-secret-2026'
    };

    this.database = {
      path: path.join(process.cwd(), 'data', 'kyoto.db'),
      backupInterval: 24 * 60 * 60 * 1000,
      maxBackups: 7
    };

    this.economy = {
      robuxPer1k: 38.00,
      mpTaxRate: 0.0099,
      serviceFee: 0.05,
      robuxOptions: [400, 800, 1000, 2000, 5000, 10000, 20000],
      vpOptions: [250, 500, 1200, 2000]
    };

    this.ui = {
      colors: {
        primary: 0x000000,
        success: 0x00FF00,
        error: 0xFF0000,
        warning: 0xFFAA00,
        info: 0x5865F2
      },
      defaultBanner: 'https://i.imgur.com/pMrFl8x.png'
    };

    this.channels = {
      logs: process.env.LOG_CHANNEL_ID,
      archive: process.env.ARCHIVE_CHANNEL_ID,
      cart: process.env.CART_CATEGORY_ID,
      paid: '1458532706475315435'
    };

    this.staff = {
      ids: ['757012487710310440', '1064729754139373570', '422183511517298693']
    };

    this.cache = {
      ttl: 300000,
      cleanupInterval: 60000
    };

    this.rateLimit = {
      maxRequests: 5,
      windowMs: 10000,
      cooldownMs: 60000
    };
  }

  validate() {
    const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error(`[CONFIG] Missing required env vars: ${missing.join(', ')}`);
      return false;
    }
    return true;
  }

  get(key) {
    const keys = key.split('.');
    let value = this;
    for (const k of keys) {
      value = value?.[k];
    }
    return value;
  }

  static getInstance() {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }
}

module.exports = Config;
