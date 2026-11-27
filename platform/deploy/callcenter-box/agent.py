#!/usr/bin/env python3
"""
وكيل الصندوق المحلي لمركز الاتصال (مدرسة) — مسودة المرحلة 0، تُختبر مع الجهاز قبل أي تشغيل حقيقي.

يعمل على الحاسوب الصغير في بوسعادة بجانب Asterisk وبوابة Yeastar TG400L:
  1. يسحب المكالمات من المنصة: POST /api/v1/callcenter/agent/pull (اتصال صادر HTTPS فقط، لا منفذ مفتوح).
  2. يطلب من Asterisk (AMI) الاتصال عبر الشريحة المحددة، فيشغّل الـdialplan التسجيلَ ويقرأ الزر.
  3. يعيد النتيجة: POST /api/v1/callcenter/agent/report.

بلا مكتبات خارجية (Python 3.9+). الإعداد من /etc/madrasa-box.env (يكتبه install.sh) أو من متغيّرات البيئة:
  MADRASA_URL, CC_TOKEN, AMI_HOST, AMI_PORT, AMI_USER, AMI_SECRET, CC_TRUNK_PATTERN, CC_SIMS, CC_GATEWAY_ENDPOINT

لا يسحب مكالمات والبوابة غير متصلة (كابل منزوع أو جهاز مطفأ)، حتى لا تُحرق محاولات الزبائن في مكالمات فاشلة.
"""
import json
import os
import queue
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import inbound  # noqa: E402  (load_env + إعادة إرسال الرسائل الواردة المعلّقة)

VERSION = "0.2"
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
GATEWAY = os.environ.get("CC_GATEWAY_ENDPOINT", "tg400l")
FLUSH_SECONDS = 300


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
        self.queries = {}  # ActionID ⇒ Queue: ردود الاستعلامات (مثل حالة البوابة)

    def connect(self):
        self.sock = socket.create_connection((AMI_HOST, AMI_PORT), timeout=10)
        self.sock.settimeout(None)
        threading.Thread(target=self.reader, daemon=True).start()
        r = self.query({"Action": "Login", "Username": AMI_USER, "Secret": AMI_SECRET, "Events": "user,call"}, single=True)
        if r[0].get("Response") != "Success":
            sys.exit("AMI: فشل الدخول — تحقق من AMI_USER/AMI_SECRET في /etc/madrasa-box.env")

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
        q = self.queries.get(ev.get("ActionID", ""))
        if q is not None:
            q.put(ev)
            return
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

    def query(self, fields, timeout=5.0, single=False):
        """يرسل أمر AMI ويجمع أحداث الردّ حتى EventList: Complete (أو الردّ الأول إن single)."""
        aid = "q" + uuid.uuid4().hex[:12]
        q = queue.Queue()
        self.queries[aid] = q
        try:
            self.send({**fields, "ActionID": aid})
            out, deadline = [], time.time() + timeout
            while True:
                ev = q.get(timeout=max(0.1, deadline - time.time()))
                out.append(ev)
                if single or ev.get("Response") == "Error" or ev.get("EventList") == "Complete":
                    return out
        finally:
            self.queries.pop(aid, None)

    def gateway_ok(self):
        """هل TG400L يردّ؟ (qualify كل 30 ثانية في pjsip.conf)"""
        try:
            evs = self.query({"Action": "PJSIPShowEndpoint", "Endpoint": GATEWAY})
        except queue.Empty:
            return False
        if any(e.get("Response") == "Error" for e in evs):
            return False
        for e in evs:
            if e.get("Event") == "EndpointDetail" and e.get("DeviceState") == "Unavailable":
                return False
            if e.get("Event") == "ContactStatusDetail" and e.get("Status") == "Unreachable":
                return False
        return any(e.get("Event") == "ContactStatusDetail" and e.get("Status") == "Reachable" for e in evs)

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
    last_flush, gw_was = 0.0, None
    while True:
        if time.time() - last_flush > FLUSH_SECONDS:
            last_flush = time.time()
            try:
                n = inbound.flush()
                if n:
                    log("أُعيد إرسال رسائل واردة معلّقة:", n)
            except Exception as e:  # noqa: BLE001
                log("تعذّر إرسال المعلّق:", e)
        gw = ami.gateway_ok()
        if gw != gw_was:
            log("البوابة TG400L", "متصلة" if gw else "غير متصلة — لا سحب للمكالمات حتى تعود")
            gw_was = gw
        free = MAX_PARALLEL - len(busy)
        if free > 0:
            try:
                # البوابة غير متصلة: لا نسحب مهام، ونكتفي بـ ping لتبقى اللوحة ترى الصندوق حيًّا
                if gw:
                    tasks = api("POST", "/api/v1/callcenter/agent/pull", {"limit": free, "version": VERSION, "sims": [{"slot": s, "ok": True} for s in SIMS]}).get("tasks", [])
                else:
                    api("GET", f"/api/v1/callcenter/agent/ping?v={VERSION}")
                    tasks = []
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
