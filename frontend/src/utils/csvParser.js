// Utility to parse CSV into array of numerical objects for Recharts
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') return [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',');
    const row = {};
    headers.forEach((h, idx) => {
      const val = values[idx] !== undefined ? values[idx].trim() : '';
      const num = parseFloat(val);
      row[h] = isNaN(num) || val === '' ? val : num;
    });

    // Chart-friendly aliases for Recharts components
    if (row.time_sec !== undefined && row.time === undefined) {
      row.time = row.time_sec;
    }
    if (row.packets_in_queue !== undefined && row.queue_pkts === undefined) {
      row.queue_pkts = row.packets_in_queue;
    }
    if (row.drop_count !== undefined && row.drops === undefined) {
      row.drops = row.drop_count;
    }
    if (row.throughput_mbps !== undefined && row.throughput === undefined) {
      row.throughput = row.throughput_mbps;
    }

    rows.push(row);
  }
  return rows;
}

export function parseSummaryCSV(summaryText) {
  if (!summaryText) return {};
  const rows = parseCSV(summaryText);
  const obj = {};
  rows.forEach(r => {
    if (r.metric !== undefined) {
      obj[r.metric] = r.value;
    }
  });

  // Bidirectional aliases for smooth compatibility across dashboard views
  if (obj.avg_loaded_rtt_ms && !obj.loaded_mean_rtt_ms) obj.loaded_mean_rtt_ms = obj.avg_loaded_rtt_ms;
  if (obj.loaded_mean_rtt_ms && !obj.avg_loaded_rtt_ms) obj.avg_loaded_rtt_ms = obj.loaded_mean_rtt_ms;

  if (obj.rtt_increase_ratio && !obj.bloat_ratio) obj.bloat_ratio = obj.rtt_increase_ratio;
  if (obj.bloat_ratio && !obj.rtt_increase_ratio) obj.rtt_increase_ratio = obj.bloat_ratio;

  if (obj.avg_throughput_mbps && !obj.mean_throughput_mbps) obj.mean_throughput_mbps = obj.avg_throughput_mbps;
  if (obj.mean_throughput_mbps && !obj.avg_throughput_mbps) obj.avg_throughput_mbps = obj.mean_throughput_mbps;

  if (obj.packets_dropped !== undefined && obj.total_drops === undefined) obj.total_drops = obj.packets_dropped;
  if (obj.total_drops !== undefined && obj.packets_dropped === undefined) obj.packets_dropped = obj.total_drops;

  if (obj.bufferbloat_grade && !obj.grade) obj.grade = obj.bufferbloat_grade;
  if (obj.grade && !obj.bufferbloat_grade) obj.bufferbloat_grade = obj.grade;

  if (obj.queue_capacity_packets && !obj.queue_size_pkts) obj.queue_size_pkts = obj.queue_capacity_packets;
  if (obj.queue_size_pkts && !obj.queue_capacity_packets) obj.queue_capacity_packets = obj.queue_size_pkts;

  return obj;
}
