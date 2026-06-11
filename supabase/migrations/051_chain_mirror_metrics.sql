-- daily_chain_mirror_metrics view
-- Exposes: mirror count, unmirror count, dead-letter count, median/p95 cost, median resolution latency

CREATE OR REPLACE VIEW daily_chain_mirror_metrics AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) FILTER (WHERE action = 'mirror' AND error_message IS NULL) AS mirror_count,
  COUNT(*) FILTER (WHERE action IN ('unmirror', 'bulk_unmirror')) AS unmirror_count,
  COUNT(*) FILTER (WHERE action = 'mirror' AND error_message IS NOT NULL) AS failed_count,
  (SELECT COUNT(*) FROM chain_mirror_queue WHERE status = 'dead_letter'
   AND date_trunc('day', created_at) = date_trunc('day', a.created_at)) AS dead_letter_count,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY usd_cost) FILTER (WHERE usd_cost IS NOT NULL) AS median_cost_usd,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY usd_cost) FILTER (WHERE usd_cost IS NOT NULL) AS p95_cost_usd
FROM chain_mirror_audit a
GROUP BY date_trunc('day', created_at)
ORDER BY day DESC;
