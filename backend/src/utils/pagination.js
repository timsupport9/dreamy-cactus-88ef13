function parsePagination(query, defaults = { page: 1, limit: 20, maxLimit: 100 }) {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page);
  const limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(query.limit, 10) || defaults.limit));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
function buildMeta(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1, hasMore: page * limit < total };
}
module.exports = { parsePagination, buildMeta };
