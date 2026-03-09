const { Events, ActivityType } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ ${client.user.tag} online`);
    console.log(`🤖 ${client.guilds.cache.size} servidor(es)`);
    
    if (!process.env.MP_ACCESS_TOKEN) {
      console.log('⚠️ MP_ACCESS_TOKEN não configurado');
    }
    
    client.user.setActivity('/help', { type: ActivityType.Watching });
  }
};
