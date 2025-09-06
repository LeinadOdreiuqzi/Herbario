module.exports = {
  apps: [{
    name: 'herbario',
    script: './src/server.js',
    cwd: '/var/www/herbario/backend',
    user: 'herbario',
    instances: 1, // Solo 1 instancia para VPS limitado (1 CPU)
    exec_mode: 'fork', // Fork mode es más eficiente para 1 instancia
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    
    // Configuración de logs
    error_file: '/var/log/herbario/error.log',
    out_file: '/var/log/herbario/out.log',
    log_file: '/var/log/herbario/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Optimizaciones de memoria para VPS limitado
    max_memory_restart: '400M', // Reiniciar si usa más de 400MB
    node_args: [
      '--max-old-space-size=384', // Limitar heap de Node.js a 384MB
      '--optimize-for-size', // Optimizar para uso de memoria
      '--gc-interval=100' // Garbage collection más frecuente
    ],
    
    // Configuración de reinicio
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Monitoreo
    watch: false, // Deshabilitado para producción
    ignore_watch: [
      'node_modules',
      'uploads',
      'logs',
      '.git',
      '*.log'
    ],
    
    // Configuración de reinicio automático
    autorestart: true,
    
    // Configuración de cron para reinicio preventivo (opcional)
    cron_restart: '0 4 * * *', // Reiniciar diariamente a las 4 AM
    
    // Variables de entorno específicas para producción
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
      UV_THREADPOOL_SIZE: 2, // Limitar thread pool para VPS limitado
    },
    
    // Configuración de monitoreo avanzado
    pmx: true,
    
    // Configuración de source maps (deshabilitado para producción)
    source_map_support: false,
    
    // Configuración de cluster (deshabilitado para VPS limitado)
    instance_var: 'INSTANCE_ID',
    
    // Configuración de logs rotativos
    log_type: 'json',
    
    // Configuración de health check
    health_check_grace_period: 3000,
    
    // Configuración de shutdown
    shutdown_with_message: true,
    
    // Configuración de memoria
    disable_trace: true, // Deshabilitar trace para ahorrar memoria
    
    // Configuración de CPU
    treekill: true,
    
    // Configuración de red
    listen_timeout: 8000,
    kill_retry_time: 100
  }],
  
  // Configuración de despliegue
  deploy: {
    production: {
      user: 'herbario',
      host: 'localhost',
      ref: 'origin/main',
      repo: 'git@github.com:usuario/herbario.git',
      path: '/var/www/herbario',
      'post-deploy': 'npm ci --only=production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install git -y'
    }
  }
};