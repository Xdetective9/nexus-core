module.exports = {
  apps: [{
    name: "nexuscore",
    script: "index.js",
    instances: "max",
    exec_mode: "cluster",
    watch: false,
    max_memory_restart: "1G",
    node_args: "--max-old-space-size=1024",
    
    // Logging
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",
    merge_logs: true,
    
    // Environment
    env: {
      NODE_ENV: "development",
      PORT: 3000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    },
    
    // Process management
    kill_timeout: 5000,
    listen_timeout: 5000,
    shutdown_with_message: true,
    
    // Advanced features
    autorestart: true,
    max_restarts: 10,
    min_uptime: "10s",
    
    // Monitoring
    vizion: false,
    vizion_run_action: true,
    
    // Source map support
    source_map_support: true,
    
    // Post-deploy hooks
    post_deploy: "npm run migrate",
    
    // Instance var
    instance_var: "INSTANCE_ID",
    
    // Filter arguments
    filter_env: ["NODE_ENV", "PORT"],
    
    // Cron restart
    cron_restart: "0 3 * * *", // Daily at 3 AM
    
    // TZ
    time: true
  }],
  
  // Deployment configuration
  deploy: {
    production: {
      user: "ubuntu",
      host: ["your-server-ip"],
      ref: "origin/main",
      repo: "https://github.com/yourusername/nexuscore.git",
      path: "/var/www/nexuscore",
      "post-deploy": "npm install && npm run migrate && pm2 reload ecosystem.config.js --env production",
      env: {
        NODE_ENV: "production"
      }
    }
  }
};
