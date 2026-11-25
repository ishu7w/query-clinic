CREATE TABLE orders (
  id integer PRIMARY KEY,
  customer_id integer NOT NULL,
  placed_at timestamp NOT NULL,
  total_cents integer NOT NULL CHECK (total_cents >= 0)
);

INSERT INTO orders (id, customer_id, placed_at, total_cents)
SELECT id,
       CASE WHEN id % 5 = 0 THEN 1 ELSE id % 3991 + 2 END,
       timestamp '2025-01-01 00:00:00' + id * interval '1 minute',
       id % 9900 + 100
FROM generate_series(1, 250000) AS fixture(id);

CREATE INDEX orders_customer_history_idx
ON orders (customer_id, placed_at DESC, id DESC);
ANALYZE orders;
