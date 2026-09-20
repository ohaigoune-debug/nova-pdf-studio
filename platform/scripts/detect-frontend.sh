#!/bin/sh
# يكتشف ما يستمع على 80/443 ويطبع إعداد الموقع الجاهز لتمرير madrasadz.com
# إلى المنصة. قراءة محضة: لا يغيّر شيئاً ولا يوقف خدمة.
#   sh scripts/detect-frontend.sh
set -u

DOMAIN=${DOMAIN:-madrasadz.com}
UPSTREAM=${UPSTREAM:-127.0.0.1:3000}

echo "=== ما يستمع على 80 و443 ==="
LISTEN=$(ss -tlnp 2>/dev/null | awk 'NR==1 || $4 ~ /:(80|443)$/')
echo "${LISTEN:-(تعذّرت القراءة — جرّب بصلاحية root)}"
echo

# أسماء العمليات المرتبطة بالمنفذين
PROCS=$(ss -tlnp 2>/dev/null | awk '$4 ~ /:(80|443)$/' | grep -o '"[^"]*"' | tr -d '"' | sort -u | tr '\n' ' ')
echo "العمليات: ${PROCS:-لا شيء}"
echo

emit_nginx() {
  cat <<EOF
=== nginx — أنشئ /etc/nginx/sites-available/$DOMAIN ثم فعّله ===

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://$UPSTREAM;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade           \$http_upgrade;
        proxy_set_header Connection        "upgrade";
        # رفع الفيديوهات يحتاج حداً أعلى من الافتراضي (1m)
        client_max_body_size 512m;
        proxy_read_timeout 300s;
    }
}

التفعيل ثم الشهادة:
  ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  certbot --nginx -d $DOMAIN -d www.$DOMAIN
EOF
}

emit_apache() {
  cat <<EOF
=== Apache — أنشئ /etc/apache2/sites-available/$DOMAIN.conf ===

<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN

    ProxyPreserveHost On
    ProxyPass        / http://$UPSTREAM/
    ProxyPassReverse / http://$UPSTREAM/

    RemoteIPHeader X-Forwarded-For
    LimitRequestBody 536870912
</VirtualHost>

التفعيل ثم الشهادة:
  a2enmod proxy proxy_http remoteip
  a2ensite $DOMAIN
  apache2ctl configtest && systemctl reload apache2
  certbot --apache -d $DOMAIN -d www.$DOMAIN
EOF
}

emit_caddy() {
  cat <<EOF
=== Caddy — أضف إلى /etc/caddy/Caddyfile ===

$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy $UPSTREAM {
		header_up X-Real-IP {remote_host}
	}
}

ثم:  caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
الشهادة تلقائية — لا تحتاج certbot.
EOF
}

case " $PROCS " in
  *" nginx "*)  emit_nginx ;;
  *" apache2 "*|*" httpd "*) emit_apache ;;
  *" caddy "*)  emit_caddy ;;
  *" docker-proxy "*)
    echo "=== حاوية Docker تحتجز المنفذين ==="
    echo "الحاويات التي تنشر 80/443:"
    docker ps --format '  {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null | grep -E ':(80|443)->' || echo "  (تعذّر سرد الحاويات)"
    echo
    echo "أرسل هذه القائمة: الإعداد يعتمد على ما إن كان Traefik أو nginx-proxy أو Caddy داخل حاوية."
    ;;
  *" litespeed "*|*" lshttpd "*)
    echo "=== OpenLiteSpeed / CyberPanel ==="
    echo "الإعداد من لوحة CyberPanel: Websites ← Add Website لـ $DOMAIN،"
    echo "ثم vHost Conf وأضف proxy إلى http://$UPSTREAM"
    ;;
  "  "|" ")
    echo "=== المنفذان حرّان ==="
    echo "لا حاجة للنسخة الخلفية. استعمل الحزمة كاملة بـCaddy الخاص بها:"
    echo "  bash scripts/deploy-vps.sh"
    ;;
  *)
    echo "=== خادم غير معروف ==="
    echo "العمليات المكتشفة: $PROCS"
    echo "أرسل مخرجات هذا السكربت كاملة ليُكتب لك الإعداد المناسب."
    ;;
esac
