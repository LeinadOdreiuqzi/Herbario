#!/bin/bash

# Script de monitoreo para Herbario
# Optimizado para VPS con recursos limitados (1 CPU, 4GB RAM)

set -e

# Configuración
LOG_FILE="/var/log/herbario/monitor.log"
ALERT_LOG="/var/log/herbario/alerts.log"
APP_DIR="/var/www/herbario"
SERVICE_NAME="herbario"
BACKEND_URL="http://localhost:3001"
FRONTEND_URL="http://localhost"

# Umbrales de alerta (ajustados para VPS limitado)
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=85
LOAD_THRESHOLD=2.0
SWAP_THRESHOLD=50

# Configuración de notificaciones
EMAIL_ALERTS=${EMAIL_ALERTS:-false}
ALERT_EMAIL=${ALERT_EMAIL:-""}
SLACK_WEBHOOK=${SLACK_WEBHOOK:-""}

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Función de logging
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a $LOG_FILE
}

info() {
    log "INFO" "$@"
    echo -e "${BLUE}[INFO] $@${NC}"
}

warn() {
    log "WARN" "$@"
    echo -e "${YELLOW}[WARN] $@${NC}"
}

error() {
    log "ERROR" "$@"
    echo -e "${RED}[ERROR] $@${NC}"
}

success() {
    log "SUCCESS" "$@"
    echo -e "${GREEN}[SUCCESS] $@${NC}"
}

alert() {
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ALERT: $message" | tee -a $ALERT_LOG
    error "ALERT: $message"
    send_notification "🚨 Herbario Alert" "$message"
}

# Función para enviar notificaciones
send_notification() {
    local title="$1"
    local message="$2"
    
    # Email
    if [ "$EMAIL_ALERTS" = "true" ] && [ ! -z "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$title" "$ALERT_EMAIL" 2>/dev/null || true
    fi
    
    # Slack
    if [ ! -z "$SLACK_WEBHOOK" ] && command -v curl >/dev/null 2>&1; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$title\\n$message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null || true
    fi
}

# Crear directorios de logs si no existen
mkdir -p $(dirname $LOG_FILE)
mkdir -p $(dirname $ALERT_LOG)

info "Iniciando monitoreo de Herbario - $(date)"

# 1. Verificar servicios principales
check_services() {
    info "Verificando servicios..."
    
    # PostgreSQL
    if systemctl is-active --quiet postgresql; then
        success "✓ PostgreSQL activo"
    else
        alert "PostgreSQL no está funcionando"
        systemctl restart postgresql || true
    fi
    
    # Nginx
    if systemctl is-active --quiet nginx; then
        success "✓ Nginx activo"
    else
        alert "Nginx no está funcionando"
        systemctl restart nginx || true
    fi
    
    # PM2/Aplicación
    if sudo -u herbario pm2 list | grep -q "$SERVICE_NAME.*online"; then
        success "✓ Aplicación Herbario activa"
    else
        alert "Aplicación Herbario no está funcionando"
        sudo -u herbario pm2 restart $SERVICE_NAME || true
    fi
}

# 2. Verificar conectividad de la aplicación
check_app_health() {
    info "Verificando salud de la aplicación..."
    
    # Backend health check
    if curl -f -s --max-time 10 "$BACKEND_URL/health" >/dev/null; then
        success "✓ Backend respondiendo"
    else
        alert "Backend no responde en $BACKEND_URL/health"
    fi
    
    # Frontend check
    if curl -f -s --max-time 10 "$FRONTEND_URL" >/dev/null; then
        success "✓ Frontend accesible"
    else
        warn "Frontend no accesible en $FRONTEND_URL"
    fi
}

# 3. Monitorear uso de CPU
check_cpu() {
    info "Verificando uso de CPU..."
    
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')
    local cpu_int=${cpu_usage%.*}
    
    if [ $cpu_int -gt $CPU_THRESHOLD ]; then
        alert "Uso de CPU alto: ${cpu_usage}% (umbral: ${CPU_THRESHOLD}%)"
    else
        info "Uso de CPU: ${cpu_usage}%"
    fi
    
    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    if (( $(echo "$load_avg > $LOAD_THRESHOLD" | bc -l) )); then
        alert "Load average alto: $load_avg (umbral: $LOAD_THRESHOLD)"
    else
        info "Load average: $load_avg"
    fi
}

# 4. Monitorear uso de memoria
check_memory() {
    info "Verificando uso de memoria..."
    
    local mem_info=$(free | grep Mem)
    local total_mem=$(echo $mem_info | awk '{print $2}')
    local used_mem=$(echo $mem_info | awk '{print $3}')
    local mem_usage=$(( used_mem * 100 / total_mem ))
    
    if [ $mem_usage -gt $MEMORY_THRESHOLD ]; then
        alert "Uso de memoria alto: ${mem_usage}% (umbral: ${MEMORY_THRESHOLD}%)"
        
        # Mostrar procesos que más memoria consumen
        info "Top 5 procesos por memoria:"
        ps aux --sort=-%mem | head -6 | tee -a $LOG_FILE
    else
        info "Uso de memoria: ${mem_usage}%"
    fi
    
    # Verificar swap
    local swap_info=$(free | grep Swap)
    if [ "$swap_info" != "" ]; then
        local total_swap=$(echo $swap_info | awk '{print $2}')
        if [ $total_swap -gt 0 ]; then
            local used_swap=$(echo $swap_info | awk '{print $3}')
            local swap_usage=$(( used_swap * 100 / total_swap ))
            
            if [ $swap_usage -gt $SWAP_THRESHOLD ]; then
                warn "Uso de swap alto: ${swap_usage}% (umbral: ${SWAP_THRESHOLD}%)"
            else
                info "Uso de swap: ${swap_usage}%"
            fi
        fi
    fi
}

# 5. Monitorear espacio en disco
check_disk() {
    info "Verificando espacio en disco..."
    
    # Disco raíz
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $disk_usage -gt $DISK_THRESHOLD ]; then
        alert "Espacio en disco bajo: ${disk_usage}% usado (umbral: ${DISK_THRESHOLD}%)"
        
        # Mostrar directorios que más espacio consumen
        info "Directorios que más espacio consumen:"
        du -h / 2>/dev/null | sort -hr | head -10 | tee -a $LOG_FILE || true
    else
        info "Uso de disco: ${disk_usage}%"
    fi
    
    # Verificar inodos
    local inode_usage=$(df -i / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ $inode_usage -gt 80 ]; then
        warn "Uso de inodos alto: ${inode_usage}%"
    fi
}

# 6. Verificar logs de errores
check_logs() {
    info "Verificando logs de errores..."
    
    # Errores en logs de la aplicación (últimos 5 minutos)
    local error_count=$(find /var/log/herbario -name "*.log" -mmin -5 -exec grep -i "error\|exception\|fatal" {} \; 2>/dev/null | wc -l)
    
    if [ $error_count -gt 10 ]; then
        warn "Muchos errores en logs: $error_count errores en los últimos 5 minutos"
    elif [ $error_count -gt 0 ]; then
        info "Errores en logs: $error_count en los últimos 5 minutos"
    fi
    
    # Verificar logs del sistema
    local sys_errors=$(journalctl --since "5 minutes ago" --priority=err --no-pager -q | wc -l)
    if [ $sys_errors -gt 5 ]; then
        warn "Errores del sistema: $sys_errors en los últimos 5 minutos"
    fi
}

# 7. Verificar conectividad de red
check_network() {
    info "Verificando conectividad de red..."
    
    # Verificar conectividad a internet
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        success "✓ Conectividad a internet OK"
    else
        alert "Sin conectividad a internet"
    fi
    
    # Verificar puertos principales
    local ports=("80" "443" "22" "5432")
    for port in "${ports[@]}"; do
        if netstat -tuln | grep -q ":$port "; then
            success "✓ Puerto $port abierto"
        else
            warn "Puerto $port no está abierto"
        fi
    done
}

# 8. Verificar base de datos
check_database() {
    info "Verificando base de datos..."
    
    # Verificar conexión a PostgreSQL
    if sudo -u postgres psql -c "SELECT 1;" >/dev/null 2>&1; then
        success "✓ Conexión a PostgreSQL OK"
        
        # Verificar tamaño de la base de datos
        local db_size=$(sudo -u postgres psql -t -c "SELECT pg_size_pretty(pg_database_size('herbario'));" 2>/dev/null | xargs)
        info "Tamaño de base de datos: $db_size"
        
        # Verificar conexiones activas
        local active_connections=$(sudo -u postgres psql -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs)
        info "Conexiones activas: $active_connections"
        
        if [ $active_connections -gt 20 ]; then
            warn "Muchas conexiones activas: $active_connections"
        fi
    else
        alert "No se puede conectar a PostgreSQL"
    fi
}

# 9. Verificar certificados SSL
check_ssl() {
    info "Verificando certificados SSL..."
    
    local cert_file="/etc/letsencrypt/live/*/fullchain.pem"
    if ls $cert_file 1> /dev/null 2>&1; then
        local cert_path=$(ls $cert_file | head -1)
        local expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo 0)
        local current_epoch=$(date +%s)
        local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ $days_until_expiry -lt 30 ]; then
            alert "Certificado SSL expira pronto: $days_until_expiry días"
        elif [ $days_until_expiry -lt 7 ]; then
            alert "Certificado SSL expira muy pronto: $days_until_expiry días"
        else
            info "Certificado SSL válido por $days_until_expiry días"
        fi
    else
        warn "No se encontraron certificados SSL"
    fi
}

# 10. Generar reporte de estado
generate_report() {
    info "Generando reporte de estado..."
    
    local report_file="/var/log/herbario/status_report_$(date +%Y%m%d_%H%M%S).txt"
    
    {
        echo "=== Reporte de Estado de Herbario ==="
        echo "Fecha: $(date)"
        echo "Servidor: $(hostname)"
        echo ""
        echo "=== Recursos del Sistema ==="
        echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | sed 's/%us,//')%"
        echo "Memoria: $(free -h | grep Mem | awk '{print $3"/"$2}')"
        echo "Disco: $(df -h / | tail -1 | awk '{print $3"/"$2" ("$5" usado)"}')"
        echo "Load: $(uptime | awk -F'load average:' '{print $2}')"
        echo ""
        echo "=== Servicios ==="
        systemctl is-active postgresql nginx || true
        sudo -u herbario pm2 list | grep herbario || true
        echo ""
        echo "=== Red ==="
        netstat -tuln | grep -E ':(80|443|22|5432|3001) '
        echo ""
        echo "=== Procesos Top ==="
        ps aux --sort=-%cpu | head -6
    } > "$report_file"
    
    info "Reporte guardado en: $report_file"
}

# Función principal
main() {
    check_services
    check_app_health
    check_cpu
    check_memory
    check_disk
    check_logs
    check_network
    check_database
    check_ssl
    generate_report
    
    success "Monitoreo completado - $(date)"
}

# Ejecutar monitoreo
main

# Limpiar logs antiguos (mantener solo 30 días)
find /var/log/herbario -name "*.log" -mtime +30 -delete 2>/dev/null || true
find /var/log/herbario -name "status_report_*.txt" -mtime +7 -delete 2>/dev/null || true