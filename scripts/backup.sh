#!/bin/bash

# Script de backup automatizado para Herbario
# Optimizado para VPS con recursos limitados

set -e

# Configuración
BACKUP_DIR="/var/www/herbario/backups"
APP_DIR="/var/www/herbario"
DB_NAME="herbario"
DB_USER="herbario_app"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
MAX_BACKUP_SIZE="1G"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función de logging
log() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    exit 1
}

# Verificar espacio disponible
check_disk_space() {
    local required_space=1048576 # 1GB en KB
    local available_space=$(df $BACKUP_DIR | tail -1 | awk '{print $4}')
    
    if [ $available_space -lt $required_space ]; then
        error "Espacio insuficiente en disco. Disponible: ${available_space}KB, Requerido: ${required_space}KB"
    fi
    
    log "Espacio disponible: $(($available_space / 1024))MB"
}

# Crear directorio de backup si no existe
mkdir -p $BACKUP_DIR
cd $BACKUP_DIR

log "Iniciando backup de Herbario - $DATE"

# Verificar espacio en disco
check_disk_space

# 1. Backup de la base de datos
log "Creando backup de la base de datos..."
if command -v pg_dump >/dev/null 2>&1; then
    # Backup con compresión
    sudo -u postgres pg_dump -Fc $DB_NAME > "db_backup_${DATE}.dump" 2>/dev/null
    
    # Verificar que el backup se creó correctamente
    if [ -f "db_backup_${DATE}.dump" ] && [ -s "db_backup_${DATE}.dump" ]; then
        # Comprimir adicionalmente con gzip para ahorrar espacio
        gzip "db_backup_${DATE}.dump"
        success "✓ Backup de base de datos completado: db_backup_${DATE}.dump.gz"
    else
        error "✗ Error al crear backup de base de datos"
    fi
else
    error "pg_dump no encontrado"
fi

# 2. Backup de archivos subidos
log "Creando backup de archivos subidos..."
if [ -d "$APP_DIR/uploads" ] && [ "$(ls -A $APP_DIR/uploads 2>/dev/null)" ]; then
    # Usar tar con compresión máxima para ahorrar espacio
    tar -czf "uploads_backup_${DATE}.tar.gz" -C "$APP_DIR" uploads/ 2>/dev/null
    
    if [ -f "uploads_backup_${DATE}.tar.gz" ]; then
        success "✓ Backup de uploads completado: uploads_backup_${DATE}.tar.gz"
    else
        error "✗ Error al crear backup de uploads"
    fi
else
    log "No hay archivos en uploads para respaldar"
fi

# 3. Backup de configuración
log "Creando backup de configuración..."
tar -czf "config_backup_${DATE}.tar.gz" \
    -C "$APP_DIR" \
    --exclude='node_modules' \
    --exclude='uploads' \
    --exclude='logs' \
    --exclude='.git' \
    backend/.env 2>/dev/null || true

if [ -f "config_backup_${DATE}.tar.gz" ]; then
    success "✓ Backup de configuración completado: config_backup_${DATE}.tar.gz"
fi

# 4. Backup de logs importantes (solo los más recientes)
log "Creando backup de logs..."
if [ -d "/var/log/herbario" ]; then
    # Solo logs de los últimos 3 días para ahorrar espacio
    find /var/log/herbario -name "*.log" -mtime -3 -exec tar -czf "logs_backup_${DATE}.tar.gz" {} + 2>/dev/null || true
    
    if [ -f "logs_backup_${DATE}.tar.gz" ]; then
        success "✓ Backup de logs completado: logs_backup_${DATE}.tar.gz"
    fi
fi

# 5. Crear archivo de metadatos del backup
log "Creando metadatos del backup..."
cat > "backup_${DATE}.info" << EOF
Backup Information
==================
Date: $(date)
Hostname: $(hostname)
Database: $DB_NAME
App Directory: $APP_DIR
Backup Directory: $BACKUP_DIR

Files in this backup:
EOF

# Listar archivos del backup con tamaños
ls -lh *_${DATE}.* >> "backup_${DATE}.info" 2>/dev/null || true

# Calcular tamaño total del backup
TOTAL_SIZE=$(du -sh *_${DATE}.* 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
echo "\nTotal backup size: ${TOTAL_SIZE}" >> "backup_${DATE}.info"

success "✓ Metadatos del backup creados: backup_${DATE}.info"

# 6. Verificar integridad de los backups
log "Verificando integridad de los backups..."

# Verificar backup de base de datos
if [ -f "db_backup_${DATE}.dump.gz" ]; then
    if gzip -t "db_backup_${DATE}.dump.gz" 2>/dev/null; then
        success "✓ Backup de base de datos verificado"
    else
        error "✗ Backup de base de datos corrupto"
    fi
fi

# Verificar backups tar
for file in uploads_backup_${DATE}.tar.gz config_backup_${DATE}.tar.gz logs_backup_${DATE}.tar.gz; do
    if [ -f "$file" ]; then
        if tar -tzf "$file" >/dev/null 2>&1; then
            success "✓ $file verificado"
        else
            error "✗ $file corrupto"
        fi
    fi
done

# 7. Limpiar backups antiguos
log "Limpiando backups antiguos (más de $RETENTION_DAYS días)..."
find $BACKUP_DIR -name "*backup*" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find $BACKUP_DIR -name "*.info" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# Contar backups restantes
BACKUP_COUNT=$(find $BACKUP_DIR -name "*backup*" -type f | wc -l)
log "Backups restantes: $BACKUP_COUNT"

# 8. Crear enlace simbólico al backup más reciente
log "Creando enlaces a backup más reciente..."
ln -sf "db_backup_${DATE}.dump.gz" "latest_db_backup.dump.gz" 2>/dev/null || true
ln -sf "uploads_backup_${DATE}.tar.gz" "latest_uploads_backup.tar.gz" 2>/dev/null || true
ln -sf "backup_${DATE}.info" "latest_backup.info" 2>/dev/null || true

# 9. Enviar notificación (opcional)
if command -v mail >/dev/null 2>&1 && [ ! -z "$BACKUP_EMAIL" ]; then
    log "Enviando notificación por email..."
    {
        echo "Backup de Herbario completado exitosamente"
        echo "Fecha: $(date)"
        echo "Servidor: $(hostname)"
        echo ""
        cat "backup_${DATE}.info"
    } | mail -s "Backup Herbario - $DATE" "$BACKUP_EMAIL" 2>/dev/null || true
fi

# 10. Registrar en log del sistema
echo "[$(date)] Backup completado: $DATE" >> /var/log/herbario/backup.log

# Resumen final
echo ""
success "=== Backup completado exitosamente ==="
success "Fecha: $DATE"
success "Ubicación: $BACKUP_DIR"
success "Archivos creados:"
ls -lh $BACKUP_DIR/*_${DATE}.* 2>/dev/null || true

log "Uso de disco después del backup:"
df -h $BACKUP_DIR

log "Backup de Herbario finalizado - $DATE"