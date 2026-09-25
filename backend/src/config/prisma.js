const { PrismaClient } = require('@prisma/client');
const isProd = process.env.NODE_ENV === 'production';

function appendPoolParams(url) {
  if (!url) return url;
  const params = new URLSearchParams({
    connection_limit: '5', pool_timeout: '20', connect_timeout: '30'
  });
  return `${url}${url.includes('?') ? '&' : '?'}${params}`;
}

const opts = { log: isProd ? ['error'] : ['warn', 'error'] };
if (process.env.DATABASE_URL?.includes('mysql')) {
  opts.datasources = { db: { url: appendPoolParams(process.env.DATABASE_URL) } };
}

const g = global;
const prisma = g.prisma || new PrismaClient(opts);
if (!isProd) g.prisma = prisma;

module.exports = prisma;
