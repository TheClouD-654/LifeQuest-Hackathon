// ============================================================
// Prisma Client Singleton
// Enforces TLS/SSL configuration for TiDB Cloud and cloud environments
// ============================================================
const { PrismaClient } = require('@prisma/client');

function getSecureDatabaseUrl(url) {
  if (!url) return url;
  if ((url.includes('tidbcloud.com') || process.env.NODE_ENV === 'production' || url.includes('ssl')) && !url.includes('sslaccept=')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sslaccept=strict`;
  }
  return url;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getSecureDatabaseUrl(process.env.DATABASE_URL);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getSecureDatabaseUrl(process.env.DATABASE_URL),
    },
  },
});

module.exports = prisma;
