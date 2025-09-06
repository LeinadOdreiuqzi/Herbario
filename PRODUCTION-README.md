# Herbario - Configuración de Producción

## 🚀 Resumen de la Configuración

Este proyecto ha sido configurado para despliegue en producción en un VPS con recursos limitados (1 CPU, 4GB RAM, 50GB almacenamiento) con integración completa de Cloudflare y optimizaciones de seguridad.

## 📁 Archivos de Configuración Creados

### Variables de Entorno
- `backend/.env.example` - Plantilla de variables de entorno para producción

### Nginx y SSL
- `nginx/herbario.conf` - Configuración de Nginx optimizada con SSL/TLS
- `scripts/setup-ssl.sh` - Script automatizado para configuración SSL con Let's Encrypt

### Cloudflare
- `cloudflare/cloudflare-setup.md` - Guía completa de configuración de Cloudflare

### Despliegue y Gestión
- `scripts/deploy.sh` - Script de despliegue automatizado
- `backend/ecosystem.config.js` - Configuración de PM2 optimizada
- `docker-compose.prod.yml` - Configuración Docker para producción
- `backend/Dockerfile.prod` - Dockerfile optimizado
- `backend/.dockerignore` - Exclusiones para build de Docker

### Monitoreo y Backup
- `scripts/backup.sh` - Script de backup automatizado
- `scripts/monitor.sh` - Script de monitoreo del sistema

### Documentación
- `DEPLOYMENT.md` - Guía completa de despliegue
- `PRODUCTION-README.md` - Este archivo

## ⚡ Inicio Rápido

### 1. Preparar el Servidor
```bash
# Clonar el repositorio en el servidor
git clone <tu-repo> /tmp/herbario
cd /tmp/herbario

# Hacer ejecutables los scripts
chmod +x scripts/*.sh
```

### 2. Despliegue Automatizado
```bash
# Ejecutar script de despliegue (como root)
sudo ./scripts/deploy.sh
```

### 3. Configurar SSL
```bash
# Configurar certificados SSL
sudo ./scripts/setup-ssl.sh
```

### 4. Configurar Cloudflare
Seguir la guía en `cloudflare/cloudflare-setup.md`

## 🔧 Configuración Manual

### Variables de Entorno Críticas
```env
# En /var/www/herbario/backend/.env
NODE_ENV=production
DB_PASSWORD=tu_password_seguro
JWT_SECRET=tu_jwt_secret_de_64_caracteres
FRONTEND_ORIGIN=https://tudominio.com
```

### Servicios Principales
- **Backend**: Puerto 3001 (solo localhost)
- **Frontend**: Servido por Nginx
- **Base de datos**: PostgreSQL en puerto 5432
- **Proxy**: Nginx en puertos 80/443

## 📊 Optimizaciones Implementadas

### Para VPS Limitado (1 CPU, 4GB RAM)
- ✅ Pool de conexiones DB limitado a 10
- ✅ PM2 configurado para 1 instancia
- ✅ Límite de memoria Node.js: 384MB
- ✅ Swap de 2GB configurado
- ✅ Cache de Nginx optimizado
- ✅ Compresión gzip habilitada

### Seguridad
- ✅ Headers de seguridad configurados
- ✅ Rate limiting implementado
- ✅ Firewall UFW configurado
- ✅ SSL/TLS con certificados Let's Encrypt
- ✅ Usuario no-root para la aplicación

### Cloudflare (Plan Gratuito)
- ✅ DNS con proxy habilitado
- ✅ SSL Full (strict)
- ✅ 3 Page Rules optimizadas
- ✅ 5 Rate Limiting Rules
- ✅ WAF básico habilitado
- ✅ Cache inteligente configurado

## 🔍 Monitoreo y Mantenimiento

### Comandos Útiles
```bash
# Estado de la aplicación
sudo -u herbario pm2 status

# Logs en tiempo real
sudo -u herbario pm2 logs herbario

# Monitoreo del sistema
sudo /var/www/herbario/scripts/monitor.sh

# Backup manual
sudo /var/www/herbario/scripts/backup.sh

# Actualizar aplicación
sudo /usr/local/bin/herbario-update.sh
```

### Tareas Automatizadas (Cron)
- **Monitoreo**: Cada 5 minutos
- **Backup**: Diario a las 2 AM
- **Renovación SSL**: Automática
- **Limpieza de logs**: Semanal

## 🚨 Umbrales de Alerta

- **CPU**: > 80%
- **Memoria**: > 85%
- **Disco**: > 85%
- **Load Average**: > 2.0
- **Conexiones DB**: > 20

## 📈 Métricas de Rendimiento Esperadas

### Con Cloudflare
- **Tiempo de carga**: < 2 segundos
- **Cache hit ratio**: > 80%
- **Ancho de banda ahorrado**: > 60%

### Sin Cloudflare
- **Tiempo de respuesta API**: < 500ms
- **Throughput**: ~100 requests/minuto
- **Uso de memoria**: < 400MB

## 🔄 Proceso de Actualización

1. **Backup automático** antes de actualizar
2. **Detener aplicación** temporalmente
3. **Actualizar código** desde repositorio
4. **Instalar dependencias** si es necesario
5. **Ejecutar migraciones** de DB
6. **Reiniciar aplicación**
7. **Verificar funcionamiento**

## 🆘 Solución de Problemas

### Aplicación no responde
```bash
# Verificar logs
sudo -u herbario pm2 logs herbario --lines 50

# Verificar recursos
htop && free -h && df -h

# Reiniciar si es necesario
sudo -u herbario pm2 restart herbario
```

### Base de datos lenta
```bash
# Verificar conexiones activas
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Certificado SSL expirado
```bash
# Renovar manualmente
sudo certbot renew

# Verificar renovación automática
sudo systemctl status certbot.timer
```

## 📞 Contacto y Soporte

### Logs Importantes
- **Aplicación**: `/var/log/herbario/combined.log`
- **Nginx**: `/var/log/nginx/error.log`
- **Sistema**: `journalctl -f`
- **Monitoreo**: `/var/log/herbario/monitor.log`

### Archivos de Configuración
- **Nginx**: `/etc/nginx/sites-available/herbario`
- **PM2**: `/var/www/herbario/backend/ecosystem.config.js`
- **Env**: `/var/www/herbario/backend/.env`

## 🎯 Próximos Pasos Recomendados

1. **Configurar monitoreo externo** (UptimeRobot, Pingdom)
2. **Implementar CI/CD** con GitHub Actions
3. **Configurar alertas por email/Slack**
4. **Optimizar imágenes** con Cloudflare Image Optimization
5. **Implementar cache Redis** si el uso aumenta
6. **Configurar CDN adicional** para archivos estáticos

---

**✅ Estado**: Listo para producción  
**🔧 Mantenimiento**: Automatizado  
**📊 Monitoreo**: Configurado  
**🔒 Seguridad**: Implementada  
**☁️ Cloudflare**: Integrado  

> **Nota**: Esta configuración está optimizada para un VPS con recursos limitados y uso bajo/medio. Escalar según crecimiento de la aplicación.