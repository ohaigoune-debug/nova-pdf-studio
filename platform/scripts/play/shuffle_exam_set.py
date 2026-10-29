"""Deterministic option shuffling for converted exam sets (so the right answer is not always first).
Usage: python3 scripts/play/shuffle_exam_set.py <set.json>  (rewrites in place; run ONCE right after the builder writes the file — the answer keys are remapped, so a second run stays correct but reorders again)."""
import hashlib, json, random, sys

def rng_for(set_id, step_id):
    return random.Random(int(hashlib.sha256(f"{set_id}:{step_id}".encode()).hexdigest()[:12], 16))

def shuffle_doc(doc):
    for s in doc["steps"]:
        p, a, t = s["payload"], s["answer"], s["type"]
        r = rng_for(doc["set_id"], s["id"])
        if t in ("mcq", "portrait", "multi"):
            n = len(p["options"]); perm = list(range(n)); r.shuffle(perm)  # new[j] = old[perm[j]]
            inv = {old: j for j, old in enumerate(perm)}
            p["options"] = [p["options"][perm[j]] for j in range(n)]
            if t == "multi": a["correct"] = sorted(inv[c] for c in a["correct"])
            else: a["correct"] = inv[a["correct"]]
        elif t == "matching":
            n = len(p["rights"]); perm = list(range(n)); r.shuffle(perm)
            inv = {old: j for j, old in enumerate(perm)}
            p["rights"] = [p["rights"][perm[j]] for j in range(n)]
            a["pairs"] = [inv[x] for x in a["pairs"]]
        elif t == "fill_blank":
            r.shuffle(p["bank"])
        elif t == "ordering":
            # items stored in correct order with order=[0..n-1] → shuffle display, answer = display indices in correct sequence
            n = len(p["items"]); correct_seq = [p["items"][i] for i in a["order"]]
            perm = list(range(n)); r.shuffle(perm)
            p["items"] = [p["items"][perm[j]] for j in range(n)]
            a["order"] = [p["items"].index(x) for x in correct_seq]
    return doc

if __name__ == "__main__":
    path = sys.argv[1]
    doc = json.load(open(path, encoding="utf-8"))
    json.dump(shuffle_doc(doc), open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("shuffled", len(doc["steps"]), "steps")
