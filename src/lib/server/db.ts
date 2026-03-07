import Database from 'better-sqlite3';
import { building } from '$app/environment';
import crypto from 'node:crypto';

const DB_PATH = 'recipes.db';

function createDatabase() {
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');

	db.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			salt TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`);

	return db;
}

let db: Database.Database;

function getDb(): Database.Database {
	if (building) {
		return null as unknown as Database.Database;
	}
	if (!db) {
		db = createDatabase();
	}
	return db;
}

function hashPassword(password: string, salt: string): string {
	return crypto.scryptSync(password, salt, 64).toString('hex');
}

export interface User {
	id: string;
	email: string;
	username: string;
	password_hash: string;
	salt: string;
	created_at: string;
}

export interface Session {
	id: string;
	user_id: string;
	expires_at: string;
	created_at: string;
}

export function createUser(email: string, username: string, password: string): User {
	const db = getDb();
	const id = crypto.randomUUID();
	const salt = crypto.randomBytes(16).toString('hex');
	const password_hash = hashPassword(password, salt);

	const stmt = db.prepare(
		'INSERT INTO users (id, email, username, password_hash, salt) VALUES (?, ?, ?, ?, ?)'
	);
	stmt.run(id, email, username, password_hash, salt);

	return { id, email, username, password_hash, salt, created_at: new Date().toISOString() };
}

export function getUserByEmail(email: string): User | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
}

export function getUserById(id: string): User | undefined {
	const db = getDb();
	return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
}

export function verifyPassword(user: User, password: string): boolean {
	const hash = hashPassword(password, user.salt);
	return hash === user.password_hash;
}

export function createSession(userId: string): Session {
	const db = getDb();
	const id = crypto.randomUUID();
	const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

	const stmt = db.prepare(
		'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
	);
	stmt.run(id, userId, expires_at);

	return { id, user_id: userId, expires_at, created_at: new Date().toISOString() };
}

export function getSession(sessionId: string): (Session & { email: string; username: string }) | undefined {
	const db = getDb();
	return db.prepare(`
		SELECT sessions.*, users.email, users.username
		FROM sessions
		JOIN users ON users.id = sessions.user_id
		WHERE sessions.id = ? AND sessions.expires_at > datetime('now')
	`).get(sessionId) as (Session & { email: string; username: string }) | undefined;
}

export function deleteSession(sessionId: string): void {
	const db = getDb();
	db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}
