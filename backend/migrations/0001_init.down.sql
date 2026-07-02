-- Rollback of 0001_init. Drop in reverse dependency order.

BEGIN;

DROP TABLE IF EXISTS memories;
DROP TABLE IF EXISTS furniture;
DROP TABLE IF EXISTS houses;
DROP TABLE IF EXISTS gifts;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS items;
DROP TABLE IF EXISTS player_states;
DROP TABLE IF EXISTS world_players;
DROP TABLE IF EXISTS worlds;
DROP TABLE IF EXISTS users;

COMMIT;
