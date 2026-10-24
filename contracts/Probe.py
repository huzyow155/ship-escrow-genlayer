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

    # =========================================================================
    # V2 PROBES: GitHub API, compare-by-sha diff, timestamp
    # =========================================================================

    @gl.public.write
    def probe_github_api(self, owner: str, repo: str, pr_number: str, run_key: str) -> None:
        """Probe (a): fetch PR metadata from GitHub API (unauthenticated)."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"

        def fetch_api() -> str:
            res = gl.nondet.web.get(api_url)
            status_code = int(res.status)
            body_bytes = res.body if isinstance(res.body, (bytes, bytearray)) else str(res.body).encode("utf-8")
            body_text = body_bytes.decode("utf-8", errors="replace")

            result = {
                "status": status_code,
                "url": api_url,
            }

            if status_code == 200:
                try:
                    data = json.loads(body_text)
                    result["head_sha"] = data.get("head", {}).get("sha", "")
                    result["base_sha"] = data.get("base", {}).get("sha", "")
                    result["state"] = data.get("state", "")
                    result["user_login"] = data.get("user", {}).get("login", "")
                    result["commits"] = data.get("commits", 0)
                    result["body_len"] = len(data.get("body", "") or "")
                    result["draft"] = data.get("draft", False)
                    result["merged"] = data.get("merged", False)
                    result["head_repo_full_name"] = data.get("head", {}).get("repo", {}).get("full_name", "")
                    result["base_repo_full_name"] = data.get("base", {}).get("repo", {}).get("full_name", "")
                except Exception as e:
                    result["parse_error"] = str(e)
            else:
                # Check for rate limit headers in body
                result["body_prefix"] = body_text[:500]

            return json.dumps(result)

        decision = gl.eq_principle.strict_eq(fetch_api)
        self.results[run_key] = decision

    @gl.public.write
    def probe_github_api_batch(self, owner: str, repo: str, pr_number: str) -> None:
        """Probe (a): fetch the same PR metadata 10 times in a row."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"

        def fetch_batch() -> str:
            results = []
            for i in range(10):
                res = gl.nondet.web.get(api_url)
                status_code = int(res.status)
                body_bytes = res.body if isinstance(res.body, (bytes, bytearray)) else str(res.body).encode("utf-8")
                body_text = body_bytes.decode("utf-8", errors="replace")
                entry = {"run": i, "status": status_code}
                if status_code == 200:
                    try:
                        data = json.loads(body_text)
                        entry["head_sha"] = data.get("head", {}).get("sha", "")
                        entry["state"] = data.get("state", "")
                    except Exception as e:
                        entry["parse_error"] = str(e)
                else:
                    entry["body_prefix"] = body_text[:300]
                results.append(entry)
            return json.dumps(results)

        decision = gl.eq_principle.strict_eq(fetch_batch)
        self.results["api_batch_10"] = decision

    @gl.public.write
    def probe_compare_sha_diff(self, owner: str, repo: str, base_sha: str, head_sha: str) -> None:
        """Probe (b): fetch immutable compare-by-sha diff."""
        compare_url = f"https://github.com/{owner}/{repo}/compare/{base_sha}...{head_sha}.diff"

        def fetch_compare() -> str:
            res = gl.nondet.web.get(compare_url)
            status_code = int(res.status)
            body_bytes = res.body if isinstance(res.body, (bytes, bytearray)) else str(res.body).encode("utf-8")
            body_sha = hashlib.sha256(body_bytes).hexdigest()
            body_text = body_bytes.decode("utf-8", errors="replace")
            return json.dumps({
                "status": status_code,
                "url": compare_url,
                "length": len(body_bytes),
                "sha256": body_sha,
                "prefix": body_text[:300],
            })

        decision = gl.eq_principle.strict_eq(fetch_compare)
        self.results["compare_sha_diff"] = decision

    @gl.public.write
    def probe_compare_vs_pr_diff(self, owner: str, repo: str, pr_number: str, base_sha: str, head_sha: str) -> None:
        """Probe (b): compare immutable sha diff vs PR diff, byte for byte."""
        compare_url = f"https://github.com/{owner}/{repo}/compare/{base_sha}...{head_sha}.diff"
        pr_diff_url = f"https://github.com/{owner}/{repo}/pull/{pr_number}.diff"

        def compare_both() -> str:
            res1 = gl.nondet.web.get(compare_url)
            body1 = res1.body if isinstance(res1.body, (bytes, bytearray)) else str(res1.body).encode("utf-8")

            res2 = gl.nondet.web.get(pr_diff_url)
            body2 = res2.body if isinstance(res2.body, (bytes, bytearray)) else str(res2.body).encode("utf-8")

            sha1 = hashlib.sha256(body1).hexdigest()
            sha2 = hashlib.sha256(body2).hexdigest()

            return json.dumps({
                "compare_url": compare_url,
                "pr_diff_url": pr_diff_url,
                "compare_status": int(res1.status),
                "pr_diff_status": int(res2.status),
                "compare_sha256": sha1,
                "pr_diff_sha256": sha2,
                "compare_length": len(body1),
                "pr_diff_length": len(body2),
                "byte_identical": sha1 == sha2,
            })

        decision = gl.eq_principle.strict_eq(compare_both)
        self.results["compare_vs_pr_diff"] = decision

    @gl.public.write
    def probe_timestamp(self) -> None:
        """Probe (c): check if VM exposes any deterministic timestamp."""
        results = {}

        # Try various approaches
        try:
            import time
            results["time_time"] = str(time.time())
        except Exception as e:
            results["time_time_error"] = str(e)

        try:
            import time
            results["time_monotonic"] = str(time.monotonic())
        except Exception as e:
            results["time_monotonic_error"] = str(e)

        try:
            from datetime import datetime
            results["datetime_now"] = str(datetime.now().isoformat())
        except Exception as e:
            results["datetime_now_error"] = str(e)

        try:
            from datetime import datetime, timezone
            results["datetime_utcnow"] = str(datetime.now(timezone.utc).isoformat())
        except Exception as e:
            results["datetime_utcnow_error"] = str(e)

        # Check if gl has a block or timestamp attribute
        try:
            if hasattr(gl, "block"):
                results["gl_block"] = str(gl.block)
            else:
                results["gl_block"] = "no gl.block attribute"
        except Exception as e:
            results["gl_block_error"] = str(e)

        try:
            if hasattr(gl, "transaction"):
                results["gl_transaction"] = str(gl.transaction)
            else:
                results["gl_transaction"] = "no gl.transaction attribute"
        except Exception as e:
            results["gl_transaction_error"] = str(e)

        try:
            if hasattr(gl.message, "timestamp"):
                results["gl_message_timestamp"] = str(gl.message.timestamp)
            else:
                results["gl_message_timestamp"] = "no gl.message.timestamp attribute"
        except Exception as e:
            results["gl_message_timestamp_error"] = str(e)

        self.results["timestamp_probe"] = json.dumps(results)

    @gl.public.write
    def probe_burst_endpoints(self, owner: str, repo: str, pr_number: str, base_sha: str, head_sha: str, count: int) -> None:
        """Burst probe: N calls to (a) API pulls, (b) compare .diff, (c) git smart-HTTP refs."""
        api_url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}"
        diff_url = f"https://github.com/{owner}/{repo}/compare/{base_sha}...{head_sha}.diff"
        git_refs_url = f"https://github.com/{owner}/{repo}.git/info/refs?service=git-upload-pack"

        def run_burst() -> str:
            api_results = []
            for i in range(count):
                try:
                    r = gl.nondet.web.get(api_url)
                    api_results.append(int(r.status))
                except Exception as e:
                    api_results.append(f"err: {str(e)[:40]}")

            diff_results = []
            for i in range(count):
                try:
                    r = gl.nondet.web.get(diff_url)
                    diff_results.append(int(r.status))
                except Exception as e:
                    diff_results.append(f"err: {str(e)[:40]}")

            git_results = []
            git_found_sha = ""
            for i in range(count):
                try:
                    r = gl.nondet.web.get(git_refs_url)
                    status = int(r.status)
                    body_b = r.body if isinstance(r.body, (bytes, bytearray)) else str(r.body).encode("utf-8")
                    body_t = body_b.decode("utf-8", errors="replace")
                    m = re.search(r"([0-9a-f]{40})\s+refs/pull/" + str(pr_number) + r"/head", body_t)
                    if m:
                        git_found_sha = m.group(1).lower()
                    git_results.append(status)
                except Exception as e:
                    git_results.append(f"err: {str(e)[:40]}")

            return json.dumps({
                "api_statuses": api_results,
                "diff_statuses": diff_results,
                "git_statuses": git_results,
                "git_found_sha": git_found_sha,
                "expected_head_sha": head_sha.lower(),
                "head_sha_authenticated": (git_found_sha == head_sha.lower()),
            })

        decision = gl.eq_principle.strict_eq(run_burst)
        self.results["burst_endpoints"] = decision

