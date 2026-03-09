/**
 * KYOTO BOT - PANEL LAYOUTS
 * Layout centralizado para paineis de venda e refresh sem recriar mensagem.
 */

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const THEME_COLOR = 0x1c6dbd;
const BRAND_BANNER_URL = 'https://i.imgur.com/tzvtTzR.png';
const BRAND_LOGO_URL = 'https://i.imgur.com/2zPT1Fw.png';
const PANEL_INDEX_KEY = 'panels:index';
const PANEL_ACTIVE_PREFIX = 'panel:active';
const PANEL_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

function normalizeVisualMode(mode) {
  const normalized = String(mode || 'ambos').toLowerCase();
  if (['logo', 'banner', 'ambos', 'nenhum'].includes(normalized)) {
    return normalized;
  }
  return 'ambos';
}

function sanitizeToken(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 40) || 'item';
}

function getBrandFiles(mode = 'ambos') {
  // Branding por URL fixa nao precisa anexar arquivos.
  return [];
}

function applyBranding(embed, mode = 'ambos') {
  const visualMode = normalizeVisualMode(mode);

  if ((visualMode === 'ambos' || visualMode === 'banner') && BRAND_BANNER_URL) {
    embed.setImage(BRAND_BANNER_URL);
  }

  if ((visualMode === 'ambos' || visualMode === 'logo') && BRAND_LOGO_URL) {
    embed.setThumbnail(BRAND_LOGO_URL);
  }

  return embed;
}

function cleanTitle(rawTitle, fallback = 'KYOTO STORE') {
  const clean = String(rawTitle || '').replace(/[^\w\s|.-]/g, '').trim();
  return clean || fallback;
}

function buildRobuxPanel(economy, rawPayload = {}) {
  const visualMode = normalizeVisualMode(rawPayload.visualMode || 'ambos');
  const quantities = [400, 800, 1000, 2000, 5000, 10000, 20000];
  const options = quantities.map((qty) => {
    const price = economy.calculateFinalPrice(qty);
    return {
      label: `${qty.toLocaleString('pt-BR')} Robux`,
      description: `${economy.formatCurrency(price)}`,
      value: `painel_robux_${qty}_${price.toFixed(2)}`
    };
  });

  const embed = applyBranding(
    new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('KYOTO STORE | ROBUX')
      .setDescription('Selecione um pacote para iniciar sua compra.')
      .addFields(
        { name: 'Pagamento', value: 'Pix', inline: true },
        { name: 'Entrega', value: 'Grupo/Gamepass', inline: true }
      )
      .setFooter({ text: 'Kyoto Store | Painel oficial de vendas' }),
    visualMode
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('painel_comprar')
      .setPlaceholder('Selecione o pacote de Robux')
      .addOptions(options)
  );

  return {
    panelType: 'robux',
    payload: { visualMode },
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(visualMode)
    }
  };
}

function buildVPPanel(economy, rawPayload = {}) {
  const visualMode = normalizeVisualMode(rawPayload.visualMode || 'ambos');
  const quantities = [475, 1000, 2050, 3650, 5350, 11000];
  const options = quantities.map((qty) => {
    const price = economy.calculateVPPrice(qty);
    return {
      label: `${qty.toLocaleString('pt-BR')} VP`,
      description: `${economy.formatCurrency(price)}`,
      value: `painel_vp_${qty}_${price.toFixed(2)}`
    };
  });

  const embed = applyBranding(
    new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle('KYOTO STORE | VALORANT POINTS')
      .setDescription('Escolha o pacote de VP para continuar sua compra.')
      .addFields(
        { name: 'Pagamento', value: 'Pix', inline: true },
        { name: 'Entrega', value: 'Gift Card', inline: true }
      )
      .setFooter({ text: 'Kyoto Store | Painel oficial de vendas' }),
    visualMode
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('painel_comprar')
      .setPlaceholder('Selecione o pacote de VP')
      .addOptions(options)
  );

  return {
    panelType: 'vp',
    payload: { visualMode },
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(visualMode)
    }
  };
}

function buildContaPanel(economy, client, rawPayload = {}) {
  const visualMode = normalizeVisualMode(rawPayload.visualMode || 'nenhum');
  const precoBase = Number(rawPayload.precoBase ?? rawPayload.preco ?? 0);
  const precoFinal = economy.applyMPTax(precoBase);
  const payload = {
    nome: rawPayload.nome || 'Conta Valorant',
    precoBase,
    preco: precoFinal,
    descricao: rawPayload.descricao || 'Conta disponivel para venda imediata.',
    elo: rawPayload.elo || 'Nao informado',
    skins: rawPayload.skins || 'Nao informado',
    chaveiros: rawPayload.chaveiros || 'Nao informado',
    imagemUrl: rawPayload.imagemUrl || null,
    visualMode
  };

  const infoToken = client.buttonHandlers?.storeAccountInfo({
    nome: payload.nome,
    elo: payload.elo,
    skins: payload.skins,
    chaveiros: payload.chaveiros
  }) || 'expired';

  const buildLine = (title, value) => `${title}: ${String(value || 'Nao informado').trim()}`;
  const adaptiveDescription = [
    buildLine('Elo', payload.elo),
    buildLine('Skins', payload.skins),
    buildLine('Chaveiros', payload.chaveiros)
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLOR)
    .setTitle(cleanTitle(payload.nome, 'Conta Valorant'))
    .setDescription(adaptiveDescription)
    .addFields(
      { name: 'Preco', value: `**${economy.formatCurrency(precoFinal)}**`, inline: true },
      { name: 'Categoria', value: 'Conta Valorant', inline: true },
      { name: 'Status', value: 'Disponivel', inline: true }
    )
    .setFooter({ text: 'Kyoto Store | Painel de anuncio de conta' });

  if (payload.imagemUrl) {
    embed.setImage(payload.imagemUrl);
  }

  // Branding tem prioridade quando visualMode e logo/banner.
  applyBranding(embed, payload.visualMode);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`comprar_conta_${precoFinal.toFixed(2)}`)
      .setLabel('Comprar agora')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`conta_info_${infoToken}`)
      .setLabel('Mais detalhes')
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    panelType: 'conta',
    payload,
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(payload.visualMode)
    }
  };
}

function buildPersonalizadoPanel(economy, rawPayload = {}) {
  const visualMode = normalizeVisualMode(rawPayload.visualMode || 'ambos');
  const nome = rawPayload.nome || 'Produto';
  const payload = {
    nome,
    precoBase: Number(rawPayload.precoBase || 0),
    descricao: rawPayload.descricao || 'Produto disponivel para compra imediata.',
    visualMode,
    singletonKey: `personalizado:${sanitizeToken(nome)}`
  };

  const precoFinal = economy.applyMPTax(payload.precoBase);

  const embed = applyBranding(
    new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`KYOTO STORE | ${cleanTitle(payload.nome, 'PRODUTO')}`)
      .setDescription(payload.descricao)
      .addFields(
        { name: 'Preco final', value: `**${economy.formatCurrency(precoFinal)}**`, inline: true },
        { name: 'Pagamento', value: 'Pix', inline: true }
      )
      .setFooter({ text: 'Kyoto Store | Painel personalizado' }),
    visualMode
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`comprar_produto_${precoFinal.toFixed(2)}`)
      .setLabel('Comprar')
      .setStyle(ButtonStyle.Success)
  );

  return {
    panelType: 'personalizado',
    payload,
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(visualMode)
    }
  };
}

function buildMultiPanel(economy, rawPayload = {}) {
  const visualMode = normalizeVisualMode(rawPayload.visualMode || 'ambos');
  const titulo = rawPayload.titulo || 'Painel de planos';
  const payload = {
    titulo,
    descricao: rawPayload.descricao || 'Selecione uma opcao para continuar a compra.',
    opcoes: Array.isArray(rawPayload.opcoes) ? rawPayload.opcoes : [],
    visualMode,
    singletonKey: `multi:${sanitizeToken(titulo)}`
  };

  const options = payload.opcoes.map((item, index) => {
    const nome = cleanTitle(item.nome || `Opcao ${index + 1}`, `Opcao ${index + 1}`);
    const precoBase = Number(item.precoBase || 0);
    const precoFinal = Number(item.precoFinal || economy.applyMPTax(precoBase));

    return {
      label: nome,
      description: `${economy.formatCurrency(precoFinal)}`,
      value: `painel_prod_${sanitizeToken(nome)}_${precoFinal.toFixed(2)}`
    };
  }).slice(0, 25);

  const embed = applyBranding(
    new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(`KYOTO STORE | ${cleanTitle(payload.titulo, 'PLANOS')}`)
      .setDescription(payload.descricao)
      .addFields(
        { name: 'Pagamento', value: 'Pix', inline: true }
      )
      .setFooter({ text: 'Kyoto Store | Painel multi-opcao' }),
    visualMode
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('painel_comprar')
      .setPlaceholder('Selecione um plano')
      .addOptions(options)
  );

  return {
    panelType: 'multi',
    payload,
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(visualMode)
    }
  };
}

function buildTicketSupportPanel(rawPayload = {}) {
  const payload = {
    titulo: rawPayload.titulo || 'Central de Suporte',
    descricao: rawPayload.descricao || 'Selecione a categoria para abrir seu atendimento.',
    visualMode: normalizeVisualMode(rawPayload.visualMode || 'ambos')
  };

  const embed = applyBranding(
    new EmbedBuilder()
      .setColor(THEME_COLOR)
      .setTitle(payload.titulo)
      .setDescription(payload.descricao)
      .addFields(
        { name: 'Suporte tecnico', value: 'Problemas, erros e validacoes tecnicas.', inline: true },
        { name: 'Atendimento', value: 'Pedidos, entregas e acompanhamento.', inline: true },
        { name: 'Duvidas', value: 'Perguntas gerais sobre a loja.', inline: true },
        { name: 'Parceria', value: 'Solicitacoes de parceria e propostas comerciais.', inline: true }
      )
      .setFooter({ text: 'Kyoto Store | Painel oficial de suporte' }),
    payload.visualMode
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_categoria')
      .setPlaceholder('Selecione a categoria de atendimento')
      .addOptions([
        { label: 'Suporte Tecnico', description: 'Problemas tecnicos, bugs ou erros', value: 'suporte' },
        { label: 'Atendimento', description: 'Compras, entregas e pagamentos', value: 'atendimento' },
        { label: 'Duvidas', description: 'Perguntas gerais e informacoes', value: 'duvidas' },
        { label: 'Parceria', description: 'Propostas de parceria e afiliacao', value: 'parceria' }
      ])
  );

  return {
    panelType: 'ticket',
    payload,
    messageData: {
      embeds: [embed],
      components: [row],
      files: getBrandFiles(payload.visualMode)
    }
  };
}

async function savePanelRecord(db, message, panelType, payload = {}) {
  const record = {
    panelType,
    payload,
    channelId: message.channelId,
    messageId: message.id,
    updatedAt: new Date().toISOString()
  };

  await db.setCache(`panel:${message.id}`, record, PANEL_TTL_SECONDS);

  const payloadKey = payload?.singletonKey ? String(payload.singletonKey) : 'default';
  const activeKey = `${PANEL_ACTIVE_PREFIX}:${message.channelId}:${panelType}:${payloadKey}`;
  await db.setCache(activeKey, {
    messageId: message.id,
    channelId: message.channelId,
    panelType,
    payload
  }, PANEL_TTL_SECONDS);

  const currentIndex = (await db.getCache(PANEL_INDEX_KEY)) || [];
  const merged = Array.from(new Set([...currentIndex, message.id])).slice(-1500);
  await db.setCache(PANEL_INDEX_KEY, merged, PANEL_TTL_SECONDS);
}

async function getPanelRecords(db) {
  const index = (await db.getCache(PANEL_INDEX_KEY)) || [];
  const records = [];

  for (const messageId of index) {
    const record = await db.getCache(`panel:${messageId}`);
    if (record && record.messageId && record.channelId && record.panelType) {
      records.push(record);
    }
  }

  return records;
}

function _isNewerMessageId(a, b) {
  try {
    return BigInt(String(a || '0')) > BigInt(String(b || '0'));
  } catch (_) {
    return String(a || '') > String(b || '');
  }
}

async function publishSingletonPanel(db, channel, panelType, payload, messageData) {
  const payloadKey = payload?.singletonKey ? String(payload.singletonKey) : null;
  const resolvedPayloadKey = payloadKey || 'default';
  const activeKey = `${PANEL_ACTIVE_PREFIX}:${channel.id}:${panelType}:${resolvedPayloadKey}`;

  const activeRef = await db.getCache(activeKey).catch(() => null);
  if (activeRef?.messageId) {
    const activeMsg = await channel.messages.fetch(activeRef.messageId).catch(() => null);
    if (activeMsg && activeMsg.author?.id === channel.client.user.id) {
      await activeMsg.edit(messageData);
      await savePanelRecord(db, activeMsg, panelType, payload);
      return { message: activeMsg, created: false, removed: 0 };
    }
  }

  const records = (await getPanelRecords(db)).filter((record) =>
    record.channelId === channel.id
    && record.panelType === panelType
    && (payloadKey ? String(record?.payload?.singletonKey || '') === payloadKey : true)
  );

  const found = [];
  for (const record of records) {
    const msg = await channel.messages.fetch(record.messageId).catch(() => null);
    if (!msg || msg.author?.id !== channel.client.user.id) continue;
    found.push(msg);
  }

  let primary = null;
  for (const msg of found) {
    if (!primary || _isNewerMessageId(msg.id, primary.id)) {
      primary = msg;
    }
  }

  if (!primary) {
    primary = await channel.send(messageData);
    await savePanelRecord(db, primary, panelType, payload);
    return { message: primary, created: true, removed: 0 };
  }

  await primary.edit(messageData);
  await savePanelRecord(db, primary, panelType, payload);

  let removed = 0;
  for (const msg of found) {
    if (msg.id === primary.id) continue;
    await msg.delete().catch(() => {});
    removed += 1;
  }

  return { message: primary, created: false, removed };
}

async function getActivePanelByContext(db, channel, panelType, payload = {}) {
  const payloadKey = payload?.singletonKey ? String(payload.singletonKey) : null;
  const resolvedPayloadKey = payloadKey || 'default';
  const activeKey = `${PANEL_ACTIVE_PREFIX}:${channel.id}:${panelType}:${resolvedPayloadKey}`;
  const activeRef = await db.getCache(activeKey).catch(() => null);

  if (activeRef?.messageId) {
    const fastMsg = await channel.messages.fetch(activeRef.messageId).catch(() => null);
    if (fastMsg && fastMsg.author?.id === channel.client.user.id) {
      return fastMsg;
    }
  }

  const records = (await getPanelRecords(db)).filter((record) =>
    record.channelId === channel.id
    && record.panelType === panelType
    && (payloadKey ? String(record?.payload?.singletonKey || '') === payloadKey : true)
  );

  let active = null;
  for (const record of records) {
    const msg = await channel.messages.fetch(record.messageId).catch(() => null);
    if (!msg || msg.author?.id !== channel.client.user.id) continue;
    if (!active || _isNewerMessageId(msg.id, active.id)) {
      active = msg;
    }
  }

  return active;
}

function inferRecordFromMessage(message) {
  const embed = message.embeds?.[0];
  const components = message.components || [];
  const firstComponent = components[0]?.components?.[0];

  if (!firstComponent) return null;

  const imageUrl = embed?.image?.url || '';
  const thumbnailUrl = embed?.thumbnail?.url || '';
  let visualMode = 'nenhum';
  if (imageUrl && thumbnailUrl) visualMode = 'ambos';
  else if (imageUrl) visualMode = 'banner';
  else if (thumbnailUrl) visualMode = 'logo';

  if (firstComponent.customId === 'painel_comprar' && firstComponent.options?.length) {
    const firstValue = firstComponent.options[0].value || '';

    if (firstValue.startsWith('painel_robux_')) {
      return { panelType: 'robux', payload: { visualMode } };
    }

    if (firstValue.startsWith('painel_vp_')) {
      return { panelType: 'vp', payload: { visualMode } };
    }

    if (firstValue.startsWith('painel_prod_')) {
      const opcoes = firstComponent.options.map((opt) => {
        const parts = String(opt.value || '').split('_');
        const precoFinal = Number(parts[parts.length - 1] || 0);
        return {
          nome: opt.label || 'Opcao',
          precoFinal,
          precoBase: precoFinal
        };
      });

      return {
        panelType: 'multi',
        payload: {
          titulo: cleanTitle(embed?.title, 'Painel multi-opcao'),
          descricao: embed?.description || 'Selecione uma opcao para continuar a compra.',
          opcoes,
          visualMode,
          singletonKey: `multi:${sanitizeToken(cleanTitle(embed?.title, 'Painel multi-opcao'))}`
        }
      };
    }
  }

  if (firstComponent.customId === 'ticket_categoria') {
    return {
      panelType: 'ticket',
      payload: {
        titulo: cleanTitle(embed?.title, 'Central de Suporte'),
        descricao: embed?.description || 'Selecione a categoria para abrir seu atendimento.',
        visualMode
      }
    };
  }

  const buttonIds = components.flatMap((row) => row.components?.map((btn) => btn.customId || '') || []);
  const accountButton = buttonIds.find((id) => id.startsWith('comprar_conta_'));

  if (accountButton) {
    const preco = Number(accountButton.replace('comprar_conta_', '')) || 0;
    const fields = embed?.fields || [];

    const getField = (name) => {
      const entry = fields.find((f) => String(f.name || '').toLowerCase().includes(name));
      return entry?.value || 'Nao informado';
    };

    return {
      panelType: 'conta',
      payload: {
        nome: cleanTitle(embed?.title, 'Conta Valorant'),
        preco,
        descricao: embed?.description || 'Conta disponivel para venda imediata.',
        elo: getField('elo'),
        skins: getField('skin'),
        chaveiros: getField('chave'),
        imagemUrl: embed?.image?.url || null,
        visualMode
      }
    };
  }

  const productButton = buttonIds.find((id) => id.startsWith('comprar_produto_'));
  if (productButton) {
    const preco = Number(productButton.replace('comprar_produto_', '')) || 0;
    const title = cleanTitle(embed?.title, 'Produto');
    const nome = title.replace(/^KYOTO STORE\s*\|\s*/i, '').trim() || 'Produto';

    return {
      panelType: 'personalizado',
      payload: {
        nome,
        precoBase: preco,
        descricao: embed?.description || 'Produto disponivel para compra imediata.',
        visualMode,
        singletonKey: `personalizado:${sanitizeToken(nome)}`
      }
    };
  }

  return null;
}

function buildPanelByRecord(record, economy, client) {
  if (!record || !record.panelType) return null;

  switch (record.panelType) {
    case 'robux':
      return buildRobuxPanel(economy, record.payload || {});
    case 'vp':
      return buildVPPanel(economy, record.payload || {});
    case 'conta':
      return buildContaPanel(economy, client, record.payload || {});
    case 'multi':
      return buildMultiPanel(economy, record.payload || {});
    case 'personalizado':
      return buildPersonalizadoPanel(economy, record.payload || {});
    case 'ticket':
      return buildTicketSupportPanel(record.payload || {});
    default:
      return null;
  }
}

module.exports = {
  THEME_COLOR,
  normalizeVisualMode,
  buildRobuxPanel,
  buildVPPanel,
  buildContaPanel,
  buildPersonalizadoPanel,
  buildMultiPanel,
  buildTicketSupportPanel,
  buildPanelByRecord,
  savePanelRecord,
  getPanelRecords,
  publishSingletonPanel,
  getActivePanelByContext,
  inferRecordFromMessage
};
