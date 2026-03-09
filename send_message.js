const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

client.once('ready', async () => {
    try {
        const channelId = '1246115290140508270';
        const userId = '757012487710310440';
        const channel = await client.channels.fetch(channelId);
        if (channel) {
            await channel.send(`@sunken <@${userId}>`);
            console.log('Mensagem enviada com sucesso!');
        } else {
            console.error('Canal não encontrado.');
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
    } finally {
        client.destroy();
    }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error('DISCORD_TOKEN não encontrado.');
    process.exit(1);
}

client.login(token);
