#!/usr/bin/env python3
"""
يُستدعى من الـdialplan بعد انتهاء مكالمة واردة (السياق madrasa-in):
  inbound.py <رقم المتصل> <الاختيار> <ملف التسجيل> <المدة بالثواني> <الشريحة>
يرسل المكالمة وتسجيلها إلى المنصة: POST /api/v1/callcenter/agent/inbound (multipart). بلا مكتبات خارجية.

إن انقطع الإنترنت لا تضيع الرسالة: تُحفظ في /var/spool/madrasa/pending/ ويعيد الوكيل (agent.py) إرسالها لاحقًا.
  inbound.py --flush   يرسل كل المعلّق الآن.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid

ENV_FILE = "/etc/madrasa-box.env"
PENDING = os.environ.get("CC_PENDING_DIR", "/var/spool/madrasa/pending")


def load_env(path=ENV_FILE):
    """Asterisk يشغّل هذا الملف بلا متغيّرات الوكيل: نقرأها من ملف الإعداد نفسه."""
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except OSError:
        pass


load_env()
BASE = os.environ.get("MADRASA_URL", "https://madrasadz.com").rstrip("/")
TOKEN = os.environ.get("CC_TOKEN", "")


def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def post(fields, audio_path):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        if v:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    if audio_path and os.path.exists(audio_path) and os.path.getsize(audio_path) > 44:  # 44 = ترويسة wav فارغة
        with open(audio_path, "rb") as f:
            audio = f.read()
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="recording"; filename="msg.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + audio + b"\r\n")
    body = b"".join(parts) + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(BASE + "/api/v1/callcenter/agent/inbound", data=body, method="POST", headers={"Authorization": "Bearer " + TOKEN, "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "madrasa-box-inbound"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode()


def send(fields, audio_path):
    """True: انتهى أمرها (أُرسلت أو رفضتها المنصة نهائيًا). False: تُعاد لاحقًا."""
    try:
        log("أُرسلت", fields.get("phone"), post(fields, audio_path))
        return True
    except urllib.error.HTTPError as e:
        if e.code in (400, 413, 415):  # رقم مخفي أو ملف مرفوض: لا فائدة من الإعادة
            log("رفضتها المنصة", e.code, fields.get("phone"))
            return True
        log("خطأ من المنصة", e.code, "— ستُعاد")
        return False
    except (urllib.error.URLError, OSError) as e:
        log("المنصة غير متاحة — ستُعاد:", e)
        return False


def queue(fields, audio_path):
    os.makedirs(PENDING, exist_ok=True)
    name = uuid.uuid4().hex
    if audio_path and os.path.exists(audio_path):
        target = os.path.join(PENDING, name + ".wav")
        os.replace(audio_path, target)
        audio_path = target
    with open(os.path.join(PENDING, name + ".json"), "w", encoding="utf-8") as f:
        json.dump({"fields": fields, "audio": audio_path}, f)


def flush():
    """يعيد إرسال المعلّق (يستدعيه الوكيل كل بضع دقائق). يعيد عدد ما أُرسل."""
    if not os.path.isdir(PENDING):
        return 0
    sent = 0
    for name in sorted(os.listdir(PENDING)):
        if not name.endswith(".json"):
            continue
        meta = os.path.join(PENDING, name)
        try:
            with open(meta, encoding="utf-8") as f:
                item = json.load(f)
        except (OSError, ValueError):
            os.remove(meta)
            continue
        if not send(item["fields"], item.get("audio")):
            break  # ما زالت المنصة غير متاحة: نحاول في الجولة القادمة
        for p in (meta, item.get("audio")):
            if p and os.path.exists(p):
                os.remove(p)
        sent += 1
    return sent


def main(phone="", choice="", path="", duration="0", sim=""):
    fields = {"phone": phone or "", "choice": choice, "durationSec": duration, "sim": sim}
    if not phone:
        log("رقم مخفي: لا يمكن ربط الرسالة بزبون، تُهمل")
        if path and os.path.exists(path):
            os.remove(path)
        return
    if send(fields, path):
        if path and os.path.exists(path):
            os.remove(path)  # التسجيل محفوظ في المنصة؛ لا نُبقي نسخة في الصندوق
    else:
        queue(fields, path)


if __name__ == "__main__":
    if sys.argv[1:2] == ["--flush"]:
        print(flush())
    else:
        main(*sys.argv[1:6])
