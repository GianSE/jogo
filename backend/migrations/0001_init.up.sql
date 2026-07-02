-- Casinha Virtual + Exploração — initial schema
-- Postgres 16+. UUID PKs via gen_random_uuid(); citext for case-insensitive email.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         CITEXT      NOT NULL UNIQUE,
    handle        TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_handle_len   CHECK (char_length(handle) BETWEEN 2 AND 32),
    CONSTRAINT users_email_format CHECK (position('@' IN email) > 1)
);

-- ---------------------------------------------------------------------------
-- worlds  (one shared world per pair; created by player A)
-- ---------------------------------------------------------------------------
CREATE TABLE worlds (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL DEFAULT 'Nossa Ilha',
    invite_code TEXT        NOT NULL UNIQUE,
    created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT worlds_invite_code_len CHECK (char_length(invite_code) BETWEEN 4 AND 12)
);

CREATE INDEX idx_worlds_created_by ON worlds(created_by);

-- ---------------------------------------------------------------------------
-- world_players  (membership; capped at exactly 2 via slot in {1,2})
-- ---------------------------------------------------------------------------
CREATE TABLE world_players (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id  UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    slot      SMALLINT    NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT world_players_slot_range CHECK (slot IN (1, 2)),
    CONSTRAINT world_players_unique_user UNIQUE (world_id, user_id),
    CONSTRAINT world_players_unique_slot UNIQUE (world_id, slot)
);

-- a user belongs to at most one world in the MVP (single shared world per pair)
CREATE UNIQUE INDEX uq_world_players_user ON world_players(user_id);
CREATE INDEX idx_world_players_world ON world_players(world_id);

-- ---------------------------------------------------------------------------
-- player_states  (persisted checkpoint of live position; one row per member)
-- ---------------------------------------------------------------------------
CREATE TABLE player_states (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id     UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    scene        TEXT        NOT NULL DEFAULT 'island',
    x            INTEGER     NOT NULL DEFAULT 0,
    y            INTEGER     NOT NULL DEFAULT 0,
    facing       SMALLINT    NOT NULL DEFAULT 0,   -- 0=down 1=left 2=right 3=up
    online       BOOLEAN     NOT NULL DEFAULT false,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT player_states_scene  CHECK (scene IN ('island', 'house')),
    CONSTRAINT player_states_facing CHECK (facing BETWEEN 0 AND 3),
    CONSTRAINT player_states_unique UNIQUE (world_id, user_id)
);

CREATE INDEX idx_player_states_world ON player_states(world_id);

-- ---------------------------------------------------------------------------
-- items  (shared catalog: gifts, furniture, resources). asset_key abstracts
--         storage so local static assets can later move to object storage.
-- ---------------------------------------------------------------------------
CREATE TABLE items (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       TEXT        NOT NULL UNIQUE,
    name       TEXT        NOT NULL,
    category   TEXT        NOT NULL,
    asset_key  TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT items_category CHECK (category IN ('gift', 'furniture', 'resource'))
);

-- ---------------------------------------------------------------------------
-- inventory  (per user, per world holdings)
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id   UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    item_id    UUID        NOT NULL REFERENCES items(id)  ON DELETE RESTRICT,
    quantity   INTEGER     NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT inventory_qty_nonneg CHECK (quantity >= 0),
    CONSTRAINT inventory_unique UNIQUE (world_id, user_id, item_id)
);

CREATE INDEX idx_inventory_world_user ON inventory(world_id, user_id);

-- ---------------------------------------------------------------------------
-- messages  (chat). bigserial seq gives cheap chronological ordering.
-- ---------------------------------------------------------------------------
CREATE TABLE messages (
    id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    world_id   UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    sender_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT messages_body_len CHECK (char_length(body) BETWEEN 1 AND 500)
);

CREATE INDEX idx_messages_world_created ON messages(world_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- gifts  (items dropped in the world for the partner to pick up)
-- ---------------------------------------------------------------------------
CREATE TABLE gifts (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id      UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    item_id       UUID        NOT NULL REFERENCES items(id)  ON DELETE RESTRICT,
    from_user_id  UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    to_user_id    UUID            NULL REFERENCES users(id)  ON DELETE SET NULL,
    scene         TEXT        NOT NULL DEFAULT 'island',
    x             INTEGER     NOT NULL,
    y             INTEGER     NOT NULL,
    message       TEXT            NULL,
    picked_up     BOOLEAN     NOT NULL DEFAULT false,
    picked_up_by  UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    picked_up_at  TIMESTAMPTZ     NULL,
    CONSTRAINT gifts_scene       CHECK (scene IN ('island', 'house')),
    CONSTRAINT gifts_message_len CHECK (message IS NULL OR char_length(message) <= 280),
    CONSTRAINT gifts_pickup_consistency CHECK (
        (picked_up = false AND picked_up_by IS NULL AND picked_up_at IS NULL)
        OR
        (picked_up = true  AND picked_up_by IS NOT NULL AND picked_up_at IS NOT NULL)
    )
);

-- fast lookup of gifts still lying in the world
CREATE INDEX idx_gifts_world_active ON gifts(world_id) WHERE picked_up = false;

-- ---------------------------------------------------------------------------
-- houses  (exactly one per world)
-- ---------------------------------------------------------------------------
CREATE TABLE houses (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id   UUID        NOT NULL UNIQUE REFERENCES worlds(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- furniture  (placed inside a house; persistent shared layout)
-- ---------------------------------------------------------------------------
CREATE TABLE furniture (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    house_id   UUID        NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
    item_id    UUID        NOT NULL REFERENCES items(id)  ON DELETE RESTRICT,
    x          INTEGER     NOT NULL,
    y          INTEGER     NOT NULL,
    rotation   SMALLINT    NOT NULL DEFAULT 0,
    z_index    INTEGER     NOT NULL DEFAULT 0,
    placed_by  UUID            NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT furniture_rotation CHECK (rotation IN (0, 90, 180, 270))
);

CREATE INDEX idx_furniture_house ON furniture(house_id);

-- ---------------------------------------------------------------------------
-- memories  (auto-generated milestones; "first_*" kinds unique per world)
-- ---------------------------------------------------------------------------
CREATE TABLE memories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    world_id    UUID        NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
    kind        TEXT        NOT NULL,
    description TEXT        NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_memories_world_occurred ON memories(world_id, occurred_at DESC);

-- each milestone "first_*" can happen only once per world; repeatable kinds
-- (kind NOT LIKE 'first_%') are exempt from the uniqueness guarantee.
CREATE UNIQUE INDEX uq_memories_first_kind
    ON memories(world_id, kind)
    WHERE kind LIKE 'first_%';

COMMIT;
