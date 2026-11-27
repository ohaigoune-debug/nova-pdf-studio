#!/usr/bin/env bash
# تثبيت صندوق مركز الاتصال (مدرسة) على لابتوب Ubuntu 24.04 بأمر واحد (في الطرفية Terminal):
#
#   wget -qO- https://raw.githubusercontent.com/ohaigoune-debug/nova-pdf-studio/work/platform/deploy/callcenter-box/install.sh | sudo bash
#
# يطلب منك شيئًا واحدًا: رمز الجهاز من «مركز الاتصال ← الإعدادات ← إنشاء الرمز».
# إعادة تشغيله آمنة (تحديث): يحتفظ بالرمز وبكلمة سر AMI وبالتسجيلات الصوتية.
#
# ما يفعله:
#   1. يثبّت Asterisk وأدوات الصوت والجدار الناري.
#   2. ينسخ الوكيل (agent.py) ومستقبل المكالمات الواردة (inbound.py) والـdialplan إلى /opt/madrasa-box.
#   3. يربط Asterisk بـ TG400L عبر كابل الشبكة: اللابتوب 192.168.5.10 والجهاز على عنوانه الأصلي 192.168.5.150.
#   4. يشغّل كل شيء خدماتٍ تعود وحدها بعد انقطاع الكهرباء، ويمنع اللابتوب من النوم ولو أُغلق غطاؤه.
#
# متغيّرات اختيارية: CC_TOKEN (بدل السؤال)، MADRASA_URL، MADRASA_BOX_REF (فرع GitHub، الافتراضي work)،
#   MADRASA_BOX_SRC (مجلد محلي بدل GitHub، للاختبار)، MADRASA_SKIP_SYSTEM=1 (بلا شبكة/نوم/GRUB/جدار، للاختبار).
set -euo pipefail

REF="${MADRASA_BOX_REF:-work}"
RAW="https://raw.githubusercontent.com/ohaigoune-debug/nova-pdf-studio/${REF}/platform/deploy/callcenter-box"
SRC="${MADRASA_BOX_SRC:-}"
URL="${MADRASA_URL:-https://madrasadz.com}"
BOX=/opt/madrasa-box
ENVF=/etc/madrasa-box.env
SOUNDS=/var/lib/madrasa-box/sounds
SPOOL=/var/spool/madrasa
LOGD=/var/log/madrasa-box
ORIG=/etc/asterisk/madrasa-orig
LAPTOP_IP=192.168.5.10
GW_IP=192.168.5.150
NET=192.168.5.0/24
CON=madrasa-tg400l
FILES=(agent.py inbound.py extensions_madrasa.conf madrasa-box)

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok() { printf '   \033[32m✔\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die() { printf '\n\033[31m✘ %s\033[0m\n' "$*" >&2; exit 1; }
has_systemd() { [ -d /run/systemd/system ]; }

[ "$(id -u)" -eq 0 ] || die "شغّله بـ sudo:  wget -qO- …/install.sh | sudo bash"
. /etc/os-release 2>/dev/null || true
[ "${ID:-}" = ubuntu ] || warn "هذا السكربت مُعدّ لـ Ubuntu 24.04 (وجدت: ${PRETTY_NAME:-نظام غير معروف})"
[ "${VERSION_ID:-}" = 24.04 ] || warn "الإصدار المُختبَر هو 24.04 (وجدت: ${VERSION_ID:-?})"

# ---------------------------------------------------------------- 1. الحزم
say "1/7 تثبيت Asterisk والأدوات (قد يأخذ بضع دقائق)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends asterisk asterisk-core-sounds-en-gsm python3 sox alsa-utils ufw wget ca-certificates iputils-ping iproute2 openssl >/dev/null
ok "Asterisk $(asterisk -V 2>/dev/null | awk '{print $2}')"

# ---------------------------------------------------------------- 2. ملفات الصندوق
say "2/7 تنزيل ملفات الصندوق"
install -d -m 755 "$BOX"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for f in "${FILES[@]}"; do
  if [ -n "$SRC" ]; then cp "$SRC/$f" "$TMP/$f"; else wget -q -O "$TMP/$f" "$RAW/$f" || die "تعذّر تنزيل $f — تحقّق من الإنترنت"; fi
  [ -s "$TMP/$f" ] || die "الملف $f فارغ"
done
python3 -m py_compile "$TMP/agent.py" "$TMP/inbound.py" || die "ملفات بايثون تالفة"
install -m 755 "$TMP/agent.py" "$TMP/inbound.py" "$BOX/"
install -m 644 "$TMP/extensions_madrasa.conf" /etc/asterisk/extensions_madrasa.conf
install -m 755 "$TMP/madrasa-box" /usr/local/bin/madrasa-box
rm -rf "$BOX/__pycache__"
ok "في $BOX والأمر: madrasa-box"

# ---------------------------------------------------------------- 3. الرمز والإعداد
say "3/7 رمز الجهاز"
old() { [ -f "$ENVF" ] && grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- || true; }
TOKEN="${CC_TOKEN:-$(old CC_TOKEN)}"
if [ -z "$TOKEN" ]; then
  [ -r /dev/tty ] || die "لا أستطيع السؤال عن الرمز هنا. أعد التشغيل هكذا:  sudo CC_TOKEN=cc_… bash install.sh"
  echo "   افتح madrasadz.com ← مركز الاتصال ← الإعدادات ← «إنشاء الرمز»، انسخه والصقه هنا (Ctrl+Shift+V) ثم Enter:"
  read -r -s -p "   الرمز: " TOKEN </dev/tty
  echo
fi
TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
[[ "$TOKEN" =~ ^cc_[A-Za-z0-9_-]{20,}$ ]] || die "الرمز غير صحيح: يبدأ بـ cc_ ثم حروف وأرقام. انسخه كاملاً من صفحة الإعدادات"
AMI_SECRET="$(old AMI_SECRET)"
[ -n "$AMI_SECRET" ] || AMI_SECRET=$(openssl rand -hex 24)
umask 077
cat >"$ENVF" <<EOF
# إعداد صندوق مركز الاتصال — كتبه install.sh. لتغيير الرمز:  sudo madrasa-box token
MADRASA_URL=$URL
CC_TOKEN=$TOKEN
AMI_HOST=127.0.0.1
AMI_PORT=5038
AMI_USER=madrasa
AMI_SECRET=$AMI_SECRET
CC_TRUNK_PATTERN=PJSIP/{sim}{local}@tg400l
CC_GATEWAY_ENDPOINT=tg400l
CC_SIMS=1,2,3
EOF
umask 022
chown root:asterisk "$ENVF"
chmod 640 "$ENVF"
ok "محفوظ في $ENVF (الرمز ينتهي بـ …${TOKEN: -4})"

# ---------------------------------------------------------------- 4. Asterisk
say "4/7 إعداد Asterisk"
install -d -m 755 "$ORIG"
for f in pjsip.conf extensions.conf modules.conf rtp.conf; do
  if [ -f "/etc/asterisk/$f" ] && [ ! -f "$ORIG/$f" ]; then cp -p "/etc/asterisk/$f" "$ORIG/$f"; fi
done

cat >/etc/asterisk/pjsip.conf <<EOF
; كتبه install.sh (مدرسة). الأصل في $ORIG/
; TG400L موصول بكابل مباشرة باللابتوب: Asterisk $LAPTOP_IP ⇄ TG400L $GW_IP (جذع SIP بلا تسجيل، Peer)

[global]
type=global
user_agent=MadrasaBox

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

; لا يُقبل SIP إلا من شبكة الكابل (والجهاز نفسه)
[acl]
type=acl
deny=0.0.0.0/0.0.0.0
permit=$NET
permit=127.0.0.1

[tg400l]
type=endpoint
transport=transport-udp
context=madrasa-from-gw
disallow=all
allow=alaw,ulaw
dtmf_mode=rfc4733
aors=tg400l
media_address=$LAPTOP_IP
direct_media=no
rtp_symmetric=yes
force_rport=yes
rewrite_contact=yes
from_user=madrasa
from_domain=$LAPTOP_IP
trust_id_inbound=yes

[tg400l]
type=aor
contact=sip:$GW_IP:5060
qualify_frequency=30
qualify_timeout=3

[tg400l]
type=identify
endpoint=tg400l
match=$GW_IP
EOF

cat >/etc/asterisk/extensions.conf <<EOF
; كتبه install.sh (مدرسة). الأصل في $ORIG/
[general]
static=yes
writeprotect=yes
clearglobalvars=no

[globals]

#include extensions_madrasa.conf
EOF

cat >/etc/asterisk/rtp.conf <<EOF
; كتبه install.sh (مدرسة): مجال ضيّق يكفي 4 مكالمات معًا، ويُفتح في الجدار الناري لشبكة الكابل فقط
[general]
rtpstart=10000
rtpend=10100
EOF

# chan_sip القديم يحجز المنفذ 5060 نفسه: نوقفه
if ! grep -qE '^\s*noload\s*=>\s*chan_sip\.so' /etc/asterisk/modules.conf; then
  sed -i '/^\[modules\]/a noload => chan_sip.so' /etc/asterisk/modules.conf
fi

install -d -m 755 /etc/asterisk/manager.d
cat >/etc/asterisk/manager.d/madrasa.conf <<EOF
; كتبه install.sh: مستخدم الوكيل (AMI يستمع على 127.0.0.1 فقط في manager.conf)
[madrasa]
secret=$AMI_SECRET
deny=0.0.0.0/0.0.0.0
permit=127.0.0.1/255.255.255.255
read=system,call,user,reporting
write=system,call,originate
EOF
grep -qE '^\s*bindaddr\s*=\s*127\.0\.0\.1' /etc/asterisk/manager.conf || warn "manager.conf لا يستمع على 127.0.0.1 فقط — راجعه"
grep -q 'manager.d' /etc/asterisk/manager.conf || printf '\n#include "manager.d/*.conf"\n' >>/etc/asterisk/manager.conf
chown root:asterisk /etc/asterisk/manager.d/madrasa.conf /etc/asterisk/pjsip.conf
chmod 640 /etc/asterisk/manager.d/madrasa.conf

install -d -o asterisk -g asterisk -m 750 "$SPOOL" "$SPOOL/pending"
install -d -o asterisk -g asterisk -m 755 "$LOGD"
install -d -o root -g asterisk -m 755 "$SOUNDS"
ok "جذع tg400l، الـdialplan، مستخدم AMI"

# ---------------------------------------------------------------- 5. الخدمات
say "5/7 الخدمات (تعود وحدها بعد أي انقطاع)"
install -d /etc/systemd/system/asterisk.service.d
cat >/etc/systemd/system/asterisk.service.d/madrasa.conf <<'EOF'
[Service]
Restart=always
RestartSec=5
EOF
cat >/etc/systemd/system/madrasa-agent.service <<EOF
[Unit]
Description=Madrasa call-center agent (platform ⇄ Asterisk ⇄ TG400L)
Wants=network-online.target
After=network-online.target asterisk.service
Requires=asterisk.service

[Service]
User=asterisk
Group=asterisk
EnvironmentFile=$ENVF
ExecStart=/usr/bin/python3 -u $BOX/agent.py
Restart=always
RestartSec=10
StandardOutput=append:$LOGD/agent.log
StandardError=append:$LOGD/agent.log

[Install]
WantedBy=multi-user.target
EOF
cat >/etc/logrotate.d/madrasa-box <<EOF
$LOGD/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  copytruncate
}
EOF
if has_systemd; then
  systemctl daemon-reload
  systemctl enable -q asterisk madrasa-agent
  systemctl restart asterisk
  sleep 3
  systemctl restart madrasa-agent
  ok "asterisk و madrasa-agent تعملان"
else
  warn "systemd غير متاح هنا: لم أشغّل الخدمات"
fi

if [ "${MADRASA_SKIP_SYSTEM:-0}" = 1 ]; then
  warn "MADRASA_SKIP_SYSTEM=1: تخطّيت الشبكة والنوم وGRUB والجدار الناري"
  echo; echo "انتهى التثبيت (وضع الاختبار)."; exit 0
fi

# ---------------------------------------------------------------- 6. الكابل إلى TG400L
say "6/7 شبكة الكابل إلى TG400L"
if command -v nmcli >/dev/null; then
  # لا نلمس أبدًا المنفذ الذي يحمل الإنترنت الآن (حاسوب مكتبي موصول بالمودم بكابل مثلاً)
  DEF=$(ip -o route show default 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')
  ETH=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: -v d="$DEF" '$2=="ethernet" && $1!=d {print $1; exit}')
  ETH_NET=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | awk -F: -v d="$DEF" '$2=="ethernet" && $1==d {print $1; exit}')
  if [ -z "$ETH" ] && [ -n "$ETH_NET" ]; then
    warn "منفذ الكابل الوحيد ($ETH_NET) يحمل الإنترنت الآن، فلم أغيّره."
    warn "اجعل الإنترنت عبر الويفي (أو محوّل USB-Ethernet ثانٍ للـTG400L) ثم أعد تشغيل السكربت"
  elif [ -n "$ETH" ]; then
    if nmcli -t -f NAME connection show | grep -qx "$CON"; then nmcli connection delete "$CON" >/dev/null; fi
    nmcli connection add type ethernet ifname "$ETH" con-name "$CON" \
      ipv4.method manual ipv4.addresses "$LAPTOP_IP/24" ipv4.never-default yes ipv4.ignore-auto-dns yes \
      ipv6.method disabled connection.autoconnect yes connection.autoconnect-priority 100 >/dev/null
    nmcli connection up "$CON" >/dev/null 2>&1 || true
    ok "المنفذ $ETH ثابت على $LAPTOP_IP (الإنترنت يبقى عبر الويفي)"
  else
    warn "لم أجد منفذ Ethernet في الحاسوب. استعمل محوّل USB-Ethernet ثم أعد تشغيل السكربت"
  fi
else
  warn "nmcli غير موجود: اضبط يدويًا عنوان $LAPTOP_IP/24 على منفذ الكابل"
fi
# حين يُوصل الكابل بعد تشغيل Asterisk: نعيد فحص الجهاز فورًا
install -d /etc/NetworkManager/dispatcher.d
cat >/etc/NetworkManager/dispatcher.d/90-madrasa <<EOF
#!/bin/sh
[ "\$CONNECTION_ID" = "$CON" ] && [ "\$2" = up ] && /usr/sbin/asterisk -rx 'pjsip qualify tg400l' >/dev/null 2>&1
exit 0
EOF
chmod 755 /etc/NetworkManager/dispatcher.d/90-madrasa

ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow from "$NET" to any port 5060 proto udp comment 'TG400L SIP' >/dev/null
ufw allow from "$NET" to any port 10000:10100 proto udp comment 'TG400L RTP' >/dev/null
ufw --force enable >/dev/null
ok "الجدار الناري: لا دخول من الخارج، ومن TG400L فقط SIP والصوت"

# ---------------------------------------------------------------- 7. لا نوم أبدًا
say "7/7 يعمل ليلاً ونهارًا"
systemctl mask -q sleep.target suspend.target hibernate.target hybrid-sleep.target 2>/dev/null || true
install -d /etc/systemd/logind.conf.d
cat >/etc/systemd/logind.conf.d/madrasa.conf <<'EOF'
[Login]
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
HandleLidSwitchDocked=ignore
HandleSuspendKey=ignore
HandleHibernateKey=ignore
IdleAction=ignore
EOF
systemctl kill -s HUP systemd-logind 2>/dev/null || true
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != root ]; then
  U_ID=$(id -u "$SUDO_USER")
  BUS="unix:path=/run/user/$U_ID/bus"
  if [ -S "/run/user/$U_ID/bus" ]; then
    for key in sleep-inactive-ac-type sleep-inactive-battery-type; do
      sudo -u "$SUDO_USER" DBUS_SESSION_BUS_ADDRESS="$BUS" gsettings set org.gnome.settings-daemon.plugins.power "$key" nothing 2>/dev/null || true
    done
  fi
fi
ok "لا نوم، ولا توقف عند إغلاق الغطاء"

if [ -f /etc/default/grub ]; then
  [ -f "$ORIG/grub" ] || cp -p /etc/default/grub "$ORIG/grub"
  setg() { if grep -qE "^#?\s*$1=" /etc/default/grub; then sed -i -E "s|^#?\s*$1=.*|$1=$2|" /etc/default/grub; else echo "$1=$2" >>/etc/default/grub; fi; }
  setg GRUB_DEFAULT 0
  setg GRUB_RECORDFAIL_TIMEOUT 10   # بعد انقطاع الكهرباء لا تنتظر القائمة إلى الأبد
  if [ -d /boot/efi/EFI/Microsoft ] || (command -v os-prober >/dev/null && os-prober 2>/dev/null | grep -qi windows); then
    setg GRUB_TIMEOUT_STYLE menu
    setg GRUB_TIMEOUT 10
    setg GRUB_DISABLE_OS_PROBER false
    ok "تشغيل مزدوج: القائمة 10 ثوانٍ ثم Ubuntu وحده"
  fi
  update-grub >/dev/null 2>&1 && ok "قائمة الإقلاع محدّثة" || warn "تعذّر update-grub"
fi

echo
madrasa-box status || true
cat <<EOF

انتهى التثبيت ✔
  • الحالة في أي وقت:        madrasa-box status
  • تسجيل الرسائل بصوتك:     madrasa-box record
  • مكالمة تجربة لهاتفك:      madrasa-box test-call 0550xxxxxx 1
  • صفحة إعداد TG400L:       http://$GW_IP   (بعد وصل الكابل)
EOF
