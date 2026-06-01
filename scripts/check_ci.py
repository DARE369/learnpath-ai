import urllib.request
import json

url = "https://api.github.com/repos/DARE369/learnpath-ai/actions/runs?per_page=1"
headers = {"Accept": "application/vnd.github+json", "User-Agent": "learnpath-debug"}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=10) as r:
    data = json.loads(r.read())
    run = data["workflow_runs"][0]
    print(f"Run: {run['display_title']}")
    print(f"Status: {run['status']} | Conclusion: {run['conclusion']}")

    req2 = urllib.request.Request(run["jobs_url"], headers=headers)
    with urllib.request.urlopen(req2, timeout=10) as r2:
        jobs = json.loads(r2.read())
        for job in jobs["jobs"]:
            print(f"\n  Job: {job['name']} -> {job['conclusion']}")
            for step in job["steps"]:
                status = step["conclusion"] or step["status"]
                marker = "FAIL" if step["conclusion"] == "failure" else "  ok"
                print(f"    [{marker}] {step['name']}")
