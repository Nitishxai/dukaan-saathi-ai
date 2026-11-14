// Add migrations, never modify a version already applied to a pilot database.
export const migrations = [
  { version: 1, sql: `
CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL) STRICT;
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL) STRICT;
CREATE TABLE shops(id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision >= 0), data TEXT NOT NULL CHECK(json_valid(data))) STRICT;
CREATE TABLE members(shop_id TEXT NOT NULL REFERENCES shops(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','cashier')), PRIMARY KEY(shop_id,user_id)) STRICT;
CREATE TABLE operations(shop_id TEXT NOT NULL REFERENCES shops(id), operation_id TEXT NOT NULL, request_hash TEXT NOT NULL, response TEXT NOT NULL CHECK(json_valid(response)), PRIMARY KEY(shop_id,operation_id)) STRICT;
CREATE TABLE audit(id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id), actor_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, kind TEXT NOT NULL, previous_revision INTEGER NOT NULL, before_data TEXT NOT NULL CHECK(json_valid(before_data)), created_at TEXT NOT NULL) STRICT;
CREATE TABLE imports(user_id TEXT NOT NULL REFERENCES users(id), operation_id TEXT NOT NULL, request_hash TEXT NOT NULL, shop_id TEXT NOT NULL REFERENCES shops(id), PRIMARY KEY(user_id,operation_id)) STRICT;
CREATE TABLE rate_limits(bucket TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL) STRICT;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
` },
];
