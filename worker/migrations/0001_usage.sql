CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT PRIMARY KEY,
  completed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS usage_clients (
  day TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  PRIMARY KEY (day, client_hash)
);

CREATE INDEX IF NOT EXISTS usage_clients_hash_day ON usage_clients (client_hash, day);
