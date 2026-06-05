module.exports = {
  apps: [
    {
      name: '1stmd-api',
      script: 'src/api/server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC'
      }
    },
    {
      name: '1stmd-bot',
      script: 'src/bot/index.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC'
      }
    },
    {
      name: '1stmd-leaderboards',
      script: 'src/services/refreshLeaderboards.js',
      cwd: __dirname,
      cron_restart: '*/10 * * * *',
      autorestart: false,
      env: {
        NODE_ENV: 'production',
        TZ: 'UTC'
      }
    }
  ]
};
