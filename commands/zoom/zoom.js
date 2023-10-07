const { channel } = require('diagnostics_channel');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('zoom-out')
		.setDescription('Start of an long zoom out'),
	async execute(interaction) {
		await interaction.reply('Pong!');
	},
};
