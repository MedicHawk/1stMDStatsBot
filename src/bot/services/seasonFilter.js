const seasonService = require('../../services/seasonService');

async function resolveSeasonId(value) {
  if (!value || value === 'all') return null;
  if (value === 'current') {
    const season = await seasonService.getCurrentSeason();
    return season ? season.id : null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function addSeasonOption(builder) {
  return builder.addStringOption((option) => option
    .setName('season')
    .setDescription('all, current, or a season ID')
    .setRequired(false)
    .addChoices(
      { name: 'All-time', value: 'all' },
      { name: 'Current season', value: 'current' }
    ));
}

module.exports = {
  resolveSeasonId,
  addSeasonOption
};
