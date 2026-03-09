const { Events } = require('discord.js');

const autoReplyLocks = new Map();
const AUTO_REPLY_COOLDOWN_MS = 15000;

function canAutoReply(message) {
  const key = `${message.channel.id}:${message.author.id}`;
  const now = Date.now();
  const last = autoReplyLocks.get(key) || 0;

  if (now - last < AUTO_REPLY_COOLDOWN_MS) {
    return false;
  }

  autoReplyLocks.set(key, now);

  if (autoReplyLocks.size > 4000) {
    const cutoff = now - (AUTO_REPLY_COOLDOWN_MS * 4);
    for (const [entryKey, ts] of autoReplyLocks.entries()) {
      if (ts < cutoff) autoReplyLocks.delete(entryKey);
    }
  }

  return true;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    
    // Auto-reply no canal específico
    if (message.channel.id === '1329494395770372096') {
      if (!canAutoReply(message)) return;
      await message.reply('Use o <#1269367891107512433> para ter mais segurança nas suas trocas/vendas');
    }
  }
};
