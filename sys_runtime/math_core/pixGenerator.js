/**
 * PIX GENERATOR SERVICE
 * Gera PIX instantaneo via Mercado Pago
 * Kyoto Bot Enterprise
 */

const Config = require('../vault_manager/config');
const Logger = require('../vault_manager/logger');
const Database = require('../vault_manager/database');

class PixGenerator {
  constructor() {
    this.config = Config.getInstance();
    this.logger = Logger.getInstance();
    this.baseUrl = 'https://api.mercadopago.com';
  }

  static getInstance() {
    if (!PixGenerator.instance) {
      PixGenerator.instance = new PixGenerator();
    }
    return PixGenerator.instance;
  }

  isConfigured() {
    return !!this.config.mercadoPago?.accessToken;
  }

  async generatePix(amount, description, userId, metadata = {}) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'MP_ACCESS_TOKEN nao configurado',
        mock: this.generateMockPix(amount, description)
      };
    }

    try {
      const idempotencyKey = `${userId}_${Date.now()}`;
      
      const payment = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.mercadoPago.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey
        },
        body: JSON.stringify({
          transaction_amount: parseFloat(amount.toFixed(2)),
          description: description,
          payment_method_id: 'pix',
          payer: {
            email: metadata.email || 'cliente@kyoto.bot'
          },
          metadata: {
            user_id: userId,
            ...metadata
          }
        })
      });

      const data = await payment.json();

      if (data.id) {
        const pixData = {
          success: true,
          paymentId: data.id,
          status: data.status,
          amount: data.transaction_amount,
          qrCode: data.point_of_interaction?.transaction_data?.qr_code,
          qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
          ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url,
          expiresAt: data.date_of_expiration
        };

        await this.saveTransaction(pixData, userId, description, metadata);
        this.logger.transaction(userId, 'PIX_GENERATED', amount);

        return pixData;
      }

      return {
        success: false,
        error: data.message || 'Erro ao gerar PIX',
        details: data
      };

    } catch (error) {
      this.logger.error('PIX', 'Failed to generate PIX', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async checkPaymentStatus(paymentId) {
    if (!this.isConfigured()) {
      return { status: 'not_configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.mercadoPago.accessToken}`
        }
      });

      const data = await response.json();
      return {
        status: data.status,
        statusDetail: data.status_detail,
        paidAt: data.date_approved,
        amount: data.transaction_amount
      };

    } catch (error) {
      this.logger.error('PIX', 'Failed to check payment status', error);
      return { status: 'error', error: error.message };
    }
  }

  async saveTransaction(pixData, userId, description, metadata = {}) {
    try {
      const db = Database.getInstance();

      const productType = metadata.product_type || metadata.type || 'produto';
      const quantity = Number.isFinite(Number(metadata.quantity)) ? Number(metadata.quantity) : 1;
      const productName = metadata.product_name || description || 'Produto';

      await db.run(
        `INSERT INTO transactions 
        (transaction_id, user_id, product_type, product_name, quantity, amount, status, pix_code, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))`,
        [
          String(pixData.paymentId),
          userId,
          String(productType),
          String(productName).slice(0, 120),
          quantity,
          pixData.amount,
          pixData.status,
          pixData.qrCode
        ]
      );
    } catch (error) {
      this.logger.error('PIX', 'Failed to save transaction', error);
    }
  }

  generateMockPix(amount, description) {
    const mockCode = `00020126580014br.gov.bcb.pix0136${this.generateRandomKey()}5204000053039865802BR5913KYOTO SERVICES6008SAOPAULO62070503***6304`;
    
    return {
      qrCode: mockCode,
      amount: amount,
      description: description,
      note: 'Este e um PIX de demonstracao. Configure MP_ACCESS_TOKEN para PIX real.',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };
  }

  generateRandomKey() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}

module.exports = PixGenerator;
