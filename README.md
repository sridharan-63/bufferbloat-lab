# BufferBloat Detection and Queue Management Optimization Using NS-3

A comprehensive, production-grade network simulation system and interactive dashboard designed to demonstrate, measure, and optimize **BufferBloat** in congested packet networks using **NS-3 (Network Simulator 3)**.

---

## 1. System Architecture

The project consists of three cleanly separated layers:

```
┌──────────────────────────────────────────────────────────────────┐
│                   Web Presentation Dashboard                     │
│       (HTML5, Vanilla CSS3 / Tailwind Dark Theme, React 19)      │
│  - 9 Structured Views: Overview, Topology, Config, Run,          │
│    Analytics, Queue Mgmt, Compare, Results/Reports, Settings     │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP / JSON REST APIs
┌─────────────────────────────────▼────────────────────────────────┐
│               Native C Socket Controller Daemon                  │
│                (POSIX TCP Sockets, fork / exec)                  │
│  - Static Web Server (MIME detection, CORS, Non-blocking)        │
│  - REST Endpoints (/api/status, /api/simulate, /api/results)     │
│  - Strict Parameter Validation & Process Concurrency Guard       │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ CLI Arguments & CSV/XML Traces
┌─────────────────────────────────▼────────────────────────────────┐
│                   NS-3 Simulation Engine (C++)                   │
│         (NS-3.46, C++20, TrafficControlHelper, FlowMonitor)      │
│  - Configurable Dumbbell Topology (N Clients, Bottleneck Link)   │
│  - Multi-flow TCP Cubic Congestion Stress Traffic                │
│  - High-Precision Latency Probe (50ms interval UDP Echo)         │
│  - Optional Competing CBR UDP Flow                               │
│  - QueueDiscs: DropTail (FIFO), CoDel, FQ-CoDel, RED, PIE        │
│  - Comprehensive Packet Tracing & FlowMonitor XML/CSV Metrics    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Features

- **Genuine NS-3.46 Simulation:** Fully implemented in modern C++20 using the official NS-3 Traffic Control, PointToPoint, and FlowMonitor architecture.
- **Strict Architecture Boundaries:**
  - Simulation Engine: **C++20** (`simulation/bufferbloat.cc`)
  - Controller & Socket Server: **C** (`controller/socket_server.c`, `controller/main.c`)
  - Frontend: React 19 + Recharts + Tailwind dark theme (`frontend/`)
- **Configurable Network Parameters:**
  - Router Queue Discipline: `DropTail`, `CoDel`, `FqCoDel`, `RED`, `PIE`
  - Router Buffer Capacity: 1 to 10,000 packets
  - Bottleneck Bandwidth: 0.1 to 1,000 Mbps
  - Bottleneck Propagation Delay: 0.1 to 5,000 ms
  - Client Count: 1 to 50 concurrent client nodes
  - Traffic Loads: Low (1 sender), Medium (2 senders), High (all clients saturated), Competing UDP
  - Simulation Duration & Deterministic RNG Seed for repeatable research
- **Automated BufferBloat Detection & Grading:**
  - Measures baseline unloaded RTT (0–2s window) vs loaded congested RTT.
  - Grades network performance from **A+** (no bloat, extra latency < 10 ms) to **F** (> 300 ms extra latency), adhering to DSLReports and Waveform standards.
- **Full Packet Tracing & Flow Statistics:**
  - Distinct separation of discrete packet-level events (Tx, Rx, Enqueue, Dequeue, Drop) and aggregated per-flow FlowMonitor metrics.

---

## 3. Directory Structure

```
bufferbloat/
├── Makefile                   # Top-level build script for simulation and C server
├── README.md                  # Comprehensive documentation and execution guide
├── config/
│   └── default_config.json    # Research presets (DropTail Bloat, CoDel, FQ-CoDel)
├── controller/
│   ├── main.c                 # C Socket server entry point & argument parsing
│   ├── socket_server.c        # POSIX HTTP/JSON server, fork/exec runner, input validator
│   └── socket_server.h        # Server state definitions & prototypes
├── simulation/
│   ├── bufferbloat.cc         # Complete NS-3 simulation in C++20 with tracing
│   └── CMakeLists.txt         # CMake build configuration for NS-3 simulation
├── frontend/
│   ├── index.html             # Multi-view network engineering dashboard
│   ├── package.json           # Frontend build scripts and dependencies
│   ├── vite.config.js         # Vite configuration
│   ├── dist/                  # Production-ready web assets served by C daemon
│   └── src/                   # React components, pages, and chart visualizers
├── results/                   # Structured CSV and XML traces per experiment run
└── tests/
    └── test_simulation.sh     # Automated verification test suite
```

---

## 4. Prerequisites & Installation

### Linux / WSL (Ubuntu 24.04 or 26.04)

Install the required build tools and NS-3 packages:

```bash
sudo apt-get update
sudo apt-get install -y ns3 libns3-dev cmake pkg-config build-essential curl
```

Verify that NS-3 headers and libraries are present:

```bash
pkg-config --modversion ns3-core   # Output should be 3.46 or similar
g++ --version                      # GCC 11+ supporting -std=c++20
```

---

## 5. Building the Project

Use the top-level `Makefile` to compile both the NS-3 simulation binary and the C socket server:

```bash
make all
```

Or build individual components:

```bash
# Build C++ NS-3 Simulation with FlowMonitor & Traffic Control
make simulation/bufferbloat

# Build C Socket Controller Server
make controller/server
```

To build or rebuild the frontend production bundle:

```bash
# From Windows PowerShell or Linux terminal with Node 20+:
cd frontend
npm install
npm run build
```

---

## 6. Running the Automated Verification Tests

Execute the comprehensive automated test suite to run DropTail, CoDel, RED, FQ-CoDel, and competing UDP flows, verifying all 8 trace files, metrics, and controller REST APIs:

```bash
make test
# OR directly:
bash tests/test_simulation.sh
```

### Sample Automated Verification Output:
```
==========================================================
 Running Automated BufferBloat & NS-3 Verification Tests 
==========================================================
[+] 1. Testing DropTail Queue Simulation (5s)... [OK] All 8 DropTail traces and FlowMonitor metrics verified.
[+] 2. Testing CoDel AQM Simulation (5s)...      [OK] CoDel traces generated.
[+] 3. Testing RED AQM Simulation (5s)...        [OK] RED traces generated.
[+] 4. Testing FQ-CoDel Simulation (5s)...       [OK] FQ-CoDel traces generated.
[+] 5. Testing Competing UDP Cross-Traffic (5s)...[OK] Competing UDP cross-traffic traces generated.
[+] 6. Comparing Key Metrics Across Queue Disciplines:
-------------------------------------------------------------------------------------------------
Queue Type   | Avg RTT (ms) | Q-Delay (ms) | T-put (Mbps)   | Bloat      | Grade     
-------------------------------------------------------------------------------------------------
droptail     | 121.36       | 74.32        | 2.17           | YES        | B         
codel        | 114.42       | 53.54        | 1.94           | YES        | B         
red          | 120.82       | 74.94        | 2.14           | YES        | B         
fqcodel      | 76.19        | 35.26        | 2.15           | NO         | A+        
-------------------------------------------------------------------------------------------------
[+] 7. Verifying C Controller Executable & REST Endpoints...
[OK] GET /api/status verified.
[OK] GET /api/results verified.
[OK] GET /api/data verified.
[OK] Parameter validation safely rejects invalid queueType with HTTP 400.
[+] All Verification Tests Passed Successfully!
```

---

## 7. Running the Web Application

Start the C controller server daemon:

```bash
make run-server
# OR specify custom port and directories:
./controller/server --port=8088 --web-root=frontend/dist --results-dir=results --sim-bin=simulation/bufferbloat
```

Open your browser and navigate to:
```
http://localhost:8088
```
*(On Windows with WSL2, port 8088 automatically forwards to Windows localhost).*

---

## 8. Command-Line Simulation Usage

You can execute the NS-3 simulation binary directly from the terminal:

```bash
./simulation/bufferbloat \
  --queueType=DropTail \
  --queueSize=100 \
  --bottleneckBw=5.0 \
  --bottleneckDelay=35.0 \
  --accessBw=100.0 \
  --accessDelay=2.0 \
  --nClients=3 \
  --trafficLoad=high \
  --enableUdp=0 \
  --simDuration=15.0 \
  --rngRun=1 \
  --outputDir=results/my_experiment
```

### Supported Simulation Arguments:

| Parameter | Default | Range / Allowed Values | Description |
|:---|:---:|:---:|:---|
| `--queueType` | `DropTail` | `DropTail`, `CoDel`, `RED`, `FqCoDel`, `PIE` | Active queue management discipline |
| `--queueSize` | `100` | $1 \le N \le 10000$ | Router bottleneck queue capacity in packets |
| `--bottleneckBw` | `5.0` | $0.1 \le BW \le 1000.0$ Mbps | Bottleneck link transmission rate |
| `--bottleneckDelay` | `35.0` | $0.0 \le D \le 5000.0$ ms | One-way bottleneck link propagation delay |
| `--accessBw` | `100.0` | $0.1 \le BW \le 10000.0$ Mbps | Access link bandwidth per client node |
| `--accessDelay` | `2.0` | $0.0 \le D \le 1000.0$ ms | Access link propagation delay per client node |
| `--nClients` | `3` | $1 \le C \le 50$ | Number of client sender nodes |
| `--trafficLoad` | `high` | `low`, `medium`, `high`, `udp_competing` | Active traffic pattern |
| `--enableUdp` | `0` | `0` or `1` | Enable competing constant-bit-rate UDP cross flow |
| `--udpRate` | `1.5Mbps` | Data rate string (e.g., `1.5Mbps`) | Competing UDP flow transmission bandwidth |
| `--tcpProtocol` | `Cubic` | `Cubic`, `NewReno`, `Bbr` | TCP congestion control algorithm |
| `--packetSize` | `1024` | $64 \le S \le 65535$ bytes | TCP MSS payload segment size |
| `--simDuration` | `15.0` | $0.5 \le T \le 300.0$ s | Total simulation time |
| `--rngRun` | `1` | $1 \le R \le 1000000$ | NS-3 seed run index for repeatable experiments |
| `--outputDir` | `results/run_latest` | Safe path | Target folder for CSV and XML results |

---

## 9. Packet Tracing & Generated Files

Every experiment run produces 8 structured artifacts inside its destination folder (`results/<exp_name>/`):

### 1. `summary.csv`
Key performance indicators, network parameters, and BufferBloat evaluation verdict.
- **Fields:** `metric,value,unit`
- **Key Metrics:**
  - `baseline_rtt_ms`: Unloaded base RTT measured before congestion ($t < 2.0\text{s}$)
  - `avg_loaded_rtt_ms`: Average RTT measured during active TCP saturation ($t \ge 2.0\text{s}$)
  - `peak_rtt_ms`: Worst-case observed round-trip latency
  - `rtt_increase_ratio`: Ratio of loaded RTT to baseline RTT
  - `avg_queue_occupancy_pkts`: Mean packet depth residing in router queue disc
  - `max_queue_occupancy_pkts`: Peak buffer fullness observed
  - `avg_queueing_delay_ms`: Mean packet sojourn time in router queue disc
  - `max_queueing_delay_ms`: Peak sojourn latency before packet dequeue
  - `avg_throughput_mbps`: Average bottleneck utilization rate
  - `bottleneck_utilization_percent`: Percentage of link capacity effectively used
  - `packet_loss_percent`: Ratio of dropped packets to total packets sent
  - `bufferbloat_detected`: `YES` if bloat detected; otherwise `NO`
  - `bufferbloat_grade`: Rating from `A+` down to `F`

### 2. `rtt_trace.csv`
Discrete measurement of every UDP Echo probe ping sample.
- **Columns:** `time_sec,rtt_ms,probe_seq,packet_uid`
- **Units:** seconds, milliseconds, integer sequence, NS-3 packet UID

### 3. `queue_trace.csv`
Periodic 50ms time-series tracking router queue buffer occupancy and instantaneous sojourn delay.
- **Columns:** `time_sec,packets_in_queue,bytes_in_queue,queue_delay_ms`
- **Units:** seconds, packets, bytes, milliseconds

### 4. `throughput_trace.csv`
Windowed throughput samples measured over consecutive 200 ms intervals at the server receiver sink.
- **Columns:** `time_sec,throughput_mbps,bytes_in_window`
- **Units:** seconds, Mbps, bytes

### 5. `drop_trace.csv`
Event-driven log of every packet dropped by the router queue disc.
- **Columns:** `time_sec,drop_count,packet_uid,packet_size_bytes,reason`
- **Units:** seconds, cumulative drops, packet UID, bytes, reason string (`QueueOverflow`, `AQMDrop`)

### 6. `packet_trace.csv` (Packet-Level Event Trace)
High-precision log recording discrete packet lifecycle events:
- **Columns:** `time_sec,event,packet_uid,packet_size_bytes,queue_depth_pkts,details`
- **Event Types:**
  - `PROBE_TX`: Probe client generates and transmits a ping packet
  - `PROBE_RX`: Probe client receives ping response with computed RTT
  - `ENQUEUE`: Packet arrives at router and enters the QueueDisc
  - `DEQUEUE`: Packet departs QueueDisc for transmission on bottleneck link
  - `DROP`: Packet dropped at router due to buffer saturation or AQM policy
  - `MAC_TX`: Router NetDevice transmits frame onto point-to-point channel
  - `MAC_RX`: Server NetDevice receives frame from point-to-point channel

### 7. `flow_stats.csv` (FlowMonitor Aggregated Flow Statistics)
Aggregated per-flow end-to-end transport metrics extracted from NS-3 FlowMonitor:
- **Columns:** `flow_id,src_ip,src_port,dst_ip,dst_port,protocol,tx_packets,rx_packets,lost_packets,loss_ratio_percent,tx_bytes,rx_bytes,throughput_mbps,mean_delay_ms,mean_jitter_ms`
- **Units:** integer flow ID, IPv4, ports, protocol (`TCP`/`UDP`), counts, percentages, bytes, Mbps, milliseconds

### 8. `flow_monitor.xml`
Complete raw XML serialization from the NS-3 FlowMonitor module.

---

## 10. Metric Formulas & Methodology

All metrics are calculated directly from simulation event traces without synthetic or fabricated data:

1. **Baseline Round-Trip Time ($RTT_{\text{base}}$):**
   $$\text{Baseline RTT} = \frac{1}{N_{\text{base}}} \sum_{i \in \text{unloaded}} RTT_i$$
   Measured exclusively during the unloaded window ($0.1\text{s} \le t < 2.0\text{s}$) prior to TCP bulk senders starting. If no samples are collected, the theoretical base $2 \times (D_{\text{access}} + D_{\text{bottleneck}})$ is used.

2. **Loaded Mean Round-Trip Time ($RTT_{\text{loaded}}$):**
   $$\text{Loaded RTT} = \frac{1}{N_{\text{loaded}}} \sum_{i \in \text{loaded}} RTT_i$$
   Measured during active congestion ($t \ge 2.0\text{s}$).

3. **BufferBloat Latency Inflation Ratio:**
   $$\text{Bloat Ratio} = \frac{RTT_{\text{loaded}}}{RTT_{\text{base}}}$$

4. **Queue Sojourn Delay ($D_{\text{queue}}$):**
   Recorded via the NS-3 `QueueDisc::SojournTime` trace callback for each dequeued packet:
   $$\overline{D}_{\text{queue}} = \frac{1}{M} \sum_{j=1}^M \text{Sojourn}_j$$

5. **Moving-Window Bottleneck Throughput ($T$):**
   $$T(\Delta t) = \frac{\Delta \text{RxBytes} \times 8}{\Delta t \times 10^6} \quad [\text{Mbps}]$$
   Sampled over non-overlapping $\Delta t = 0.2\text{s}$ windows.

6. **Bottleneck Link Utilization ($U$):**
   $$U = \min\left(100.0, \frac{\overline{T}}{\text{Bottleneck Bandwidth}} \times 100\%\right)$$

7. **Packet Loss Ratio ($L$):**
   $$L = \begin{cases} \frac{\text{Packets Dropped}}{\text{Total Packets Sent}} \times 100\% & \text{if Total Packets Sent} > 0 \\ 0.0\% & \text{otherwise} \end{cases}$$

8. **BufferBloat Detection Criteria:**
   BufferBloat is flagged as `YES` if:
   $$(\text{Bloat Ratio} \ge 1.5 \text{ and } \overline{D}_{\text{queue}} \ge 35\text{ ms}) \quad \lor \quad (\text{Peak RTT} > RTT_{\text{base}} + 100\text{ ms})$$

9. **BufferBloat Grading Scale (Waveform / DSLReports Standard):**
   Calculated from the additional delay under load $\Delta RTT = \max(0.0, RTT_{\text{loaded}} - RTT_{\text{base}})$:
   - **Grade A+**: $\Delta RTT < 10\text{ ms}$ (No bloat, pristine interactive latency)
   - **Grade A**: $10\text{ ms} \le \Delta RTT < 30\text{ ms}$ (Minimal bloat)
   - **Grade B**: $30\text{ ms} \le \Delta RTT < 70\text{ ms}$ (Noticeable queueing delay)
   - **Grade C**: $70\text{ ms} \le \Delta RTT < 150\text{ ms}$ (Moderate bufferbloat)
   - **Grade D**: $150\text{ ms} \le \Delta RTT < 300\text{ ms}$ (High latency inflation)
   - **Grade F**: $\Delta RTT \ge 300\text{ ms}$ (Severe bufferbloat, unusable for real-time traffic)

---

## 11. REST API Reference

The C socket controller provides HTTP REST endpoints:

### `GET /api/status`
Returns daemon execution state and active simulation status.
```json
{
  "status": "ok",
  "is_running": false,
  "current_exp": "test_suite/droptail",
  "elapsed_sec": 0,
  "last_exit_code": 0,
  "status_message": "Ready",
  "ns3_version": "3.46",
  "supported_queues": ["DropTail", "CoDel", "RED", "FqCoDel", "PIE"]
}
```

### `POST /api/simulate`
Starts a new simulation with validated parameters. Rejects invalid requests with HTTP 400 and prevents simultaneous runs with HTTP 409.
- **Request Body (JSON):**
  ```json
  {
    "queueType": "CoDel",
    "queueSize": 100,
    "bottleneckBw": 5.0,
    "bottleneckDelay": 35.0,
    "nClients": 3,
    "trafficLoad": "high",
    "simDuration": 15.0,
    "expName": "codel_trial_1"
  }
  ```
- **Responses:**
  - `200 OK`: `{"status":"started","exp_name":"codel_trial_1","pid":1234,"queueType":"CoDel"}`
  - `400 Bad Request`: `{"error":"Invalid queueType 'XYZ'. Supported: DropTail, CoDel, RED, FqCoDel, PIE"}`
  - `409 Conflict`: `{"error":"Simulation is currently running. Please wait for it to complete."}`
  - `500 Internal Server Error`: `{"error":"Simulation executable not found..."}`

### `GET /api/results`
Returns array of all completed experiment runs found in `results/`:
```json
[
  {
    "id": "droptail",
    "queue_type": "DropTail",
    "queue_capacity": 100,
    "bottleneck_bw": 5.0,
    "baseline_rtt_ms": 74.32,
    "avg_loaded_rtt_ms": 121.36,
    "avg_queueing_delay_ms": 74.32,
    "avg_throughput_mbps": 2.17,
    "packet_loss_percent": 1.36,
    "bufferbloat_detected": "YES",
    "grade": "B"
  }
]
```

### `GET /api/data?exp=<id>&file=<filename>`
Fetches trace file content for a specific experiment (e.g. `summary.csv`, `rtt_trace.csv`, `flow_stats.csv`, `packet_trace.csv`).
- Protected against path traversal (`..` and slashes are rejected with HTTP 400).
- Restricts extensions to `.csv`, `.xml`, `.json`, `.txt`, `.log`.

---

## 12. Troubleshooting & FAQ

1. **Port 8088 Already in Use:**
   If another process is bound to port 8088:
   ```bash
   # Find and terminate the process holding port 8088
   lsof -i :8088
   # Or launch on an alternate port:
   ./controller/server --port=8090
   ```

2. **Simulation Fails Immediately with Exit Code 127:**
   Ensure the simulation binary is compiled:
   ```bash
   make simulation/bufferbloat
   ```

3. **Bash Script Line-Ending Errors (`$'\r': command not found`):**
   If files were edited on Windows with CRLF:
   ```bash
   sed -i 's/\r$//' tests/test_simulation.sh
   ```

4. **Missing NS-3 Libraries on Compile:**
   Verify `pkg-config --modversion ns3-core`. If packages are missing:
   ```bash
   sudo apt-get install -y ns3 libns3-dev
   ```

---

## 13. License & Academic Attribution
Developed as an advanced Computer Networks project for investigating queueing delay accumulation, active queue management (AQM), and bufferbloat mitigation strategies.
