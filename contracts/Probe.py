# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import hashlib
import re
import urllib.parse
import ipaddress
from genlayer import *


class Probe(gl.Contract):
    results: TreeMap[str, str]

    def __init__(self):
        # Do not assign TreeMap() in __init__
        pass

    @gl.public.view
    def get_result(self, key: str) -> str:
        if key in self.results:
            return self.results[key]
        return ""

    @gl.public.view
    def get_sender(self) -> str:
        return gl.message.sender_address.as_hex

    @gl.public.view
    def probe_bool(self) -> bool:
        return True

    @gl.public.view
    def probe_str(self) -> str:
        return "studionet_probe_ok"

    @gl.public.view
    def probe_list(self) -> list[str]:
        return ["alpha", "beta", "gamma"]

    @gl.public.write
    def probe_imports_and_sender(self) -> None:
        sender = gl.message.sender_address.as_hex
        # Verify stdlib functions work
        h = hashlib.sha256(b"probe").hexdigest()
        parsed = urllib.parse.urlsplit("https://github.com/huzyow155/ship-escrow-fixtures/pull/2")
        ip = str(ipaddress.ip_address("127.0.0.1"))
        reg = re.sub(r"[^a-z]", "-", "abc-123")
        payload = json.dumps({
            "sender": sender,
            "hash": h,
            "host": parsed.netloc,
            "ip": ip,
            "regex": reg,
        })
        self.results["imports_and_sender"] = payload

    @gl.public.write
    def probe_web_fetch(self, url: str, test_key: str) -> None:
        def fetch_run() -> str:
            res = gl.nondet.web.get(url)
            status_code = int(res.status)
            body_bytes = res.body if isinstance(res.body, (bytes, bytearray)) else str(res.body).encode("utf-8")
            body_sha256 = hashlib.sha256(body_bytes).hexdigest()
            body_text = body_bytes.decode("utf-8", errors="replace")
            return json.dumps({
                "status": status_code,
                "length": len(body_bytes),
                "sha256": body_sha256,
                "prefix": body_text[:200],
            })

        decision = gl.eq_principle.strict_eq(fetch_run)
        self.results[test_key] = decision

    @gl.public.write
    def probe_diff_stability(self, pr_url_diff: str) -> None:
        def fetch_twice() -> str:
            res1 = gl.nondet.web.get(pr_url_diff)
            body1 = res1.body if isinstance(res1.body, (bytes, bytearray)) else str(res1.body).encode("utf-8")
            sha1 = hashlib.sha256(body1).hexdigest()

            res2 = gl.nondet.web.get(pr_url_diff)
            body2 = res2.body if isinstance(res2.body, (bytes, bytearray)) else str(res2.body).encode("utf-8")
            sha2 = hashlib.sha256(body2).hexdigest()

            is_stable = (sha1 == sha2)
            return json.dumps({
                "status1": int(res1.status),
                "status2": int(res2.status),
                "sha1": sha1,
                "sha2": sha2,
                "stable": is_stable,
                "length": len(body1),
            })

        decision = gl.eq_principle.strict_eq(fetch_twice)
        self.results["diff_stability"] = decision

    @gl.public.write
    def probe_exec_prompt(self, diff_text_size: int) -> None:
        sample_diff = ("+ line of diff code added\n" * 200)[:diff_text_size]

        def run_llm() -> str:
            prompt = (
                "You are an automated evaluator. Return ONLY valid JSON: {\"results\": [\"YES\", \"YES\"]}\n"
                "Diff excerpt:\n" + sample_diff
            )
            raw = gl.nondet.exec_prompt(prompt)
            clean = raw.replace("```json", "").replace("```", "").strip()
            return clean

        decision = gl.eq_principle.strict_eq(run_llm)
        self.results[f"prompt_{diff_text_size}"] = decision
