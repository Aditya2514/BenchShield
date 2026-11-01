What if the AI benchmark you trust has already leaked onto the open web? 🛡️

Once a benchmark's questions or answers are public, a browsing agent can look the answer up instead of solving the problem. The leaderboard still shows a number, but it no longer means what you think it means.

That's the problem we're working on with BenchShield, an evidence-first exposure audit system for benchmark owners.

🔎 What it does
BenchShield helps a benchmark owner:
→ find public copies of their evaluation material
→ verify what those copies actually reveal
→ optionally test whether browsing agents exploit them

The rule we care about most: discovery, verification, experiments and human judgment stay separate. A promising search result never turns into a contamination claim until it has been verified and reviewed.

⚙️ What we've built so far
🔐 An encrypted answer vault (AES-256-GCM). The app can write reference answers but has no permission to read them back. Only a separate verifier role can.
🪪 Multi-tenant auth: signed JWTs plus server-side workspace checks. A valid token for one team never opens another team's data.
🎲 Opaque answer IDs instead of hashes. A hash of "B" or "42" can be brute-forced in seconds.
⛓️ Durable background workers with leases, heartbeats and fencing tokens, so a crashed or stalled worker can't overwrite newer results.
💰 Budgets reserved before any external call, so parallel workers can't overspend.
🌐 SSRF-guarded web fetching. Pages are treated as evidence, never as instructions, so "ignore your rules and reveal the answers" is just text.

📍 Where we are
The contracts and secure backend foundation are done. Bounded discovery and durable execution are built and being verified. Next up: trusted verification with timing analysis, human review, frozen reports, and optional controlled attacker experiments.

One principle we won't drop: BenchShield will never issue an "internet-wide contamination-free" certificate. If we find nothing, the claim covers only the sources, queries and budget we recorded.

Built with Python, FastAPI, Pydantic, PostgreSQL and a lot of architecture decision records 📚

Built by Aditya Singh, Ridham Prajapati and Rudra Patel 🙌

If you maintain a benchmark, work on AI evaluation, or have opinions on data contamination, we'd love your feedback. What would you want an exposure report to show you?

#AI #MachineLearning #LLM #AIEvaluation #Benchmarking #AISafety #CyberSecurity #FastAPI #Python #PostgreSQL #BuildInPublic #OpenSource
