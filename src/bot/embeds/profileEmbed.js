const { EmbedBuilder } = require('discord.js');
const { formatDuration } = require('./leaderboardEmbed');

function formatDistance(meters) {
  const value = Number(meters || 0);
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} km`;
  }

  return `${Math.round(value)} m`;
}

function profileEmbed(profile) {
  if (!profile) {
    return new EmbedBuilder()
      .setTitle('Profile not linked')
      .setDescription('Run `/link` to connect your Discord account to your Reforger player ID.');
  }

  const kills = Number(profile.player_kills || 0);
  const deaths = Number(profile.deaths || 0);
  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills > 0 ? 'Perfect' : '0.00';
  const totalDistance = Number(profile.distance_foot_meters || 0) + Number(profile.distance_vehicle_meters || 0);

  return new EmbedBuilder()
    .setTitle(profile.display_name || 'Linked Reforger Player')
    .addFields(
      { name: 'Playtime', value: formatDuration(profile.playtime_seconds || 0), inline: true },
      { name: 'K/D', value: kd, inline: true },
      { name: 'Player Kills', value: String(kills), inline: true },
      { name: 'AI Kills', value: String(profile.ai_kills || 0), inline: true },
      { name: 'Deaths', value: String(deaths), inline: true },
      { name: 'Revives', value: String(profile.revives || 0), inline: true },
      { name: 'Total Distance', value: formatDistance(totalDistance), inline: true },
      { name: 'Foot Distance', value: formatDistance(profile.distance_foot_meters), inline: true },
      { name: 'Vehicle Distance', value: formatDistance(profile.distance_vehicle_meters), inline: true }
    )
    .setFooter({ text: `Reforger ID: ${profile.reforger_player_id}` });
}

module.exports = profileEmbed;
