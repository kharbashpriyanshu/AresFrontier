# NASA SPACE APPS — FINAL 5-MINUTE JUDGE DEMO SCRIPT

## Exact Timing & Presentation Flow

### [00:00 – 00:30] Problem: Operational Uncertainty on Mars
- **UI View**: Open [`http://localhost:5173`](http://localhost:5173) (Landing Page / Global Mars Map).
- **Spoken Narration**:
  > *"When human crews and robotic rovers explore Mars, they don't operate with perfect knowledge. They operate under extreme uncertainty—delayed communications, steep terrain scarps, finite battery reserves, and irreversible decisions. Traditional tools plan a route and hope for the best. Martian Map is a mission digital twin that observes reality, quantifies uncertainty, assesses hazards, synthesizes alternatives, and respects human authority."*

---

### [00:30 – 01:15] MARSWALK-001: Observation, Hazard & Safety Invariants
- **UI Action**: Click **DEMO: MARSWALK-001** or navigate to [`/demo`](http://localhost:5173/demo) and click **▶ MARSWALK-001**.
- **Spoken Narration**:
  > *"Here is our flagship traverse across Jezero Crater. Our autonomous scout rover ROVER-01 is surveying the delta front. At minute 15, forward stereo HazCams observe a 21.8° scarp slope ahead. The rover's rollover threshold is 20°. Notice that the system doesn't rely on a single noisy camera; it corroborates the observation against laser altimetry differentials. Rollover risk is confirmed, triggering Safety Invariant S2. The rover autonomously halts to preserve vehicle safety."*

---

### [01:15 – 02:00] Copilot Synthesis & Human Authorization
- **UI View**: Direct attention to the structured 5-point report on `/demo` or open [`/operations`](http://localhost:5173/operations).
- **Spoken Narration**:
  > *"Rather than making a blind decision, the Copilot synthesizes three Pareto route alternatives. It presents the quantitative trade-off to Flight Director Alex Vance: Candidate A adds 300 meters and 6 minutes, but avoids the scarp. But crucially, the Copilot cannot authorize the detour on its own. The flight director must sign the command with MISSION_COMMAND authority. Once authorized, the detour waypoints upload to the rover, and an immutable SHA-256 block is locked to our audit ledger."*

---

### [02:00 – 02:45] What-If Comparative Analysis: The Cost of Ignoring Hazards
- **UI Action**: Inspect the **DECISION COMPARISON** card or click **Explore Full What-If Matrix** to open [`/replay`](http://localhost:5173/replay).
- **Spoken Narration**:
  > *"Why did the flight director approve the detour? In Martian Map, we don't have to guess. Our What-If simulation engine branches off at the exact moment of the hazard and simulates the alternative: What if we forced the rover over the steep slope to save distance? Look at the side-by-side delta: forcing the direct path saved 1.5 km and 6 minutes, but dropped our safety score from 92 down to 51, with an 80% scree trenching penalty that would have stranded a \$2.5 billion rover. The digital twin proves the value of the human decision."*

---

### [02:45 – 03:30] Keplerian Orbital Pass & Communication Blackout
- **UI Action**: Back on `/demo`, click **▶ COMM-BLACKOUT-001**.
- **Spoken Narration**:
  > *"Mars communication is intermittent. Our Mars Reconnaissance Orbiter (MRO) pass terminates below the 15° horizon mask, cutting direct X-band bandwidth to 0 kbps for a 92-minute blackout. Notice our tactical queue: critical alerts take priority while bulk science spectral cubes are safely buffered in flash storage. Simultaneously, surface rovers failover to local UHF mesh relays via ROVER-03 on an elevated knoll, ensuring zero telemetry loss during the crew's traverse."*

---

### [03:30 – 04:15] Mission Replay & Cryptographic Audit Integrity
- **UI Action**: Open [`/replay`](http://localhost:5173/replay). Scrub the timeline backward and forward; click **VERIFY CHAIN** on `/demo`.
- **Spoken Narration**:
  > *"Because every observation, command, and authorization is deterministically recorded in our cryptographic event ledger, any mission can be replayed step-by-step. Notice that scrubbing backward doesn't just play an animation—it reconstructs the exact multi-agent digital twin state at that second. And on the server, every block is chained with SHA-256 digests. If any command or timestamp is tampered with, the system immediately flags the corrupted block."*

---

### [04:15 – 05:00] Differentiation & Scientific Truthfulness
- **UI Action**: Open [`/methodology`](http://localhost:5173/methodology). Point to the 5-tier classification grid.
- **Spoken Narration**:
  > *"Finally, we hold ourselves to rigorous scientific honesty. You will never see fake 'LIVE TELEMETRY FROM MARS' in our application. We explicitly classify our data into five tiers: real NASA benchmark datasets, physical calculations, simulated sensor and orbital models, flight rule heuristics, and demonstration scenarios. Martian Map doesn't replace mission control. It gives mission control better evidence for deciding what to do next under uncertainty."*
