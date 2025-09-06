#!/bin/bash

# Script de despliegue para Herbario - Optimizado para VPS limitado
# 1 CPU, 4GB RAM, 50GB almacenamiento

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Despliegue de Herbario - Producción ===${NC}"

# Variables de configuración
APP_DIR="/var/www/herbario"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
NGINX_CONFIG="/etc/nginx/sites-available/herbario"
SERVICE_NAME="herbario"
DB_NAME="herbario"
DB_USER="herbario_app"

# Verificar si se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Este script debe ejecutarse como root${NC}"
   exit 1
fi

# Función para logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Verificar dependencias del sistema
log "Verificando dependencias del sistema..."
command -v node >/dev/null 2>&1 || error "Node.js no está instalado"
command -v npm >/dev/null 2>&1 || error "npm no está instalado"
command -v psql >/dev/null 2>&1 || error "PostgreSQL no está instalado"
command -v nginx >/dev/null 2>&1 || error "Nginx no está instalado"
command -v pm2 >/dev/null 2>&1 || { warning "PM2 no encontrado, instalando..."; npm install -g pm2; }

# Crear usuario del sistema para la aplicación
log "Configurando usuario del sistema..."
if ! id "herbario" &>/dev/null; then
    useradd -r -s /bin/false -d $APP_DIR herbario
    success "Usuario 'herbario' creado"
fi

# Crear directorios
log "Creando estructura de directorios..."
mkdir -p $APP_DIR/{backend,frontend,logs,uploads,backups}
mkdir -p /var/log/herbario
chown -R herbario:herbario $APP_DIR
chown -R herbario:herbario /var/log/herbario

# Configurar límites del sistema para optimizar recursos
log "Optimizando configuración del sistema..."
cat > /etc/security/limits.d/herbario.conf << EOF
# Límites para usuario herbario
herbario soft nofile 4096
herbario hard nofile 8192
herbario soft nproc 2048
herbario hard nproc 4096
EOF

# Configurar swap si no existe (importante para VPS con poca RAM)
if [[ ! -f /swapfile ]]; then
    log "Configurando swap de 2GB..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    
    # Optimizar swappiness para VPS
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl vm.swappiness=10
    success "Swap configurado"
fi

# Configurar PostgreSQL para recursos limitados
log "Optimizando PostgreSQL..."
PG_VERSION=$(psql --version | awk '{print $3}' | sed 's/\..*//')
PG_CONFIG="/etc/postgresql/$PG_VERSION/main/postgresql.conf"

if [[ -f $PG_CONFIG ]]; then
    cp $PG_CONFIG $PG_CONFIG.backup
    
    # Configuración optimizada para 4GB RAM
    cat >> $PG_CONFIG << EOF

# Configuración optimizada para Herbario (4GB RAM)
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_worker_processes = 2
max_parallel_workers_per_gather = 1
max_parallel_workers = 2
max_parallel_maintenance_workers = 1
EOF
    
    systemctl restart postgresql
    success "PostgreSQL optimizado"
fi

# Configurar base de datos
log "Configurando base de datos..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    sudo -u postgres createdb $DB_NAME
    success "Base de datos '$DB_NAME' creada"
fi

if ! sudo -u postgres psql -t -c "\du" | cut -d \| -f 1 | grep -qw $DB_USER; then
    DB_PASSWORD=$(openssl rand -base64 32)
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo "DB_PASSWORD=$DB_PASSWORD" > $APP_DIR/.db_credentials
    chmod 600 $APP_DIR/.db_credentials
    chown herbario:herbario $APP_DIR/.db_credentials
    success "Usuario de base de datos '$DB_USER' creado"
fi

# Copiar archivos de la aplicación
log "Desplegando archivos de la aplicación..."
cp -r ./backend/* $BACKEND_DIR/
cp -r ./frontend/* $FRONTEND_DIR/
chown -R herbario:herbario $APP_DIR

# Instalar dependencias del backend
log "Instalando dependencias del backend..."
cd $BACKEND_DIR
sudo -u herbario npm ci --only=production

# Configurar variables de entorno
log "Configurando variables de entorno..."
if [[ ! -f $BACKEND_DIR/.env ]]; then
    cp $BACKEND_DIR/.env.example $BACKEND_DIR/.env
    
    # Generar JWT secret seguro
    JWT_SECRET=$(openssl rand -base64 64)
    
    # Obtener password de la base de datos
    DB_PASSWORD=$(grep DB_PASSWORD $APP_DIR/.db_credentials | cut -d'=' -f2)
    
    # Configurar .env
    sed -i "s/your_jwt_secret_here_minimum_32_characters/$JWT_SECRET/g" $BACKEND_DIR/.env
    sed -i "s/your_secure_password_here/$DB_PASSWORD/g" $BACKEND_DIR/.env
    sed -i "s/NODE_ENV=development/NODE_ENV=production/g" $BACKEND_DIR/.env
    
    chmod 600 $BACKEND_DIR/.env
    chown herbario:herbario $BACKEND_DIR/.env
    success "Variables de entorno configuradas"
fi

# Ejecutar migraciones de base de datos
log "Ejecutando configuración de base de datos..."
cd $BACKEND_DIR
sudo -u herbario node src/scripts/setup-database.js

# Configurar PM2 para el backend
log "Configurando PM2..."
cat > $BACKEND_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '$SERVICE_NAME',
    script: './src/server.js',
    cwd: '$BACKEND_DIR',
    user: 'herbario',
    instances: 1, // Solo 1 instancia para VPS limitado
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/var/log/herbario/error.log',
    out_file: '/var/log/herbario/out.log',
    log_file: '/var/log/herbario/combined.log',
    time: true,
    max_memory_restart: '512M', // Reiniciar si usa más de 512MB
    node_args: '--max-old-space-size=512', // Limitar heap de Node.js
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    restart_delay: 1000,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'uploads', 'logs'],
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true
  }]
};
EOF

# Iniciar aplicación con PM2
log "Iniciando aplicación..."
sudo -u herbario pm2 start $BACKEND_DIR/ecosystem.config.js
sudo -u herbario pm2 save
sudo -u herbario pm2 startup

# Configurar logrotate para logs de la aplicación
log "Configurando rotación de logs..."
cat > /etc/logrotate.d/herbario << EOF
/var/log/herbario/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 herbario herbario
    postrotate
        sudo -u herbario pm2 reloadLogs
    endscript
}
EOF

# Configurar monitoreo básico
log "Configurando monitoreo..."
cat > /usr/local/bin/herbario-health-check.sh << 'EOF'
#!/bin/bash

# Script de monitoreo básico para Herbario
LOG_FILE="/var/log/herbario/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Verificar si la aplicación responde
if curl -f -s http://localhost:3001/health > /dev/null; then
    echo "[$DATE] OK: Aplicación respondiendo" >> $LOG_FILE
else
    echo "[$DATE] ERROR: Aplicación no responde" >> $LOG_FILE
    # Reiniciar aplicación
    sudo -u herbario pm2 restart herbario
    echo "[$DATE] INFO: Aplicación reiniciada" >> $LOG_FILE
fi

# Verificar uso de memoria
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEM_USAGE -gt 90 ]; then
    echo "[$DATE] WARNING: Uso de memoria alto: ${MEM_USAGE}%" >> $LOG_FILE
fi

# Verificar espacio en disco
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$DATE] WARNING: Uso de disco alto: ${DISK_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x /usr/local/bin/herbario-health-check.sh

# Configurar cron para monitoreo
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/herbario-health-check.sh") | crontab -

# Configurar backup automático
log "Configurando backup automático..."
cat > /usr/local/bin/herbario-backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/www/herbario/backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="herbario"

# Crear backup de la base de datos
sudo -u postgres pg_dump $DB_NAME | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Crear backup de uploads
tar -czf $BACKUP_DIR/uploads_backup_$DATE.tar.gz -C /var/www/herbario uploads/

# Mantener solo los últimos 7 backups
find $BACKUP_DIR -name "*backup*" -mtime +7 -delete

echo "[$(date)] Backup completado: $DATE" >> /var/log/herbario/backup.log
EOF

chmod +x /usr/local/bin/herbario-backup.sh

# Programar backup diario a las 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/herbario-backup.sh") | crontab -

# Configurar Nginx
log "Configurando Nginx..."
cp ./nginx/herbario.conf $NGINX_CONFIG
nginx -t && systemctl reload nginx

# Configurar firewall
log "Configurando firewall..."
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw deny 3001/tcp  # Bloquear acceso directo al backend

# Optimizar kernel para red
log "Optimizando configuración de red..."
cat >> /etc/sysctl.conf << EOF

# Optimizaciones de red para Herbario
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.tcp_rmem = 4096 87380 16777216
net.ipv4.tcp_wmem = 4096 65536 16777216
net.core.netdev_max_backlog = 5000
net.ipv4.tcp_congestion_control = bbr
EOF

sysctl -p

# Crear script de actualización
log "Creando script de actualización..."
cat > /usr/local/bin/herbario-update.sh << 'EOF'
#!/bin/bash

set -e

APP_DIR="/var/www/herbario"
BACKEND_DIR="$APP_DIR/backend"

echo "Iniciando actualización de Herbario..."

# Backup antes de actualizar
/usr/local/bin/herbario-backup.sh

# Detener aplicación
sudo -u herbario pm2 stop herbario

# Actualizar código (asumiendo git)
cd $BACKEND_DIR
git pull origin main

# Instalar dependencias
sudo -u herbario npm ci --only=production

# Ejecutar migraciones si existen
if [ -f "migrations.js" ]; then
    sudo -u herbario node migrations.js
fi

# Reiniciar aplicación
sudo -u herbario pm2 start herbario

echo "Actualización completada"
EOF

chmod +x /usr/local/bin/herbario-update.sh

# Verificar estado final
log "Verificando estado del despliegue..."
sleep 5

if curl -f -s http://localhost:3001/health > /dev/null; then
    success "✓ Backend funcionando correctamente"
else
    error "✗ Backend no responde"
fi

if systemctl is-active --quiet nginx; then
    success "✓ Nginx funcionando correctamente"
else
    error "✗ Nginx no está funcionando"
fi

if systemctl is-active --quiet postgresql; then
    success "✓ PostgreSQL funcionando correctamente"
else
    error "✗ PostgreSQL no está funcionando"
fi

echo -e "\n${GREEN}=== Despliegue Completado ===${NC}"
echo -e "${GREEN}✓ Aplicación desplegada en: $APP_DIR${NC}"
echo -e "${GREEN}✓ Backend ejecutándose en puerto 3001${NC}"
echo -e "${GREEN}✓ Frontend servido por Nginx${NC}"
echo -e "${GREEN}✓ Base de datos configurada${NC}"
echo -e "${GREEN}✓ Monitoreo y backups configurados${NC}"
echo -e "${GREEN}✓ Firewall configurado${NC}"

echo -e "\n${YELLOW}Comandos útiles:${NC}"
echo -e "- Ver logs: sudo -u herbario pm2 logs herbario"
echo -e "- Estado: sudo -u herbario pm2 status"
echo -e "- Reiniciar: sudo -u herbario pm2 restart herbario"
echo -e "- Actualizar: /usr/local/bin/herbario-update.sh"
echo -e "- Backup manual: /usr/local/bin/herbario-backup.sh"
echo -e "- Monitoreo: tail -f /var/log/herbario/health-check.log"

echo -e "\n${YELLOW}Próximos pasos:${NC}"
echo -e "1. Configurar DNS en Cloudflare"
echo -e "2. Ejecutar setup-ssl.sh para certificados"
echo -e "3. Verificar funcionamiento completo"
echo -e "4. Configurar monitoreo externo"