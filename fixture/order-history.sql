SELECT id, placed_at, total_cents
FROM orders
WHERE customer_id = 417
ORDER BY placed_at DESC, id DESC
LIMIT 20
