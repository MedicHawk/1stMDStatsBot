const { EmbedBuilder } = require('discord.js');

function profileEmbed(profile) {
  if (!profile) {
    return new EmbedBuilder()
      .setTitle('Profile not linked')
      .setDescription('Run `/link` to connect your Discord account to your Reforger player ID.');
  }

  return new EmbedBuilder()
    .setTitle(profile.display_name || 'Linked Reforger Player')
    .addFields(
      { name: 'Player Kills', value: String(profile.player_kills || 0), inline: true },
      { name: 'AI Kills', value: String(profile.ai_kills || 0), inline: true },
      { name: 'Deaths', value: String(profile.deaths || 0), inline: true },
      { name: 'Revives', value: String(profile.revives || 0), inline: true },
      { name: 'Foot Distance', value: `${Math.round(profile.distance_foot_meters || 0)} m`, inline: true },
      { name: 'Vehicle Distance', value: `${Math.round(profile.distance_vehicle_meters || 0)} m`, inline: true }
    )
    .setFooter({ text: `Reforger ID: ${profile.reforger_player_id}` });
}

module.exports = profileEmbed;
