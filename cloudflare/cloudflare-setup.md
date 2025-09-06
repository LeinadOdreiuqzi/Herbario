# Configuración de Cloudflare para Herbario

## Configuración DNS

### Registros DNS requeridos:

```
Tipo    Nombre    Contenido              TTL    Proxy
A       @         [IP_DE_TU_VPS]        Auto   ✅ Proxied
A       www       [IP_DE_TU_VPS]        Auto   ✅ Proxied
CNAME   api       yourdomain.com        Auto   ✅ Proxied
```

## Configuración de SSL/TLS

### En el panel de Cloudflare:

1. **SSL/TLS → Overview**
   - Modo de cifrado: `Full (strict)`
   - Esto asegura cifrado end-to-end

2. **SSL/TLS → Edge Certificates**
   - ✅ Always Use HTTPS: `On`
   - ✅ HTTP Strict Transport Security (HSTS): `Enable`
     - Max Age Header: `6 months`
     - Include Subdomains: `On`
     - Preload: `On`
   - ✅ Minimum TLS Version: `TLS 1.2`
   - ✅ Opportunistic Encryption: `On`
   - ✅ TLS 1.3: `On`
   - ✅ Automatic HTTPS Rewrites: `On`

## Configuración de Seguridad

### Security → Settings:

1. **Security Level**: `Medium`
2. **Challenge Passage**: `30 minutes`
3. **Browser Integrity Check**: `On`
4. **Privacy Pass Support**: `On`

### Security → WAF:

1. **Managed Rules**:
   - ✅ Cloudflare Managed Ruleset: `On`
   - ✅ Cloudflare OWASP Core Ruleset: `On`

2. **Rate Limiting Rules** (Plan gratuito permite 5 reglas):

```yaml
# Regla 1: Protección de login
Nombre: "Login Protection"
URL: "yourdomain.com/auth/login"
Método: POST
Límite: 5 requests per minute per IP
Acción: Block

# Regla 2: Protección de API
Nombre: "API Rate Limit"
URL: "yourdomain.com/plants/*"
Límite: 30 requests per minute per IP
Acción: Challenge

# Regla 3: Protección de uploads
Nombre: "Upload Protection"
URL: "yourdomain.com/plants/submissions"
Método: POST
Límite: 10 requests per hour per IP
Acción: Block
```

### Security → Bots:

1. **Bot Fight Mode**: `On` (Plan gratuito)
2. **Super Bot Fight Mode**: No disponible en plan gratuito

## Configuración de Performance

### Speed → Optimization:

1. **Auto Minify**:
   - ✅ JavaScript: `On`
   - ✅ CSS: `On`
   - ✅ HTML: `On`

2. **Brotli**: `On`

3. **Early Hints**: `On`

### Caching → Configuration:

1. **Caching Level**: `Standard`
2. **Browser Cache TTL**: `4 hours`
3. **Always Online**: `On`

### Page Rules (Plan gratuito permite 3 reglas):

```yaml
# Regla 1: Cache estático agresivo
URL: "yourdomain.com/assets/*"
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 month

# Regla 2: No cache para admin
URL: "yourdomain.com/admin*"
Settings:
  - Cache Level: Bypass
  - Disable Security
  - Disable Performance

# Regla 3: Cache API con TTL corto
URL: "yourdomain.com/plants/list*"
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 5 minutes
```

## Configuración de Analytics

### Analytics → Web Analytics:

1. **Web Analytics**: `Enable`
2. **Beacon**: Agregar a tu HTML:

```html
<!-- Cloudflare Web Analytics -->
<script defer src='https://static.cloudflare.com/beacon.min.js' data-cf-beacon='{"token": "TU_TOKEN_AQUI"}'></script>
```

## Headers de Seguridad Personalizados

### Transform Rules → Modify Response Header:

```yaml
# Regla 1: Security Headers
Nombre: "Security Headers"
URL: "yourdomain.com/*"
Headers a agregar:
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## Configuración de Workers (Opcional)

### Para funcionalidades avanzadas en el plan gratuito:

```javascript
// worker.js - Ejemplo de Worker para cache inteligente
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Cache estático por más tiempo
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
    const response = await fetch(request)
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Cache-Control', 'public, max-age=31536000')
    return newResponse
  }
  
  // API con cache corto
  if (url.pathname.startsWith('/plants/list')) {
    const response = await fetch(request)
    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Cache-Control', 'public, max-age=300')
    return newResponse
  }
  
  return fetch(request)
}
```

## Monitoreo y Alertas

### Notifications:

1. **Health Checks**: Configurar para `yourdomain.com/health`
2. **SSL Certificate**: Alertas de expiración
3. **Traffic Anomalies**: Alertas de tráfico inusual

## Verificación de Configuración

### Herramientas para verificar:

1. **SSL Labs**: https://www.ssllabs.com/ssltest/
2. **Security Headers**: https://securityheaders.com/
3. **GTmetrix**: https://gtmetrix.com/
4. **Cloudflare Analytics**: Panel de control

### Comandos de verificación:

```bash
# Verificar headers de seguridad
curl -I https://yourdomain.com

# Verificar SSL
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Verificar DNS
dig yourdomain.com
nslookup yourdomain.com
```

## Límites del Plan Gratuito

- **Requests**: 100,000 por día
- **Page Rules**: 3 reglas
- **Rate Limiting**: 5 reglas
- **Workers**: 100,000 requests por día
- **Analytics**: Básico
- **DDoS Protection**: Básico

## Optimizaciones Específicas para VPS Limitado

1. **Offload máximo a Cloudflare**:
   - Cache todo el contenido estático
   - Usa Workers para lógica simple
   - Aprovecha la compresión de Cloudflare

2. **Reduce carga en el servidor**:
   - Cache API responses cuando sea posible
   - Usa Cloudflare para servir imágenes
   - Implementa rate limiting agresivo

3. **Monitoreo**:
   - Configura alertas de uso de recursos
   - Monitorea métricas de performance
   - Revisa logs regularmente