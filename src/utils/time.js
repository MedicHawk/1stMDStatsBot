function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function toMysqlDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

module.exports = {
  minutesFromNow,
  toMysqlDateTime
};
