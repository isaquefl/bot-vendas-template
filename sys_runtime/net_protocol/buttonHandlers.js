/**
 * KYOTO BOT - BUTTON HANDLERS
 * Handlers para interacoes de botoes, menus e modais
 * Versao: 3.0.0 - CORRECAO TOTAL
 */

const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Logger = require('../vault_manager/logger');
const PixGenerator = require('../math_core/pixGenerator');
const EconomyService = require('../math_core/economy');
const Database = require('../vault_manager/database');
const Config = require('../vault_manager/config');

const THEME_COLOR = 0x1c6dbd;

class ButtonHandlers {
  constructor(interactionHandler, client) {
    this.handler = interactionHandler;
    this.client = client;
    this.logger = Logger.getInstance();
    this.config = Config.getInstance();
    this.accountInfoCache = new Map();
    this.actionLocks = new Map();
    this.registerAll();
  }

  _acquireActionLock(key, ttlMs = 8000) {
    const now = Date.now();
    const last = this.actionLocks.get(key) || 0;
    if (now - last < ttlMs) return false;

    this.actionLocks.set(key, now);

    if (this.actionLocks.size > 5000) {
      const cutoff = now - (ttlMs * 3);
      for (const [entryKey, ts] of this.actionLocks.entries()) {
        if (ts < cutoff) this.actionLocks.delete(entryKey);
      }
    }

    return true;
  }

  registerAll() {
    this.handler.registerButton('ticket_open', this.handleTicketOpen.bind(this));
    this.handler.registerButton('ticket_close', this.handleTicketClose.bind(this));
    this.handler.registerButton('ticket_claim', this.handleTicketClaim.bind(this));
    this.handler.registerButton('ticket_unlock', this.handleTicketUnlock.bind(this));
    this.handler.registerButton('vender_cancel', this.handleVenderCancel.bind(this));
    this.handler.registerButtonPrefix('vender_confirm_', this.handleVenderConfirmButton.bind(this));
    
    this.handler.registerButtonPrefix('comprar_conta_', this.handleComprarConta.bind(this));
    this.handler.registerButtonPrefix('conta_info_', this.handleContaInfo.bind(this));
    this.handler.registerButtonPrefix('comprar_produto_', this.handleComprarProduto.bind(this));
    this.handler.registerButtonPrefix('carrinho_pagar_', this.handleCarrinhoPagar.bind(this));
    this.handler.registerButton('carrinho_cancelar', this.handleCarrinhoCancelar.bind(this));
    this.handler.registerButton('carrinho_desistir', this.handleCarrinhoCancelar.bind(this));
    this.handler.registerButtonPrefix('marcar_pago_', this.handleMarcarPago.bind(this));
    this.handler.registerButton('concluir_entrega', this.handleConcluirEntrega.bind(this));
    
    this.handler.registerSelectMenu('painel_comprar', this.handlePainelComprar.bind(this));
    this.handler.registerSelectMenu('vender_robux_qty', this.handleVenderRobuxQty.bind(this));
    this.handler.registerSelectMenu('vender_vp_qty', this.handleVenderVpQty.bind(this));
    this.handler.registerSelectMenu('loja_comprar', this.handleLojaComprar.bind(this));
    this.handler.registerSelectMenu('ticket_categoria', this.handleTicketCategoria.bind(this));
    
    this.logger.info('HANDLERS', 'Handlers registered');
  }

  storeAccountInfo(accountInfo) {
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    this.accountInfoCache.set(token, {
      ...accountInfo,
      createdAt: Date.now()
    });

    if (this.accountInfoCache.size > 1000) {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000);
      for (const [key, value] of this.accountInfoCache.entries()) {
        if ((value.createdAt || 0) < cutoff) this.accountInfoCache.delete(key);
      }
    }

    return token;
  }

  async handleContaInfo(interaction) {
    try {
      const infoToken = interaction.customId.replace('conta_info_', '');
      const info = this.accountInfoCache.get(infoToken);

      if (!info) {
        return interaction.reply({
          content: 'As informacoes desta conta expiraram. Peca para recriar o painel.',
          flags: 64
        });
      }

      const infoEmbed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle(`🔎 Informacoes da Conta: ${info.nome || 'Valorant'}`)
        .addFields(
          { name: '🏆 Elo da Conta', value: info.elo || 'Nao informado', inline: true },
          { name: '🎨 Mais Skins', value: info.skins || 'Nao informado', inline: true },
          { name: '🔑 Chaveiros', value: info.chaveiros || 'Nao informado', inline: true }
        )
        .setFooter({ text: 'Visualizacao privada' })
        .setTimestamp();

      await interaction.reply({ embeds: [infoEmbed], flags: 64 });
    } catch (error) {
      this.logger.error('HANDLER', 'Conta info error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao abrir informacoes da conta.', flags: 64 }).catch(() => {});
      }
    }
  }

  _formatDateParts(date = new Date()) {
    return {
      date: date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
      time: date.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  }

  _getBuyerIdFromChannel(channel) {
    const deniedIds = new Set([channel.guild.id, this.client.user.id]);
    const overwrite = channel.permissionOverwrites?.cache
      ?.filter(ov => {
        if (ov.type && ov.type !== 1) return false;
        if (deniedIds.has(ov.id)) return false;
        const hasAllow = ov.allow?.has(PermissionFlagsBits.ViewChannel);
        return hasAllow;
      })
      ?.first();

    return overwrite?.id || null;
  }

  _buildProductSummary(transaction) {
    if (!transaction) return 'Produto nao identificado';

    const productName = transaction.product_name || 'Produto';
    const quantity = Number(transaction.quantity || 1);
    const productType = (transaction.product_type || 'produto').toUpperCase();

    return `${productName} | Tipo: ${productType} | Qtd: ${quantity}`;
  }

  async _resolveCategoryId(guild, type) {
    const db = Database.getInstance();
    const guildId = guild.id;

    const cacheKeys = type === 'cart'
      ? [
          `channels_${guildId}_cart_category`,
          `channels_${guildId}_cart`,
          `config_${guildId}_cart_category`
        ]
      : [
          `channels_${guildId}_paid_category`,
          `channels_${guildId}_paid`,
          `config_${guildId}_paid_category`
        ];

    for (const key of cacheKeys) {
      const row = await db.get('SELECT value FROM cache WHERE key = ? LIMIT 1', [key]).catch(() => null);
      if (row?.value) return row.value;
    }

    const configFallback = type === 'cart'
      ? this.config?.channels?.cart
      : this.config?.channels?.paid;
    if (configFallback) return configFallback;

    const nameMatch = guild.channels.cache.find((ch) => {
      if (ch.type !== ChannelType.GuildCategory) return false;
      const normalized = ch.name.toLowerCase();
      if (type === 'cart') return normalized.includes('carrinho') || normalized.includes('cart');
      return normalized.includes('pago') || normalized.includes('pagos') || normalized.includes('paid');
    });

    return nameMatch?.id || null;
  }

  _isInCategory(channel, categoryId) {
    if (!channel || !categoryId) return false;
    return channel.parentId === categoryId || channel.parent?.id === categoryId || channel.parentID === categoryId;
  }

  async handleTicketCategoria(interaction) {
    try {
      const categoria = interaction.values[0];
      
      const categoriaNames = {
        'suporte': '🛠️ Suporte Tecnico',
        'atendimento': '💬 Atendimento',
        'duvidas': '❓ Duvidas',
        'parceria': '🤝 Parceria'
      };

      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || interaction.user.id;
      
      const existingTicket = interaction.guild.channels.cache.find(
        ch => ch.name.includes(`ticket-${safeName}`)
      );
      
      if (existingTicket) {
        return interaction.reply({
          content: `Voce ja tem um ticket aberto: ${existingTicket}`,
          flags: 64
        });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Ticket de Suporte')
        .setDescription(`Bem-vindo, ${interaction.user}!\n\nO chat já está **aberto** para você descrever seu problema.`)
        .addFields(
          { name: 'Categoria', value: categoriaNames[categoria] || categoria, inline: true },
          { name: 'Status', value: '🟢 Aberto', inline: true }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Assumir Ticket')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Fechar Ticket')
          .setStyle(ButtonStyle.Danger)
      );

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
      
      await interaction.reply({
        content: `Ticket criado com sucesso: ${ticketChannel}`,
        flags: 64
      });

      this.logger.info('TICKET', `Ticket criado por ${interaction.user.tag} | Categoria: ${categoria}`);

    } catch (error) {
      this.logger.error('HANDLER', 'Ticket categoria error', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Erro ao criar ticket.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handlePainelComprar(interaction) {
    try {
      const value = interaction.values[0];
      const parts = value.split('_');
      const type = parts[1];
      const qty = parseInt(parts[2]) || 0;
      const inputPrice = parseFloat(parts[3]) || 0;

      const economy = EconomyService.getInstance();
      let price = inputPrice;
      if (type === 'robux') {
        price = economy.calculateFinalPrice(qty);
      } else if (type === 'vp') {
        price = economy.calculateVPPrice(qty);
      }

      if (!type || isNaN(qty) || isNaN(price) || price <= 0) {
        return interaction.reply({ content: 'Erro nos dados do produto.', flags: 64 });
      }

      const CARRINHO_CATEGORY = await this._resolveCategoryId(interaction.guild, 'cart');
      
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || interaction.user.id;
      
      const existingCart = interaction.guild.channels.cache.find(
        ch => ch.name.includes(`carrinho-${safeName}`)
      );
      
      if (existingCart) {
        return interaction.reply({
          content: `Voce ja tem um carrinho aberto: ${existingCart}`,
          flags: 64
        });
      }

      const formattedPrice = price.toFixed(2);
      const productName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : 'Produto';

      await interaction.deferReply({ ephemeral: true });

      const cartChannel = await interaction.guild.channels.create({
        name: `🛒・${safeName}・${formattedPrice}`,
        type: ChannelType.GuildText,
        ...(CARRINHO_CATEGORY ? { parent: CARRINHO_CATEGORY } : {}),
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🛒 Carrinho de Compras')
        .setDescription(`${interaction.user}, voce selecionou:`)
        .addFields(
          { name: 'Produto', value: `**${productName}**`, inline: true },
          { name: 'Valor', value: `**${economy.formatCurrency(price)}**`, inline: true },
          { name: 'Status', value: '⏳ Aguardando pagamento', inline: true }
        )
        .setFooter({ text: 'Kyoto Vendas | Clique em Pagar para gerar o PIX' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`carrinho_pagar_${type}_${qty}_${price}`)
          .setLabel('Gerar PIX')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('carrinho_desistir')
          .setLabel('Desistir')
          .setStyle(ButtonStyle.Danger)
      );

      await cartChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });

      // Auto-fechamento em 30 minutos
      setTimeout(async () => {
        try {
          const channel = await interaction.guild.channels.fetch(cartChannel.id).catch(() => null);
          if (channel && this._isInCategory(channel, CARRINHO_CATEGORY)) {
            await channel.send('⏰ **Tempo esgotado!** Este carrinho foi fechado por inatividade.');
            setTimeout(() => channel.delete().catch(() => {}), 5000);
          }
        } catch (e) {}
      }, 30 * 60 * 1000);
      
      await interaction.editReply({
        content: `Carrinho criado! Va para ${cartChannel} para finalizar sua compra.`
      });

      this.logger.transaction(interaction.user.id, 'CART_CREATED', price);

    } catch (error) {
      this.logger.error('HANDLER', 'Painel comprar error', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Erro ao criar carrinho.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleComprarConta(interaction) {
    try {
      const price = parseFloat(interaction.customId.replace('comprar_conta_', ''));
      const CARRINHO_CATEGORY = await this._resolveCategoryId(interaction.guild, 'cart');
      
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || interaction.user.id;
      
      const existingCart = interaction.guild.channels.cache.find(ch => ch.name.includes(`carrinho-${safeName}`));
      if (existingCart) {
        return interaction.reply({ content: `Voce ja tem um carrinho aberto: ${existingCart}`, flags: 64 });
      }

      const economy = EconomyService.getInstance();
      const formattedPrice = price.toFixed(2);
      const productName = interaction.customId.includes('conta') ? 'Conta' : 'Produto';

      await interaction.deferReply({ ephemeral: true });

      const cartChannel = await interaction.guild.channels.create({
        name: `🛒・${safeName}・${formattedPrice}`,
        type: ChannelType.GuildText,
        ...(CARRINHO_CATEGORY ? { parent: CARRINHO_CATEGORY } : {}),
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🛒 Carrinho - Conta')
        .setDescription(`${interaction.user}, voce selecionou uma conta para compra.`)
        .addFields(
          { name: 'Produto', value: `**${productName}**`, inline: true },
          { name: 'Valor', value: `**${economy.formatCurrency(price)}**`, inline: true },
          { name: 'Status', value: '⏳ Aguardando pagamento', inline: true }
        )
        .setFooter({ text: 'Kyoto Vendas' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carrinho_pagar_conta_1_${price}`).setLabel('Gerar PIX').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('carrinho_desistir').setLabel('Desistir').setStyle(ButtonStyle.Danger)
      );

      await cartChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });

      // Auto-fechamento em 30 minutos
      setTimeout(async () => {
        try {
          const channel = await interaction.guild.channels.fetch(cartChannel.id).catch(() => null);
          if (channel && this._isInCategory(channel, CARRINHO_CATEGORY)) {
            await channel.send('⏰ **Tempo esgotado!** Este carrinho foi fechado por inatividade.');
            setTimeout(() => channel.delete().catch(() => {}), 5000);
          }
        } catch (e) {}
      }, 30 * 60 * 1000);
      await interaction.editReply({ content: `Carrinho criado! Va para ${cartChannel}` });

    } catch (error) {
      this.logger.error('HANDLER', 'Comprar conta error', error);
      if (!interaction.replied) await interaction.reply({ content: 'Erro ao criar carrinho.', flags: 64 }).catch(() => {});
    }
  }

  async handleComprarProduto(interaction) {
    try {
      const price = parseFloat(interaction.customId.replace('comprar_produto_', ''));
      const CARRINHO_CATEGORY = await this._resolveCategoryId(interaction.guild, 'cart');
      
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || interaction.user.id;
      
      const existingCart = interaction.guild.channels.cache.find(ch => ch.name.includes(`carrinho-${safeName}`));
      if (existingCart) {
        return interaction.reply({ content: `Voce ja tem um carrinho aberto: ${existingCart}`, flags: 64 });
      }

      const economy = EconomyService.getInstance();
      const formattedPrice = price.toFixed(2);
      const productName = 'Produto';

      await interaction.deferReply({ ephemeral: true });

      const cartChannel = await interaction.guild.channels.create({
        name: `🛒・${safeName}・${formattedPrice}`,
        type: ChannelType.GuildText,
        ...(CARRINHO_CATEGORY ? { parent: CARRINHO_CATEGORY } : {}),
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages] },
          { id: this.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
        ]
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🛒 Carrinho')
        .setDescription(`${interaction.user}, produto selecionado.`)
        .addFields(
          { name: 'Produto', value: `**${productName}**`, inline: true },
          { name: 'Valor', value: `**${economy.formatCurrency(price)}**`, inline: true },
          { name: 'Status', value: '⏳ Aguardando pagamento', inline: true }
        )
        .setFooter({ text: 'Kyoto Vendas' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carrinho_pagar_produto_1_${price}`).setLabel('Gerar PIX').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('carrinho_desistir').setLabel('Desistir').setStyle(ButtonStyle.Danger)
      );

      await cartChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });

      // Auto-fechamento em 30 minutos
      setTimeout(async () => {
        try {
          const channel = await interaction.guild.channels.fetch(cartChannel.id).catch(() => null);
          if (channel && this._isInCategory(channel, CARRINHO_CATEGORY)) {
            await channel.send('⏰ **Tempo esgotado!** Este carrinho foi fechado por inatividade.');
            setTimeout(() => channel.delete().catch(() => {}), 5000);
          }
        } catch (e) {}
      }, 30 * 60 * 1000);
      await interaction.editReply({ content: `Carrinho criado! Va para ${cartChannel}` });

    } catch (error) {
      this.logger.error('HANDLER', 'Comprar produto error', error);
      if (!interaction.replied) await interaction.reply({ content: 'Erro ao criar carrinho.', flags: 64 }).catch(() => {});
    }
  }

  async handleCarrinhoPagar(interaction) {
    try {
      const actionKey = `pix:${interaction.user.id}:${interaction.channelId}:${interaction.customId}`;
      if (!this._acquireActionLock(actionKey, 10000)) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }
        return;
      }

      await interaction.deferUpdate();
      
      const parts = interaction.customId.replace('carrinho_pagar_', '').split('_');
      const rawPrice = parseFloat(parts[parts.length - 1]);
      const type = parts[0];
      const quantity = parseInt(parts[1]) || 1;

      const economy = EconomyService.getInstance();
      const pix = PixGenerator.getInstance();
      let price = rawPrice;

      // Recalcula o valor final nos fluxos fixos para garantir taxa MP aplicada.
      if (type === 'robux') {
        price = economy.calculateFinalPrice(quantity);
      } else if (type === 'vp') {
        price = economy.calculateVPPrice(quantity);
      }

      if (!Number.isFinite(price) || price <= 0) {
        return interaction.editReply({
          content: 'Nao foi possivel validar o valor deste pagamento. Reabra o carrinho e tente novamente.',
          embeds: [],
          components: []
        }).catch(() => {});
      }

      const loadingEmbed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Gerando PIX...')
        .setDescription('Aguarde enquanto geramos seu codigo de pagamento.');

      await interaction.editReply({ embeds: [loadingEmbed], components: [] });

      const result = await pix.generatePix(price, `Compra ${type}`, interaction.user.id, {
        product_type: type,
        product_name: `Compra ${type.toUpperCase()}`,
        quantity,
        channel_id: interaction.channel.id,
        channel_name: interaction.channel.name,
        source: 'carrinho'
      });

      if (result.success && result.qrCode) {
        const pixEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('💳 Pagamento PIX')
          .setDescription('Escaneie o QR Code ou copie o codigo abaixo.')
          .addFields(
            { name: 'Valor', value: `**${economy.formatCurrency(result.amount)}**`, inline: true },
            { name: 'Expira em', value: '30 minutos', inline: true },
            { name: 'ID', value: `\`${result.paymentId}\``, inline: true }
          )
          .setFooter({ text: 'Kyoto Vendas | Apos pagar, aguarde confirmacao' })
          .setTimestamp();

        if (result.qrCodeBase64) {
          const buffer = Buffer.from(result.qrCodeBase64, 'base64');
          const attachment = new (require('discord.js').AttachmentBuilder)(buffer, { name: 'qrcode.png' });
          pixEmbed.setImage('attachment://qrcode.png');

          const codeEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Codigo PIX (Copia e Cola)')
            .setDescription(`\`\`\`${result.qrCode}\`\`\``);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`marcar_pago_${result.paymentId}`).setLabel('Ja Paguei').setStyle(ButtonStyle.Primary)
          );

          await interaction.editReply({ embeds: [pixEmbed, codeEmbed], files: [attachment], components: [row] });
        } else {
          pixEmbed.addFields({ name: 'Codigo PIX', value: `\`\`\`${result.qrCode.substring(0, 500)}\`\`\``, inline: false });
          await interaction.editReply({ embeds: [pixEmbed] });
        }
      } else {
        const mockData = result.mock || { amount: price, qrCode: '', note: 'Configure MP_ACCESS_TOKEN' };
        
        const pixEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('💳 Pagamento PIX')
          .addFields(
            { name: 'Valor', value: `**${economy.formatCurrency(mockData.amount)}**`, inline: true },
            { name: 'Status', value: 'Aguardando', inline: true }
          )
          .setFooter({ text: 'Kyoto Vendas' });

        if (mockData.qrCode) {
          const codeEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Codigo PIX')
            .setDescription(`\`\`\`${mockData.qrCode}\`\`\``);
          await interaction.editReply({ embeds: [pixEmbed, codeEmbed] });
        } else {
          pixEmbed.addFields({ name: 'Nota', value: mockData.note, inline: false });
          await interaction.editReply({ embeds: [pixEmbed] });
        }
      }

      this.logger.transaction(interaction.user.id, 'PIX_GENERATED', price);

    } catch (error) {
      this.logger.error('HANDLER', 'Carrinho pagar error', error);
    }
  }

  async handleCarrinhoCancelar(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Carrinho Cancelado')
        .setDescription('Este canal sera excluido em 5 segundos.');

      await interaction.reply({ embeds: [embed] });

      setTimeout(async () => {
        try {
          if (interaction.channel && interaction.channel.deletable) {
            await interaction.channel.delete().catch(() => {});
          }
        } catch (e) {}
      }, 5000);

    } catch (error) {
      this.logger.error('HANDLER', 'Carrinho cancelar error', error);
    }
  }

  async handleMarcarPago(interaction) {
    try {
      const paymentId = interaction.customId.replace('marcar_pago_', '');
      const PAGO_CATEGORY = await this._resolveCategoryId(interaction.guild, 'paid');
      
      const pix = PixGenerator.getInstance();
      let paymentStatus = { status: 'pending' };
      
      if (paymentId && paymentId !== 'undefined') {
        paymentStatus = await pix.checkPaymentStatus(paymentId);
      }

      const isPaid = paymentStatus.status === 'approved';
      
      const embed = new EmbedBuilder()
        .setColor(isPaid ? 0x00FF00 : 0xFFAA00)
        .setTitle(isPaid ? '✅ Pagamento Confirmado' : '⏳ Aguardando Confirmacao')
        .setDescription(isPaid 
          ? 'Pagamento recebido! A equipe vai liberar seu produto em breve.'
          : 'Seu pagamento ainda nao foi detectado. Se ja pagou, aguarde alguns minutos.')
        .addFields({ 
          name: 'Status', 
          value: isPaid ? '🟢 Pago - Aguardando entrega' : '🟡 Aguardando pagamento', 
          inline: true 
        })
        .setFooter({ text: 'Kyoto Vendas' })
        .setTimestamp();

      if (isPaid) {
        const economy = EconomyService.getInstance();
        const db = Database.getInstance();
        const priceRow = await db.get('SELECT amount, user_id, product_type, product_name, quantity FROM transactions WHERE transaction_id = ?', [paymentId]);
        const price = priceRow?.amount || 0;
        const formattedPrice = price.toFixed(2);
        
        const currentName = `✅・${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15)}・${formattedPrice}`;
        await interaction.channel.setName(currentName).catch(() => {});
        if (PAGO_CATEGORY) {
          await interaction.channel.setParent(PAGO_CATEGORY, { lockPermissions: false });
        }
        
        // Libera mensagens e fotos apenas no canal pago
        await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
          SendMessages: true,
          AttachFiles: true,
          ViewChannel: true
        });
        
        await db.run(
          'UPDATE transactions SET status = ?, completed_at = datetime("now") WHERE transaction_id = ?',
          ['approved', paymentId]
        );

        await db.setCache(`sale_channel_${interaction.channel.id}`, {
          paymentId,
          buyerId: priceRow?.user_id || interaction.user.id,
          amount: price,
          productName: priceRow?.product_name || `Compra ${priceRow?.product_type || 'produto'}`,
          quantity: priceRow?.quantity || 1,
          channelName: interaction.channel.name,
          approvedAt: new Date().toISOString()
        }, 24 * 60 * 60);
        
        this.logger.transaction(interaction.user.id, 'PAYMENT_CONFIRMED', null);

        // Envia comprovante no próprio canal
        const comprovanteEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('🧾 Comprovante de Pagamento')
          .setDescription(`O pagamento do usuário ${interaction.user} foi confirmado com sucesso.`)
          .addFields(
            { name: 'ID da Transação', value: `\`${paymentId}\``, inline: true },
            { name: 'Status', value: '✅ Aprovado', inline: true }
          )
          .setFooter({ text: 'Kyoto Vendas | Transação verificada via API' })
          .setTimestamp();

        await interaction.channel.send({ embeds: [comprovanteEmbed] });

        // Avisar Staff e pedir marcação
        const staffRoles = ['1246115288055943213', '1246115287967727788', '1246115288055943212', '1246115287967727786'];
        const mentionString = staffRoles.map(id => `<@&${id}>`).join(' ');
        
        await interaction.channel.send({
          content: `${mentionString}\n🚀 **Pagamento Confirmado!** ${interaction.user}, por favor marque <@757012487710310440> ou <@391307885591789569> para agilizar sua entrega.`
        });

        // Botão de concluir entrega para a staff
        const entregaRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('concluir_entrega')
            .setLabel('Concluir Entrega')
            .setStyle(ButtonStyle.Success)
            .setEmoji('📦')
        );

        await interaction.channel.send({ 
          content: '🔔 **Staff, o pagamento foi confirmado!** Após entregar o produto, clique no botão abaixo para finalizar.',
          components: [entregaRow] 
        });

        // Atribuir cargo de cliente
        try {
          const roleId = '1246115287842033706';
          const member = await interaction.guild.members.fetch(interaction.user.id);
          if (member && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
            this.logger.info('SYSTEM', `Cargo de cliente atribuido a ${interaction.user.tag}`);
          }
        } catch (roleError) {
          this.logger.error('SYSTEM', 'Erro ao atribuir cargo de cliente', roleError);
        }
      }

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      this.logger.error('HANDLER', 'Marcar pago error', error);
      if (!interaction.replied) await interaction.reply({ content: 'Erro ao confirmar pagamento.', flags: 64 }).catch(() => {});
    }
  }

  async handleConcluirEntrega(interaction) {
    try {
      const staffRoles = ['1246115288055943213', '1246115288055943212', '1246115287967727788', '1246115287967727786'];
      const isStaff = interaction.member.roles.cache.some(r => staffRoles.includes(r.id)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (!isStaff) {
        return interaction.reply({ content: 'Apenas a staff autorizada pode concluir a entrega.', flags: 64 });
      }

      await interaction.deferUpdate();

      const db = Database.getInstance();
      const now = new Date();
      const { date, time } = this._formatDateParts(now);

      const saleMeta = await db.getCache(`sale_channel_${interaction.channel.id}`);
      const buyerIdFromChannel = this._getBuyerIdFromChannel(interaction.channel);
      const buyerId = saleMeta?.buyerId || buyerIdFromChannel;

      let transaction = null;
      if (saleMeta?.paymentId) {
        transaction = await db.get('SELECT * FROM transactions WHERE transaction_id = ?', [saleMeta.paymentId]);
      }
      if (!transaction && buyerId) {
        transaction = await db.get(
          'SELECT * FROM transactions WHERE user_id = ? AND status = "approved" ORDER BY completed_at DESC, created_at DESC LIMIT 1',
          [buyerId]
        );
      }

      const buyerMember = buyerId ? await interaction.guild.members.fetch(buyerId).catch(() => null) : null;
      const buyerTag = buyerMember?.user?.tag || 'Nao identificado';
      const buyerMention = buyerMember ? `<@${buyerMember.id}>` : 'Nao identificado';
      const productSummary = this._buildProductSummary(transaction);
      const amountValue = Number(transaction?.amount || saleMeta?.amount || 0);
      const channelSnapshot = saleMeta?.channelName || interaction.channel.name;

      const embed = new EmbedBuilder()
        .setColor(THEME_COLOR)
        .setTitle('📦 Entrega Concluída')
        .setDescription('Pedido finalizado e pronto para arquivamento.')
        .addFields(
          { name: '👨‍💼 Entregue por', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: '🧑‍💻 Recebido por', value: `${buyerMention} (${buyerTag})`, inline: true },
          { name: '🧾 Produto', value: productSummary, inline: false },
          { name: '💰 Valor', value: amountValue > 0 ? EconomyService.getInstance().formatCurrency(amountValue) : 'Nao identificado', inline: true },
          { name: '🗂️ Canal', value: `${channelSnapshot} (ID: ${interaction.channel.id})`, inline: true },
          { name: '📅 Data', value: date, inline: true },
          { name: '🕒 Hora', value: time, inline: true }
        )
        .setFooter({ text: 'Este canal será arquivado e fechado em 10 segundos.' })
        .setTimestamp();

      await interaction.editReply({ components: [] }); // Remove o botão
      await interaction.channel.send({ embeds: [embed] });

      // Enviar logs de venda (simples e avancado)
      try {
        const legacyConfig = await db.get(
          'SELECT value FROM cache WHERE key = ? LIMIT 1',
          [`logs_${interaction.guild.id}_vendas`]
        );
        const simpleConfig = await db.get(
          'SELECT value FROM cache WHERE key = ? LIMIT 1',
          [`logs_${interaction.guild.id}_vendas_simples`]
        );
        const advancedConfig = await db.get(
          'SELECT value FROM cache WHERE key = ? LIMIT 1',
          [`logs_${interaction.guild.id}_vendas_avancado`]
        );
        const fallbackRow = await db.get('SELECT details FROM logs WHERE type = "vendas_channel" ORDER BY id DESC LIMIT 1');

        const simpleChannelId = simpleConfig?.value || legacyConfig?.value || fallbackRow?.details || null;
        const advancedChannelId = advancedConfig?.value || null;

        const logNow = new Date();
        const { date: logDate, time: logTime } = this._formatDateParts(logNow);
        const amountText = amountValue > 0 ? EconomyService.getInstance().formatCurrency(amountValue) : 'Nao identificado';

        const simpleEmbed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Venda concluida')
          .setDescription('Resumo da venda finalizada')
          .addFields(
            { name: 'Comprador', value: `${buyerMention} (${buyerTag})`, inline: true },
            { name: 'Entregue por', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
            { name: 'Produto', value: productSummary, inline: false },
            { name: 'Valor', value: amountText, inline: true },
            { name: 'Canal', value: `${channelSnapshot}`, inline: true },
            { name: 'Data', value: logDate, inline: true },
            { name: 'Hora', value: logTime, inline: true }
          )
          .setFooter({ text: 'Kyoto Store | Log de vendas simples' })
          .setTimestamp();

        const advancedEmbed = new EmbedBuilder()
          .setColor(THEME_COLOR)
          .setTitle('Venda concluida (detalhado)')
          .setDescription('Informacoes avancadas para auditoria interna')
          .addFields(
            { name: 'Comprador', value: `${buyerMention} (${buyerTag})`, inline: true },
            { name: 'Comprador ID', value: buyerId || 'Nao identificado', inline: true },
            { name: 'Entregue por', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
            { name: 'Entregador ID', value: interaction.user.id, inline: true },
            { name: 'Produto', value: productSummary, inline: false },
            { name: 'Valor', value: amountText, inline: true },
            { name: 'Quantidade', value: `${Number(transaction?.quantity || saleMeta?.quantity || 1)}`, inline: true },
            { name: 'Tipo', value: transaction?.product_type || 'Nao identificado', inline: true },
            { name: 'Canal', value: `${channelSnapshot} (ID: ${interaction.channel.id})`, inline: false },
            { name: 'Transacao', value: saleMeta?.paymentId || transaction?.transaction_id || 'N/A', inline: true },
            { name: 'Status', value: transaction?.status || 'approved', inline: true },
            { name: 'Data/Hora', value: `${logDate} ${logTime}`, inline: true }
          )
          .setFooter({ text: 'Kyoto Store | Log de vendas avancado' })
          .setTimestamp();

        const simpleChannel = simpleChannelId
          ? await interaction.guild.channels.fetch(simpleChannelId).catch(() => null)
          : null;
        if (simpleChannel) {
          await simpleChannel.send({ embeds: [simpleEmbed] });
        }

        const advancedChannel = advancedChannelId
          ? await interaction.guild.channels.fetch(advancedChannelId).catch(() => null)
          : null;
        if (advancedChannel) {
          await advancedChannel.send({ embeds: [advancedEmbed] });
        }
      } catch (logError) {
        this.logger.error('SYSTEM', 'Erro ao enviar log de venda', logError);
      }

      // Fecha o ticket/carrinho
      setTimeout(async () => {
        try {
          if (interaction.channel && interaction.channel.deletable) {
            await interaction.channel.delete().catch(() => {});
          }
        } catch (e) {}
      }, 10000);

    } catch (error) {
      this.logger.error('HANDLER', 'Concluir entrega error', error);
    }
  }

  async handleTicketOpen(interaction) {
    try {
      const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) || interaction.user.id;
      
      const existingTicket = interaction.guild.channels.cache.find(
        ch => ch.name === `ticket-${safeName}`
      );
      
      if (existingTicket) {
        return interaction.reply({
          content: `Voce ja tem um ticket aberto: ${existingTicket}`,
          flags: 64
        });
      }
      
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${safeName}`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
          },
          {
            id: interaction.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
          },
          {
            id: this.client.user.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels]
          }
        ]
      });
      
      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Ticket de Suporte')
        .setDescription(`Bem-vindo, ${interaction.user}!\n\nO chat já está **aberto** para você descrever seu problema.`)
        .addFields(
          { name: 'Status', value: '🟢 Aberto', inline: true },
          { name: 'Aberto por', value: interaction.user.tag, inline: true }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise' })
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_claim')
          .setLabel('Assumir Ticket')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_close')
          .setLabel('Fechar Ticket')
          .setStyle(ButtonStyle.Danger)
      );
      
      await ticketChannel.send({ embeds: [embed], components: [row] });
      
      await interaction.reply({
        content: `Ticket criado: ${ticketChannel}`,
        flags: 64
      });
      
      this.logger.transaction(interaction.user.id, 'TICKET_CREATED');
      
    } catch (error) {
      this.logger.error('BUTTON', 'Ticket open error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao criar ticket.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleTicketUnlock(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: 'Voce nao tem permissao para liberar o chat.',
          flags: 64
        });
      }
      
      const ticketOwnerName = interaction.channel.name.replace('ticket-', '');
      const members = await interaction.guild.members.fetch();
      const ticketOwner = members.find(m => 
        m.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20) === ticketOwnerName ||
        m.user.id === ticketOwnerName
      );
      
      if (ticketOwner) {
        await interaction.channel.permissionOverwrites.edit(ticketOwner.id, {
          SendMessages: true,
          AttachFiles: true
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Chat Liberado')
        .setDescription(`${interaction.user} liberou o chat. Agora voce pode enviar mensagens.`)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
    } catch (error) {
      this.logger.error('BUTTON', 'Ticket unlock error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao liberar chat.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleTicketClose(interaction) {
    try {
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.reply({
          content: 'Este botao so funciona dentro de tickets.',
          flags: 64
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Ticket Encerrado')
        .setDescription('Este ticket sera excluido em 5 segundos.')
        .addFields({ name: 'Fechado por', value: interaction.user.tag })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
      this.logger.transaction(interaction.user.id, 'TICKET_CLOSED');
      
      setTimeout(async () => {
        try {
          if (interaction.channel && interaction.channel.deletable) {
            await interaction.channel.delete().catch(() => {});
          }
        } catch (e) {
          this.logger.error('BUTTON', 'Failed to delete ticket channel', e);
        }
      }, 5000);
      
    } catch (error) {
      this.logger.error('BUTTON', 'Ticket close error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao fechar ticket.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleTicketClaim(interaction) {
    try {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({
          content: 'Voce nao tem permissao para assumir tickets.',
          flags: 64
        });
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Ticket Assumido')
        .setDescription(`${interaction.user} assumiu este ticket.`)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed] });
      
      this.logger.transaction(interaction.user.id, 'TICKET_CLAIMED');
      
    } catch (error) {
      this.logger.error('BUTTON', 'Ticket claim error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao assumir ticket.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleVenderCancel(interaction) {
    try {
      await interaction.update({
        content: 'Venda cancelada.',
        embeds: [],
        components: []
      });
    } catch (error) {
      this.logger.error('BUTTON', 'Vender cancel error', error);
    }
  }

  async handleVenderRobuxQty(interaction) {
    try {
      const value = interaction.values[0];
      const parts = value.split('_');
      const quantity = parseInt(parts[1]) || 1000;
      const economy = EconomyService.getInstance();
      const priceInfo = economy.calculatePrice(quantity, 'robux');
      
      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Confirmar Venda de Robux')
        .addFields(
          { name: 'Quantidade', value: `**${quantity.toLocaleString()} Robux**`, inline: true },
          { name: 'Preco Base', value: economy.formatCurrency(priceInfo.basePrice), inline: true },
          { name: 'Taxa MP (0.99%)', value: economy.formatCurrency(priceInfo.tax), inline: true },
          { name: 'Total a Cobrar', value: `**${economy.formatCurrency(priceInfo.finalPrice)}**`, inline: false }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise | Taxa incluida no total' })
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vender_confirm_robux_${quantity}`)
          .setLabel('Gerar PIX')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('vender_cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      
    } catch (error) {
      this.logger.error('BUTTON', 'Vender robux qty error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao processar selecao.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleVenderVpQty(interaction) {
    try {
      const value = interaction.values[0];
      const parts = value.split('_');
      const quantity = parseInt(parts[1]) || 740;
      const economy = EconomyService.getInstance();
      const priceInfo = economy.calculatePrice(quantity, 'vp');
      
      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Confirmar Venda de VP')
        .addFields(
          { name: 'Quantidade', value: `**${quantity.toLocaleString()} VP**`, inline: true },
          { name: 'Preco Base', value: economy.formatCurrency(priceInfo.basePrice), inline: true },
          { name: 'Taxa MP (0.99%)', value: economy.formatCurrency(priceInfo.tax), inline: true },
          { name: 'Total a Cobrar', value: `**${economy.formatCurrency(priceInfo.finalPrice)}**`, inline: false }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise | Taxa incluida no total' })
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vender_confirm_vp_${quantity}`)
          .setLabel('Gerar PIX')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('vender_cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      
    } catch (error) {
      this.logger.error('BUTTON', 'Vender vp qty error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao processar selecao.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleLojaComprar(interaction) {
    try {
      const productId = interaction.values[0];
      const db = Database.getInstance();
      const product = await db.get('SELECT * FROM products WHERE id = ? AND active = 1', [productId]);
      
      if (!product) {
        return interaction.reply({ content: 'Produto nao encontrado.', flags: 64 });
      }
      
      const economy = EconomyService.getInstance();
      const finalPrice = economy.applyMPTax(product.price);
      const taxa = finalPrice - product.price;
      
      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Confirmar Compra')
        .addFields(
          { name: 'Produto', value: `**${product.name}**`, inline: true },
          { name: 'Preco Base', value: economy.formatCurrency(product.price), inline: true },
          { name: 'Taxa MP (0.99%)', value: economy.formatCurrency(taxa), inline: true },
          { name: 'Total a Pagar', value: `**${economy.formatCurrency(finalPrice)}**`, inline: false }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise | Taxa incluida' })
        .setTimestamp();
      
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vender_confirm_produto_${productId}_${finalPrice.toFixed(2)}`)
          .setLabel('Gerar PIX')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('vender_cancel')
          .setLabel('Cancelar')
          .setStyle(ButtonStyle.Secondary)
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      
    } catch (error) {
      this.logger.error('BUTTON', 'Loja comprar error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao processar compra.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handleVenderConfirmButton(interaction) {
    try {
      const actionKey = `vender_confirm:${interaction.user.id}:${interaction.channelId}:${interaction.customId}`;
      if (!this._acquireActionLock(actionKey, 10000)) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferUpdate().catch(() => {});
        }
        return;
      }

      const customId = interaction.customId;
      const parts = customId.replace('vender_confirm_', '').split('_');
      const type = parts[0];
      
      const economy = EconomyService.getInstance();
      let amount = 38.00;
      let quantity = 0;
      
      if (type === 'robux') {
        quantity = parseInt(parts[1]) || 1000;
        const priceInfo = economy.calculatePrice(quantity, 'robux');
        amount = priceInfo.finalPrice;
      } else if (type === 'vp') {
        quantity = parseInt(parts[1]) || 740;
        const priceInfo = economy.calculatePrice(quantity, 'vp');
        amount = priceInfo.finalPrice;
      } else if (type === 'custom') {
        amount = parseFloat(parts[1]) || 38.00;
        quantity = 1;
      } else if (type === 'produto') {
        amount = parseFloat(parts[2]) || 38.00;
        quantity = 1;
      } else {
        amount = economy.applyMPTax(38.00);
        quantity = 1000;
      }
      
      const loadingEmbed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Gerando PIX...')
        .setDescription('Aguarde enquanto o codigo PIX e gerado.')
        .setFooter({ text: 'Kyoto Bot Enterprise' });
      
      await interaction.update({ embeds: [loadingEmbed], components: [] });
      
      const pix = PixGenerator.getInstance();
      const result = await pix.generatePix(amount, `Venda ${type.toUpperCase()} - ${quantity}`, interaction.user.id, {
        product_type: type,
        product_name: `Venda ${type.toUpperCase()}`,
        quantity,
        channel_id: interaction.channel.id,
        channel_name: interaction.channel.name,
        source: 'vender'
      });
      
      if (result.success && result.qrCode) {
        const pixEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('Pagamento PIX')
          .setDescription('Escaneie o QR Code abaixo ou copie o codigo.')
          .addFields(
            { name: '\u200b', value: '\u200b', inline: false },
            { name: 'Valor', value: `**${pix.formatCurrency(result.amount)}**`, inline: true },
            { name: 'Expira em', value: '**30 minutos**', inline: true },
            { name: 'ID', value: `\`${result.paymentId}\``, inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise | Pagamento via Mercado Pago' })
          .setTimestamp();
        
        if (result.qrCodeBase64) {
          const buffer = Buffer.from(result.qrCodeBase64, 'base64');
          const attachment = new (require('discord.js').AttachmentBuilder)(buffer, { name: 'qrcode.png' });
          pixEmbed.setImage('attachment://qrcode.png');
          
          const codeEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Codigo PIX (Copia e Cola)')
            .setDescription(`\`\`\`${result.qrCode}\`\`\``);
          
          await interaction.editReply({ embeds: [pixEmbed, codeEmbed], files: [attachment] });
        } else {
          pixEmbed.addFields({ name: 'Codigo PIX', value: `\`\`\`${result.qrCode.substring(0, 800)}\`\`\``, inline: false });
          await interaction.editReply({ embeds: [pixEmbed] });
        }
      } else {
        const mockData = result.mock || { amount, note: 'Configure MP_ACCESS_TOKEN para PIX real.', qrCode: '' };
        
        const pixEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('Pagamento PIX')
          .setDescription('Copie o codigo abaixo e cole no app do seu banco.')
          .addFields(
            { name: '\u200b', value: '\u200b', inline: false },
            { name: 'Valor', value: `**${pix.formatCurrency(mockData.amount)}**`, inline: true },
            { name: 'Expira em', value: '**30 minutos**', inline: true },
            { name: 'Status', value: '`Aguardando`', inline: true }
          )
          .setFooter({ text: 'Kyoto Bot Enterprise' })
          .setTimestamp();
        
        if (mockData.qrCode) {
          const codeEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Codigo PIX (Copia e Cola)')
            .setDescription(`\`\`\`${mockData.qrCode}\`\`\``);
          
          await interaction.editReply({ embeds: [pixEmbed, codeEmbed] });
        } else {
          pixEmbed.addFields({ name: 'Nota', value: mockData.note || 'PIX em modo demonstracao.', inline: false });
          await interaction.editReply({ embeds: [pixEmbed] });
        }
      }
      
      this.logger.transaction(interaction.user.id, 'PIX_REQUESTED', amount);
      
    } catch (error) {
      this.logger.error('BUTTON', 'Vender confirm error', error);
      try {
        await interaction.editReply({ content: 'Erro ao gerar PIX.', embeds: [], components: [] });
      } catch (e) {}
    }
  }

  async handlePainelRefresh(interaction) {
    try {
      const economy = EconomyService.getInstance();
      const db = Database.getInstance();
      
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const memoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      
      const products = await db.all('SELECT COUNT(*) as count FROM products WHERE active = 1');
      const transactions = await db.all('SELECT COUNT(*) as count FROM transactions');
      
      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('Painel de Controle - Atualizado')
        .addFields(
          { name: 'Status', value: `\`\`\`\nBot: Online\nPing: ${this.client.ws.ping}ms\nUptime: ${hours}h ${minutes}m\nMemoria: ${memoryMB}MB\n\`\`\``, inline: true },
          { name: 'Estatisticas', value: `\`\`\`\nServidores: ${this.client.guilds.cache.size}\nProdutos: ${products[0]?.count || 0}\nTransacoes: ${transactions[0]?.count || 0}\n\`\`\``, inline: true }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise' })
        .setTimestamp();
      
      await interaction.update({ embeds: [embed] });
    } catch (error) {
      this.logger.error('BUTTON', 'Painel refresh error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao atualizar painel.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handlePainelHealth(interaction) {
    try {
      const pix = PixGenerator.getInstance();
      const pixStatus = pix.accessToken ? '🟢 Configurado' : '🟡 Demo Mode';
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Health Check')
        .addFields(
          { name: 'Discord Gateway', value: `🟢 ${this.client.ws.ping}ms`, inline: true },
          { name: 'Database', value: '🟢 OK', inline: true },
          { name: 'Mercado Pago', value: pixStatus, inline: true },
          { name: 'Memoria', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
          { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)} min`, inline: true }
        )
        .setFooter({ text: 'Kyoto Bot Enterprise' })
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      this.logger.error('BUTTON', 'Health check error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro no health check.', flags: 64 }).catch(() => {});
      }
    }
  }

  async handlePainelClose(interaction) {
    try {
      await interaction.update({ content: 'Painel fechado.', embeds: [], components: [] });
    } catch (error) {
      this.logger.error('BUTTON', 'Painel close error', error);
    }
  }

  async handlePainelMenu(interaction) {
    try {
      const value = interaction.values[0];
      const db = Database.getInstance();
      
      let embed;
      
      switch (value) {
        case 'status':
          const uptime = process.uptime();
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Status Detalhado')
            .addFields(
              { name: 'Uptime', value: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`, inline: true },
              { name: 'Ping', value: `${this.client.ws.ping}ms`, inline: true },
              { name: 'Memoria', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
              { name: 'Node.js', value: process.version, inline: true },
              { name: 'Servidores', value: `${this.client.guilds.cache.size}`, inline: true },
              { name: 'Usuarios', value: `${this.client.users.cache.size}`, inline: true }
            )
            .setFooter({ text: 'Kyoto Bot Enterprise' })
            .setTimestamp();
          break;
          
        case 'produtos':
          const products = await db.all('SELECT * FROM products WHERE active = 1 LIMIT 10');
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Produtos Ativos')
            .setDescription(products.length > 0 ? products.map(p => `• ${p.name} - R$ ${p.price.toFixed(2)}`).join('\n') : 'Nenhum produto cadastrado. Use /loja adicionar')
            .setFooter({ text: 'Kyoto Bot Enterprise' })
            .setTimestamp();
          break;
          
        case 'canais':
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Configuracao de Canais')
            .setDescription('Use /setlogs para logs gerais e /setvendas para logs de venda simples e avancado.')
            .setFooter({ text: 'Kyoto Bot Enterprise' })
            .setTimestamp();
          break;
          
        case 'apis':
          const pix = PixGenerator.getInstance();
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Status das APIs')
            .addFields(
              { name: 'Discord Gateway', value: `🟢 ${this.client.ws.ping}ms`, inline: true },
              { name: 'Mercado Pago', value: pix.accessToken ? '🟢 Configurado' : '🟡 Demo', inline: true },
              { name: 'Database', value: '🟢 SQLite OK', inline: true }
            )
            .setFooter({ text: 'Kyoto Bot Enterprise' })
            .setTimestamp();
          break;
          
        case 'backup':
          await db.backup();
          embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Backup Criado')
            .setDescription('Backup do banco de dados criado com sucesso!')
            .setFooter({ text: 'Kyoto Bot Enterprise' })
            .setTimestamp();
          break;
          
        default:
          embed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Info')
            .setDescription('Opcao nao reconhecida.')
            .setTimestamp();
      }
      
      await interaction.reply({ embeds: [embed], flags: 64 });
    } catch (error) {
      this.logger.error('BUTTON', 'Painel menu error', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Erro ao processar opcao.', flags: 64 }).catch(() => {});
      }
    }
  }
}

module.exports = ButtonHandlers;
