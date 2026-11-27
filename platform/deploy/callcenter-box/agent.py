#!/usr/bin/env python3
"""
وكيل الصندوق المحلي لمركز الاتصال (مدرسة) — مسودة المرحلة 0، تُختبر مع الجهاز قبل أي تشغيل حقيقي.

يعمل على الحاسوب الصغير في بوسعادة بجانب Asterisk وبوابة Yeastar TG400L:
  1. يسحب المكالمات من المنصة: POST /api/v1/callcenter/agent/pull (اتصال صادر HTTPS فقط، لا منفذ مفتوح).
  2. يطلب من Asterisk (AMI) الاتصال عبر الشريحة المحددة، فيشغّل الـdialplan التسجيلَ ويقرأ الزر.
  3. يعيد النتيجة: POST /api/v1/callcenter/agent/report.

بلا مكتبات خارجية (Python 3.9+). الإعداد من متغيّرات البيئة (انظر README.md):
  MADRASA_URL, CC_TOKEN, AMI_HOST, AMI_PORT, AMI_USER, AMI_SECRET, CC_TRUNK_PATTERN, CC_SIMS
"""
import json
import os
import socket
import sys
import threading
import time
import urllib.error
import urllib.request

VERSION = "0.1"
BASE = os.environ.get("MADRASA_URL", "https://madrasadz.com").rstrip("/")
TOKEN = os.environ.get("CC_TOKEN", "")
AMI_HOST = os.environ.get("AMI_HOST", "127.0.0.1")
AMI_PORT = int(os.environ.get("AMI_PORT", "5038"))
AMI_USER = os.environ.get("AMI_USER", "madrasa")
AMI_SECRET = os.environ.get("AMI_SECRET", "")
# قناة الخروج لكل شريحة: {sim} رقم المنفذ و{dial} الرقم. مثال لجذع SIP واحد مع بادئة منفذ في TG400L:
#   PJSIP/{sim}{dial}@tg400l   (اضبط قواعد التوجيه في الجهاز: البادئة 1 ⇒ المنفذ 1 …)
TRUNK = os.environ.get("CC_TRUNK_PATTERN", "PJSIP/{sim}{local}@tg400l")
SIMS = [int(s) for s in os.environ.get("CC_SIMS", "1,2,3").split(",") if s.strip()]
POLL_SECONDS = int(os.environ.get("CC_POLL_SECONDS", "15"))
MAX_PARALLEL = int(os.environ.get("CC_MAX_PARALLEL", str(len(SIMS))))
RING_SECONDS = int(os.environ.get("CC_RING_SECONDS", "35"))


def log(*a):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *a, flush=True)


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "User-Agent": "madrasa-box/" + VERSION})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode() or "{}")


class Ami:
    """اتصال AMI بسيط: Originate، وانتظار حدث UserEvent(ccresult) الذي يرسله الـdialplan."""

    def __init__(self):
        self.sock = None
        self.lock = threading.Lock()
        self.waiters = {}  # ActionID / TaskId ⇒ (Event, dict)

    def connect(self):
        self.sock = socket.create_connection((AMI_HOST, AMI_PORT), timeout=10)
        self.sock.settimeout(None)
        self.send({"Action": "Login", "Username": AMI_USER, "Secret": AMI_SECRET, "Events": "user,call"})
        threading.Thread(target=self.reader, daemon=True).start()

    def send(self, fields):
        msg = "".join(f"{k}: {v}\r\n" for k, v in fields.items()) + "\r\n"
        with self.lock:
            self.sock.sendall(msg.encode())

    def reader(self):
        buf = b""
        while True:
            chunk = self.sock.recv(4096)
            if not chunk:
                log("AMI: انقطع الاتصال")
                os._exit(2)  # يعيد systemd تشغيله
            buf += chunk
            while b"\r\n\r\n" in buf:
                raw, buf = buf.split(b"\r\n\r\n", 1)
                ev = {}
                for line in raw.decode(errors="replace").split("\r\n"):
                    if ": " in line:
                        k, v = line.split(": ", 1)
                        ev[k] = v
                self.dispatch(ev)

    def dispatch(self, ev):
        name = ev.get("Event")
        if name == "UserEvent" and ev.get("UserEvent") == "ccresult":
            key = ev.get("Task")
        elif name == "OriginateResponse":
            key = ev.get("ActionID")
        else:
            return
        w = self.waiters.get(key)
        if w:
            w[1].update(ev)
            w[0].set()

    def call(self, task):
        """يتصل ويعيد (outcome, digit, duration)."""
        done, res = threading.Event(), {}
        self.waiters[task["id"]] = (done, res)
        try:
            self.send({
                "Action": "Originate",
                "ActionID": task["id"],
                "Channel": TRUNK.format(sim=task["simSlot"], dial=task["dial"], local=task["phone"]),
                "Context": "madrasa-out",
                "Exten": "s",
                "Priority": "1",
                "Timeout": str(RING_SECONDS * 1000),
                "Async": "true",
                "CallerID": "Madrasa",
                "Variable": f"CC_TASK={task['id']},CC_SCRIPT={task['script'] or 'SUSPENDED'},CC_DIGITS={''.join(task['digits'])}",
            })
            # الردّ: ننتظر نتيجة الـdialplan؛ عدم الردّ: OriginateResponse بـ Failure
            if not done.wait(RING_SECONDS + 120):
                return "FAILED", None, None
            if res.get("Event") == "OriginateResponse" and res.get("Response") == "Failure":
                reason = res.get("Reason", "")
                # أسباب Asterisk: 3 = لم يردّ، 5 = مشغول، 8 = ازدحام/رفض
                return {"3": "NO_ANSWER", "5": "BUSY", "8": "REJECTED"}.get(reason, "FAILED"), None, 0
            if res.get("Event") == "OriginateResponse":  # Success: ننتظر حدث النتيجة
                done.clear()
                # الحدث ربما وصل قبل clear(): update() تكتب Event=UserEvent فوق السابق
                if res.get("Event") != "UserEvent" and not done.wait(180):
                    return "ANSWERED", None, None
            digit = res.get("Digit") or None
            duration = int(res.get("Duration", "0") or 0)
            return "ANSWERED", digit, duration
        finally:
            self.waiters.pop(task["id"], None)


def worker(ami, task):
    try:
        outcome, digit, duration = ami.call(task)
    except Exception as e:  # noqa: BLE001
        outcome, digit, duration = "FAILED", None, None
        log("خطأ اتصال", task["id"], e)
    try:
        api("POST", "/api/v1/callcenter/agent/report", {"taskId": task["id"], "outcome": outcome, "digit": digit, "durationSec": duration})
        log("نتيجة", task["phone"], "شريحة", task["simSlot"], outcome, digit or "")
    except urllib.error.URLError as e:
        log("تعذّر إرسال النتيجة (ستُعاد المهمة بعد انتهاء الحجز):", e)


def main():
    if not TOKEN:
        sys.exit("CC_TOKEN غير مضبوط: أنشئ الرمز من لوحة مركز الاتصال")
    log("ping", api("GET", f"/api/v1/callcenter/agent/ping?v={VERSION}").get("mode"))
    ami = Ami()
    ami.connect()
    busy = set()
    while True:
        free = MAX_PARALLEL - len(busy)
        if free > 0:
            try:
                tasks = api("POST", "/api/v1/callcenter/agent/pull", {"limit": free, "version": VERSION, "sims": [{"slot": s, "ok": True} for s in SIMS]}).get("tasks", [])
            except urllib.error.URLError as e:
                log("المنصة غير متاحة:", e)
                tasks = []
            for t in tasks:
                if t["kind"] != "CALL":
                    continue  # الرسائل عبر الشرائح: لاحقًا (القناة الافتراضية هي مزوّد الرسائل)
                busy.add(t["id"])
                th = threading.Thread(target=lambda t=t: (worker(ami, t), busy.discard(t["id"])), daemon=True)
                th.start()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
