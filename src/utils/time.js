function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function toMysqlDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate())
  ].join('-') + ' ' + [
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds())
  ].join(':');
}

function formatUtc(value) {
  if (!value) {
    return 'never';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

module.exports = {
  minutesFromNow,
  toMysqlDateTime,
  formatUtc
};
