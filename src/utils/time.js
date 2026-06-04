function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function toMysqlDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

module.exports = {
  minutesFromNow,
  toMysqlDateTime
};
