const VALID_CATEGORY_SLUG = /^[a-z0-9_-]{2,32}$/i;

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) {
    const error = new Error(`Missing required fields: ${missing.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
}

function isValidCategorySlug(slug) {
  return VALID_CATEGORY_SLUG.test(slug);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

module.exports = {
  requireFields,
  isValidCategorySlug,
  parsePositiveInt
};
