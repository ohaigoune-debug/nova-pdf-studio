#!/usr/bin/env python3
"""
يُستدعى من الـdialplan بعد انتهاء مكالمة واردة (السياق madrasa-in):
  System(/opt/madrasa-box/inbound.py ${CALLERID(num)} ${CC_CHOICE} ${CC_FILE} ${CC_DURATION} 4)
يرسل المكالمة وتسجيلها إلى المنصة: POST /api/v1/callcenter/agent/inbound (multipart). بلا مكتبات خارجية.
"""
import os
import sys
import urllib.request
import uuid

BASE = os.environ.get("MADRASA_URL", "https://madrasadz.com").rstrip("/")
TOKEN = os.environ.get("CC_TOKEN", "")


def main(phone, choice="", path="", duration="0", sim="4"):
    boundary = uuid.uuid4().hex
    parts = []
    for k, v in (("phone", phone), ("choice", choice), ("durationSec", duration), ("sim", sim)):
        if v:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    if path and os.path.exists(path) and os.path.getsize(path) > 44:
        with open(path, "rb") as f:
            audio = f.read()
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="recording"; filename="msg.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + audio + b"\r\n")
    body = b"".join(parts) + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(BASE + "/api/v1/callcenter/agent/inbound", data=body, method="POST", headers={"Authorization": "Bearer " + TOKEN, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        print(r.read().decode())
    if path and os.path.exists(path):
        os.remove(path)  # التسجيل محفوظ في المنصة؛ لا نُبقي نسخة في الصندوق


if __name__ == "__main__":
    main(*sys.argv[1:6])
