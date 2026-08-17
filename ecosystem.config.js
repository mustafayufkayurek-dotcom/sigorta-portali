module.exports = {
  apps: [
    {
      name: 'sigorta-backend',
      script: 'dist/main.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      watch: false,
      restart_delay: 3000,
      kill_timeout: 10000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
