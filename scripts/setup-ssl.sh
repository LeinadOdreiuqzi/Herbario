#!/bin/bash

# Script de configuración SSL para Herbario
# Configura certificados SSL gratuitos con Let's Encrypt y Certbot

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Configuración SSL para Herbario ===${NC}"

# Verificar si se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}Este script debe ejecutarse como root${NC}"
   exit 1
fi

# Solicitar dominio
read -p "Ingresa tu dominio (ej: herbario.com): " DOMAIN
read -p "Ingresa tu email para notificaciones SSL: " EMAIL

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
    echo -e "${RED}Dominio y email son requeridos${NC}"
    exit 1
fi

echo -e "${YELLOW}Configurando SSL para: $DOMAIN${NC}"

# Actualizar sistema
echo -e "${YELLOW}Actualizando sistema...${NC}"
apt update && apt upgrade -y

# Instalar dependencias
echo -e "${YELLOW}Instalando dependencias...${NC}"
apt install -y nginx certbot python3-certbot-nginx ufw

# Configurar firewall
echo -e "${YELLOW}Configurando firewall...${NC}"
ufw --force enable
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp  # Puerto del backend (solo local)

# Crear directorio para verificación
mkdir -p /var/www/certbot
chown -R www-data:www-data /var/www/certbot

# Crear configuración temporal de Nginx
echo -e "${YELLOW}Creando configuración temporal de Nginx...${NC}"
cat > /etc/nginx/sites-available/temp-$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 200 'SSL Setup in progress';
        add_header Content-Type text/plain;
    }
}
EOF

# Habilitar sitio temporal
ln -sf /etc/nginx/sites-available/temp-$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración de Nginx
nginx -t
systemctl reload nginx

# Obtener certificado SSL
echo -e "${YELLOW}Obteniendo certificado SSL...${NC}"
certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --domains $DOMAIN,www.$DOMAIN

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Certificado SSL obtenido exitosamente${NC}"
else
    echo -e "${RED}✗ Error al obtener certificado SSL${NC}"
    exit 1
fi

# Generar parámetros DH para mayor seguridad
echo -e "${YELLOW}Generando parámetros DH...${NC}"
if [[ ! -f /etc/ssl/certs/dhparam.pem ]]; then
    openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
fi

# Copiar configuración principal de Nginx
echo -e "${YELLOW}Configurando Nginx principal...${NC}"
cp /path/to/herbario/nginx/herbario.conf /etc/nginx/sites-available/$DOMAIN

# Actualizar dominio en la configuración
sed -i "s/yourdomain.com/$DOMAIN/g" /etc/nginx/sites-available/$DOMAIN

# Habilitar sitio principal
rm -f /etc/nginx/sites-enabled/temp-$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Verificar configuración
nginx -t

if [[ $? -eq 0 ]]; then
    systemctl reload nginx
    echo -e "${GREEN}✓ Nginx configurado exitosamente${NC}"
else
    echo -e "${RED}✗ Error en configuración de Nginx${NC}"
    exit 1
fi

# Configurar renovación automática
echo -e "${YELLOW}Configurando renovación automática...${NC}"
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl reload nginx'") | crontab -

# Crear directorio de cache para Nginx
mkdir -p /var/cache/nginx/herbario
chown -R www-data:www-data /var/cache/nginx/herbario

# Configurar logrotate para logs de Nginx
cat > /etc/logrotate.d/herbario << EOF
/var/log/nginx/herbario*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 \`cat /var/run/nginx.pid\`
        fi
    endscript
}
EOF

echo -e "${GREEN}=== Configuración SSL completada ===${NC}"
echo -e "${GREEN}✓ Certificado SSL instalado para: $DOMAIN${NC}"
echo -e "${GREEN}✓ Nginx configurado con HTTPS${NC}"
echo -e "${GREEN}✓ Renovación automática configurada${NC}"
echo -e "${GREEN}✓ Firewall configurado${NC}"
echo -e "${YELLOW}Próximos pasos:${NC}"
echo -e "1. Configurar DNS en Cloudflare"
echo -e "2. Desplegar aplicación"
echo -e "3. Verificar funcionamiento en: https://$DOMAIN"

# Mostrar estado del certificado
echo -e "\n${YELLOW}Estado del certificado:${NC}"
certbot certificates