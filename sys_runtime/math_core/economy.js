/**
 * MATH CORE - ECONOMY ENGINE
 * Kyoto Bot Enterprise
 */

const Config = require('../vault_manager/config');
const Database = require('../vault_manager/database');

const ECONOMY_KEYS = {
  robuxPer1k: 'economy.robuxPer1k',
  mpTaxRate: 'economy.mpTaxRate',
  vpMarkupRate: 'economy.vpMarkupRate',
  vpCatalog: 'economy.vpCatalog'
};
const FIXED_MP_TAX_RATE = 0.0099; // 0.99%

class EconomyService {
  constructor() {
    this.config = Config.getInstance();
    this.mpTaxRate = FIXED_MP_TAX_RATE; // 0.99%
    this.robuxPer1k = 38.00;
    this.vpCatalog = {
      475: 15.00,
      1000: 30.00,
      2050: 50.00,
      3650: 90.00,
      5350: 135.00,
      11000: 240.00
    };
    this.vpMarkupRate = 0.05; // +5%
    this.settingsLoaded = false;
    this.settingsLoading = null;
  }

  static getInstance() {
    if (!EconomyService.instance) {
      EconomyService.instance = new EconomyService();
    }
    return EconomyService.instance;
  }

  async syncFromDatabase() {
    if (this.settingsLoaded) return;
    if (this.settingsLoading) {
      await this.settingsLoading;
      return;
    }

    this.settingsLoading = this._loadSettings();
    await this.settingsLoading;
    this.settingsLoading = null;
  }

  async _loadSettings() {
    try {
      const db = Database.getInstance();

      const robuxRaw = await db.getCache(ECONOMY_KEYS.robuxPer1k);
      const mpTaxRaw = await db.getCache(ECONOMY_KEYS.mpTaxRate);
      const vpMarkupRaw = await db.getCache(ECONOMY_KEYS.vpMarkupRate);
      const vpCatalogRaw = await db.getCache(ECONOMY_KEYS.vpCatalog);

      if (Number.isFinite(Number(robuxRaw)) && Number(robuxRaw) > 0) {
        this.robuxPer1k = Number(robuxRaw);
      }

      // Regra fixa solicitada: taxa MP sempre 0.99%.
      this.mpTaxRate = FIXED_MP_TAX_RATE;
      await db.setCache(ECONOMY_KEYS.mpTaxRate, FIXED_MP_TAX_RATE, 60 * 60 * 24 * 365 * 5).catch(() => {});

      if (Number.isFinite(Number(vpMarkupRaw)) && Number(vpMarkupRaw) >= 0) {
        this.vpMarkupRate = Number(vpMarkupRaw);
      }

      if (vpCatalogRaw && typeof vpCatalogRaw === 'object') {
        const parsed = {};
        for (const [key, value] of Object.entries(vpCatalogRaw)) {
          const numericKey = Number(key);
          const numericValue = Number(value);
          if (Number.isFinite(numericKey) && Number.isFinite(numericValue) && numericValue > 0) {
            parsed[numericKey] = numericValue;
          }
        }
        if (Object.keys(parsed).length > 0) {
          this.vpCatalog = parsed;
        }
      }
    } catch (error) {
      // Mantem defaults para nao interromper o fluxo de pagamento.
    } finally {
      this.settingsLoaded = true;
    }
  }

  async updateSettings(newSettings = {}) {
    const db = Database.getInstance();

    if (newSettings.robuxPer1k !== undefined) {
      const value = Number(newSettings.robuxPer1k);
      if (Number.isFinite(value) && value > 0) {
        this.robuxPer1k = value;
        await db.setCache(ECONOMY_KEYS.robuxPer1k, value, 60 * 60 * 24 * 365 * 5);
      }
    }

    // Regra fixa solicitada: ignora override de mpTaxRate e mantem 0.99%.
    this.mpTaxRate = FIXED_MP_TAX_RATE;
    await db.setCache(ECONOMY_KEYS.mpTaxRate, FIXED_MP_TAX_RATE, 60 * 60 * 24 * 365 * 5).catch(() => {});

    if (newSettings.vpMarkupRate !== undefined) {
      const value = Number(newSettings.vpMarkupRate);
      if (Number.isFinite(value) && value >= 0) {
        this.vpMarkupRate = value;
        await db.setCache(ECONOMY_KEYS.vpMarkupRate, value, 60 * 60 * 24 * 365 * 5);
      }
    }

    if (newSettings.vpCatalog !== undefined && typeof newSettings.vpCatalog === 'object') {
      const parsed = {};
      for (const [key, value] of Object.entries(newSettings.vpCatalog)) {
        const numericKey = Number(key);
        const numericValue = Number(value);
        if (Number.isFinite(numericKey) && Number.isFinite(numericValue) && numericValue > 0) {
          parsed[numericKey] = numericValue;
        }
      }
      if (Object.keys(parsed).length > 0) {
        this.vpCatalog = parsed;
        await db.setCache(ECONOMY_KEYS.vpCatalog, parsed, 60 * 60 * 24 * 365 * 5);
      }
    }
  }

  getSettingsSummary() {
    return {
      robuxPer1k: this.robuxPer1k,
      mpTaxRate: this.mpTaxRate,
      vpMarkupRate: this.vpMarkupRate,
      vpCatalog: this.vpCatalog
    };
  }

  calculateFinalPrice(amount) {
    // Para Robux: (Qtd/1000 * 38) * 1.0099
    const basePrice = (amount / 1000) * this.robuxPer1k;
    return this.roundCurrency(basePrice * (1 + this.mpTaxRate));
  }

  applyMPTax(price) {
    // Aplica taxa MP sobre um valor direto
    return this.roundCurrency(price * (1 + this.mpTaxRate));
  }

  calculateRobuxPrice(quantidade, precoMil = null) {
    const precoPorMil = precoMil || this.robuxPer1k;
    const basePrice = (quantidade / 1000) * precoPorMil;
    const mpTax = this.roundCurrency(basePrice * this.mpTaxRate);
    const finalPrice = this.roundCurrency(basePrice + mpTax);
    
    return { basePrice: this.roundCurrency(basePrice), mpTax, finalPrice };
  }

  calculateGamepassGross(robuxDesejado) {
    // Taxa Roblox de 30%
    return Math.ceil(robuxDesejado / 0.70);
  }

  calculateVPPrice(vp) {
    const basePrice = this.vpCatalog[vp] || (vp * 0.05);
    const withMarkup = basePrice * (1 + this.vpMarkupRate);
    return this.applyMPTax(withMarkup);
  }

  calculatePrice(quantity, type = 'robux') {
    let basePrice, finalPrice;
    
    if (type === 'robux') {
      basePrice = (quantity / 1000) * this.robuxPer1k;
      finalPrice = this.applyMPTax(basePrice);
    } else if (type === 'vp') {
      basePrice = this.vpCatalog[quantity] || (quantity * 0.05);
      finalPrice = this.calculateVPPrice(quantity);
    } else {
      basePrice = quantity;
      finalPrice = this.applyMPTax(quantity);
    }
    
    basePrice = this.roundCurrency(basePrice);
    finalPrice = this.roundCurrency(finalPrice);
    return { basePrice, finalPrice, tax: this.roundCurrency(finalPrice - basePrice) };
  }

  getVPOptions() {
    return Object.keys(this.vpCatalog).map(Number);
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  generateQuantityOptions(type, pricePerUnit = null) {
    const options = [];
    const values = type === 'robux'
      ? [400, 800, 1000, 2000, 5000, 10000, 20000]
      : this.getVPOptions();
    
    for (const val of values) {
      const price = type === 'robux'
        ? this.calculateFinalPrice(val)
        : this.calculateVPPrice(val);
      options.push({
        label: `${val} ${type.toUpperCase()}`,
        description: `Preço: ${this.formatCurrency(price)}`,
        value: `${type}_${val}_${price.toFixed(2)}`
      });
    }
    return options;
  }

  roundCurrency(value) {
    return Number((value || 0).toFixed(2));
  }
}

module.exports = EconomyService;
