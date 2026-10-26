#!/bin/bash
set -e

echo "=========================================================="
echo " Running Automated BufferBloat & NS-3 Verification Tests "
echo "=========================================================="

SIM_BIN="./simulation/bufferbloat"
CTRL_BIN="./controller/server"
RESULTS_DIR="./results/test_suite"

mkdir -p "$RESULTS_DIR"

if [ ! -f "$SIM_BIN" ]; then
    echo "[-] Error: Simulation binary not found at $SIM_BIN"
    exit 1
fi

echo "[+] 1. Testing DropTail Queue Simulation (5s)..."
$SIM_BIN --queueType=DropTail --queueSize=100 --simDuration=5 --outputDir="$RESULTS_DIR/droptail"

# Verify all required trace files are produced
REQUIRED_FILES=(
    "summary.csv"
    "rtt_trace.csv"
    "queue_trace.csv"
    "throughput_trace.csv"
    "drop_trace.csv"
    "packet_trace.csv"
    "flow_stats.csv"
    "flow_monitor.xml"
)

for f in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$RESULTS_DIR/droptail/$f" ]; then
        echo "[-] Error: Missing trace file: $RESULTS_DIR/droptail/$f"
        exit 1
    fi
done
echo "[OK] All 8 DropTail traces and FlowMonitor metrics verified."

echo "[+] 2. Testing CoDel AQM Simulation (5s)..."
$SIM_BIN --queueType=CoDel --queueSize=100 --simDuration=5 --outputDir="$RESULTS_DIR/codel"
if [ ! -f "$RESULTS_DIR/codel/summary.csv" ] || [ ! -f "$RESULTS_DIR/codel/packet_trace.csv" ]; then
    echo "[-] Error: CoDel results not generated properly"
    exit 1
fi
echo "[OK] CoDel traces generated."

echo "[+] 3. Testing RED AQM Simulation (5s)..."
$SIM_BIN --queueType=RED --queueSize=100 --simDuration=5 --outputDir="$RESULTS_DIR/red"
if [ ! -f "$RESULTS_DIR/red/summary.csv" ] || [ ! -f "$RESULTS_DIR/red/flow_stats.csv" ]; then
    echo "[-] Error: RED results not generated properly"
    exit 1
fi
echo "[OK] RED traces generated."

echo "[+] 4. Testing FQ-CoDel Simulation (5s)..."
$SIM_BIN --queueType=FqCoDel --queueSize=100 --simDuration=5 --outputDir="$RESULTS_DIR/fqcodel"
if [ ! -f "$RESULTS_DIR/fqcodel/summary.csv" ] || [ ! -f "$RESULTS_DIR/fqcodel/packet_trace.csv" ]; then
    echo "[-] Error: FQ-CoDel results not generated properly"
    exit 1
fi
echo "[OK] FQ-CoDel traces generated."

echo "[+] 5. Testing Competing UDP Cross-Traffic Simulation (5s)..."
$SIM_BIN --queueType=DropTail --queueSize=100 --enableUdp=1 --simDuration=5 --outputDir="$RESULTS_DIR/competing_udp"
if [ ! -f "$RESULTS_DIR/competing_udp/summary.csv" ]; then
    echo "[-] Error: Competing UDP results not generated properly"
    exit 1
fi
echo "[OK] Competing UDP cross-traffic traces generated."

echo "[+] 6. Comparing Key Metrics Across Queue Disciplines:"
echo "-------------------------------------------------------------------------------------------------"
printf "%-12s | %-12s | %-12s | %-14s | %-10s | %-10s\n" "Queue Type" "Avg RTT (ms)" "Q-Delay (ms)" "T-put (Mbps)" "Bloat" "Grade"
echo "-------------------------------------------------------------------------------------------------"
for q in droptail codel red fqcodel; do
    AVG_RTT=$(grep "^avg_loaded_rtt_ms," "$RESULTS_DIR/$q/summary.csv" | head -n1 | cut -d',' -f2)
    Q_DELAY=$(grep "^avg_queueing_delay_ms," "$RESULTS_DIR/$q/summary.csv" | head -n1 | cut -d',' -f2)
    TPUT=$(grep "^avg_throughput_mbps," "$RESULTS_DIR/$q/summary.csv" | head -n1 | cut -d',' -f2)
    BLOAT=$(grep "^bufferbloat_detected," "$RESULTS_DIR/$q/summary.csv" | head -n1 | cut -d',' -f2)
    GRADE=$(grep "^grade," "$RESULTS_DIR/$q/summary.csv" | head -n1 | cut -d',' -f2)
    printf "%-12s | %-12s | %-12s | %-14s | %-10s | %-10s\n" "$q" "$AVG_RTT" "$Q_DELAY" "$TPUT" "$BLOAT" "$GRADE"
done
echo "-------------------------------------------------------------------------------------------------"

echo "[+] 7. Verifying C Controller Executable & REST Endpoints..."
if [ ! -f "$CTRL_BIN" ]; then
    echo "[-] Error: Controller binary not found at $CTRL_BIN"
    exit 1
fi

# Start controller on test port 8099 in background
TEST_PORT=8099
./$CTRL_BIN --port=$TEST_PORT --web-root=frontend/dist --results-dir=results --sim-bin=$SIM_BIN > /tmp/test_ctrl.log 2>&1 &
CTRL_PID=$!
sleep 1

cleanup() {
    kill -TERM $CTRL_PID 2>/dev/null || true
    wait $CTRL_PID 2>/dev/null || true
}
trap cleanup EXIT

# Test GET /api/status
STATUS_RESP=$(curl -s "http://127.0.0.1:$TEST_PORT/api/status")
if [[ "$STATUS_RESP" != *"\"status\":\"ok\""* ]]; then
    echo "[-] Error: /api/status failed: $STATUS_RESP"
    exit 1
fi
echo "[OK] GET /api/status verified."

# Test GET /api/results
RESULTS_RESP=$(curl -s "http://127.0.0.1:$TEST_PORT/api/results")
if [[ "$RESULTS_RESP" != *"["* ]]; then
    echo "[-] Error: /api/results failed: $RESULTS_RESP"
    exit 1
fi
echo "[OK] GET /api/results verified."

# Test GET /api/data
DATA_RESP=$(curl -s "http://127.0.0.1:$TEST_PORT/api/data?exp=test_suite/droptail&file=summary.csv")
if [[ "$DATA_RESP" != *"queue_type"* ]]; then
    echo "[-] Error: /api/data failed: $DATA_RESP"
    exit 1
fi
echo "[OK] GET /api/data verified."

# Test validation: POST /api/simulate with invalid queueType (should return 400)
INVALID_HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:$TEST_PORT/api/simulate" -H "Content-Type: application/json" -d '{"queueType":"InvalidQueueType123"}')
if [ "$INVALID_HTTP_CODE" -ne 400 ]; then
    echo "[-] Error: Expected 400 Bad Request for invalid queueType, got $INVALID_HTTP_CODE"
    exit 1
fi
echo "[OK] Parameter validation safely rejects invalid queueType with HTTP 400."

cleanup
trap - EXIT

echo "[+] All Verification Tests Passed Successfully!"
