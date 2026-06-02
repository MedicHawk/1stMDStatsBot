require('dotenv').config();

const mysql = require('mysql2/promise');

async function main() {
  const rootPassword = process.argv[2];
  const appUser = process.env.MYSQL_USER || 'stats_bot';
  const appPassword = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'arma_stats';

  if (!rootPassword) {
    throw new Error('Provide the MySQL root password as argv[2]');
  }

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: 'root',
    password: rootPassword,
    multipleStatements: true
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
    await connection.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [appUser, appPassword]);
    await connection.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO ?@'localhost'`, [appUser]);
    await connection.query('FLUSH PRIVILEGES');
    console.log(`Ensured MySQL user ${appUser} can access ${database}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
