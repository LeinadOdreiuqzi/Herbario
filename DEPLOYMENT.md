# Guía de Despliegue de Herbario - Producción

## Especificaciones del VPS

- **CPU**: 1 núcleo
- **RAM**: 4GB
- **Almacenamiento**: 50GB
- **Ancho de banda**: 4TB
- **Uso esperado**: Bajo/Medio

## Requisitos Previos

### Sistema Operativo
- Ubuntu 20.04 LTS o superior
- Acceso root o sudo
- Dominio configurado apuntando al VPS

### Software Requerido
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y curl wget git unzip software-properties-common

# Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Nginx
sudo apt install -y nginx

# Certbot para SSL
sudo apt install -y certbot python3-certbot-nginx

# PM2 para gestión de procesos
sudo npm install -g pm2

# Herramientas adicionales
sudo apt install -y htop iotop nethogs ufw fail2ban
```

## Proceso de Despliegue

### 1. Preparación del Servidor

```bash
# Clonar el repositorio
git clone https://github.com/usuario/herbario.git /tmp/herbario
cd /tmp/herbario

# Hacer ejecutables los scripts
chmod +x scripts/*.sh

# Ejecutar script de despliegue
sudo ./scripts/deploy.sh
```

### 2. Configuración de Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp /var/www/herbario/backend/.env.example /var/www/herbario/backend/.env

# Editar variables de entorno
sudo nano /var/www/herbario/backend/.env
```

**Variables críticas a configurar:**
```env
# Base de datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=herbario
DB_USER=herbario_app
DB_PASSWORD=tu_password_seguro_aqui

# JWT (generar nuevo secret)
JWT_SECRET=tu_jwt_secret_de_64_caracteres_minimo

# Dominio
FRONTEND_ORIGIN=https://tudominio.com
ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# Producción
NODE_ENV=production
PORT=3001
```

### 3. Configuración SSL/TLS

```bash
# Ejecutar script de configuración SSL
sudo ./scripts/setup-ssl.sh

# Seguir las instrucciones del script:
# - Ingresar dominio
# - Ingresar email para notificaciones
# - Verificar configuración
```

### 4. Configuración de Cloudflare

#### DNS Records
```
Tipo    Nombre    Contenido              Proxy
A       @         [IP_DE_TU_VPS]        ✅ Proxied
A       www       [IP_DE_TU_VPS]        ✅ Proxied
```

#### Configuración SSL/TLS
- **Modo de cifrado**: Full (strict)
- **Always Use HTTPS**: On
- **HSTS**: Enable (6 months, include subdomains, preload)
- **Minimum TLS Version**: 1.2

#### Page Rules (3 reglas máximo en plan gratuito)
```yaml
# Regla 1: Cache estático
URL: tudominio.com/assets/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month

# Regla 2: No cache para admin
URL: tudominio.com/admin*
Settings:
  - Cache Level: Bypass

# Regla 3: API cache corto
URL: tudominio.com/plants/list*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 5 minutes
```

#### Rate Limiting (5 reglas máximo)
```yaml
# Login protection
URL: tudominio.com/auth/login
Method: POST
Limit: 5 requests per minute per IP

# API protection
URL: tudominio.com/plants/*
Limit: 30 requests per minute per IP

# Upload protection
URL: tudominio.com/plants/submissions
Method: POST
Limit: 10 requests per hour per IP
```

### 5. Verificación del Despliegue

```bash
# Verificar servicios
sudo systemctl status postgresql nginx
sudo -u herbario pm2 status

# Verificar conectividad
curl -f http://localhost:3001/health
curl -f https://tudominio.com

# Verificar logs
sudo tail -f /var/log/herbario/combined.log
```

## Configuración de Monitoreo

### 1. Configurar Cron Jobs

```bash
# Editar crontab
sudo crontab -e

# Agregar tareas
# Monitoreo cada 5 minutos
*/5 * * * * /var/www/herbario/scripts/monitor.sh

# Backup diario a las 2 AM
0 2 * * * /var/www/herbario/scripts/backup.sh

# Reinicio semanal preventivo (domingo 3 AM)
0 3 * * 0 /usr/local/bin/herbario-update.sh

# Limpieza de logs semanalmente
0 1 * * 1 find /var/log/herbario -name "*.log" -mtime +7 -delete
```

### 2. Configurar Alertas

```bash
# Configurar variables de entorno para alertas
echo 'export EMAIL_ALERTS=true' >> /etc/environment
echo 'export ALERT_EMAIL=admin@tudominio.com' >> /etc/environment

# Instalar mailutils para notificaciones
sudo apt install -y mailutils
```

## Optimizaciones para VPS Limitado

### 1. Configuración del Kernel

```bash
# Optimizaciones en /etc/sysctl.conf
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
echo 'net.core.rmem_max=16777216' >> /etc/sysctl.conf
echo 'net.core.wmem_max=16777216' >> /etc/sysctl.conf

# Aplicar cambios
sudo sysctl -p
```

### 2. Configuración de Swap

```bash
# Crear swap de 2GB (ya incluido en deploy.sh)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3. Límites de Procesos

```bash
# Configurar límites en /etc/security/limits.conf
echo 'herbario soft nofile 4096' >> /etc/security/limits.conf
echo 'herbario hard nofile 8192' >> /etc/security/limits.conf
echo 'herbario soft nproc 2048' >> /etc/security/limits.conf
echo 'herbario hard nproc 4096' >> /etc/security/limits.conf
```

## Comandos de Administración

### Gestión de la Aplicación

```bash
# Ver estado
sudo -u herbario pm2 status

# Ver logs en tiempo real
sudo -u herbario pm2 logs herbario

# Reiniciar aplicación
sudo -u herbario pm2 restart herbario

# Recargar configuración
sudo -u herbario pm2 reload herbario

# Detener aplicación
sudo -u herbario pm2 stop herbario
```

### Gestión de Base de Datos

```bash
# Conectar a PostgreSQL
sudo -u postgres psql herbario

# Backup manual
sudo -u postgres pg_dump -Fc herbario > backup_$(date +%Y%m%d).dump

# Restaurar backup
sudo -u postgres pg_restore -d herbario backup_file.dump

# Ver conexiones activas
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Gestión de Nginx

```bash
# Verificar configuración
sudo nginx -t

# Recargar configuración
sudo systemctl reload nginx

# Ver logs de acceso
sudo tail -f /var/log/nginx/access.log

# Ver logs de errores
sudo tail -f /var/log/nginx/error.log
```

## Actualización de la Aplicación

```bash
# Usar script de actualización
sudo /usr/local/bin/herbario-update.sh

# O manualmente:
cd /var/www/herbario/backend
sudo -u herbario git pull origin main
sudo -u herbario npm ci --only=production
sudo -u herbario pm2 restart herbario
```

## Backup y Restauración

### Backup Automático

```bash
# Ejecutar backup manual
sudo /var/www/herbario/scripts/backup.sh

# Ver backups disponibles
ls -la /var/www/herbario/backups/
```

### Restauración

```bash
# Restaurar base de datos
sudo -u postgres pg_restore -d herbario /var/www/herbario/backups/latest_db_backup.dump.gz

# Restaurar archivos
tar -xzf /var/www/herbario/backups/latest_uploads_backup.tar.gz -C /var/www/herbario/
```

## Solución de Problemas

### Problemas Comunes

#### 1. Aplicación no responde
```bash
# Verificar logs
sudo -u herbario pm2 logs herbario --lines 50

# Verificar recursos
htop
free -h
df -h

# Reiniciar si es necesario
sudo -u herbario pm2 restart herbario
```

#### 2. Base de datos lenta
```bash
# Verificar conexiones
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Verificar queries lentas
sudo -u postgres psql -c "SELECT query, state, query_start FROM pg_stat_activity WHERE state = 'active';"

# Reiniciar PostgreSQL si es necesario
sudo systemctl restart postgresql
```

#### 3. Poco espacio en disco
```bash
# Limpiar logs antiguos
sudo find /var/log -name "*.log" -mtime +7 -delete

# Limpiar backups antiguos
sudo find /var/www/herbario/backups -mtime +7 -delete

# Limpiar cache de npm
sudo -u herbario npm cache clean --force
```

#### 4. Certificado SSL expirado
```bash
# Renovar certificado
sudo certbot renew

# Verificar renovación automática
sudo systemctl status certbot.timer
```

## Métricas de Rendimiento

### Umbrales Recomendados

- **CPU**: < 80% promedio
- **Memoria**: < 85% uso
- **Disco**: < 85% uso
- **Load Average**: < 2.0
- **Swap**: < 50% uso
- **Conexiones DB**: < 20 activas

### Comandos de Monitoreo

```bash
# CPU y memoria
htop

# Disco
df -h
iotop

# Red
nethogs
ss -tuln

# Base de datos
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Aplicación
sudo -u herbario pm2 monit
```

## Seguridad

### Configuración de Firewall

```bash
# Configurar UFW
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3001/tcp  # Bloquear acceso directo al backend
```

### Fail2Ban

```bash
# Configurar fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Ver estado
sudo fail2ban-client status
```

### Actualizaciones de Seguridad

```bash
# Configurar actualizaciones automáticas
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Contacto y Soporte

- **Logs de aplicación**: `/var/log/herbario/`
- **Logs de sistema**: `journalctl -f`
- **Monitoreo**: `/var/www/herbario/scripts/monitor.sh`
- **Backup**: `/var/www/herbario/scripts/backup.sh`

---

**Nota**: Esta guía está optimizada para un VPS con recursos limitados. Ajustar los parámetros según las necesidades específicas y el crecimiento de la aplicación.