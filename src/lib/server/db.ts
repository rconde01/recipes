import { createClient } from '@libsql/client';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

function getDb() {
	if (building) {
		return null as unknown as ReturnType<typeof createClient>;
	}
	return createClient({
		url: env.TURSO_DATABASE_URL ?? 'file:recipes.db',
		authToken: env.TURSO_AUTH_TOKEN
	});
}

const db = getDb();

export async function initDb() {
	if (building) return;
	const newColumns = [
		{ name: 'source_url', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'prep_time', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'cook_time', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'total_time', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'yield', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'category', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'cuisine', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'image_url', def: "TEXT NOT NULL DEFAULT ''" }
	];

	await db.batch([
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			username TEXT UNIQUE NOT NULL,
			password_hash TEXT NOT NULL,
			salt TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS recipes (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			title TEXT NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			ingredients TEXT NOT NULL DEFAULT '[]',
			instructions TEXT NOT NULL DEFAULT '[]',
			source_url TEXT NOT NULL DEFAULT '',
			prep_time TEXT NOT NULL DEFAULT '',
			cook_time TEXT NOT NULL DEFAULT '',
			total_time TEXT NOT NULL DEFAULT '',
			yield TEXT NOT NULL DEFAULT '',
			category TEXT NOT NULL DEFAULT '',
			cuisine TEXT NOT NULL DEFAULT '',
			image_url TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`
	]);

	// Migrate: add new columns to existing recipes table
	for (const col of newColumns) {
		try {
			await db.execute(`ALTER TABLE recipes ADD COLUMN ${col.name} ${col.def}`);
		} catch {
			// Column already exists, ignore
		}
	}
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

export async function createUser(email: string, username: string, password: string): Promise<User> {
	const id = crypto.randomUUID();
	const salt = crypto.randomBytes(16).toString('hex');
	const password_hash = hashPassword(password, salt);

	await db.execute({
		sql: 'INSERT INTO users (id, email, username, password_hash, salt) VALUES (?, ?, ?, ?, ?)',
		args: [id, email, username, password_hash, salt]
	});

	return { id, email, username, password_hash, salt, created_at: new Date().toISOString() };
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
	const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
	return result.rows[0] as unknown as User | undefined;
}

export async function getUserById(id: string): Promise<User | undefined> {
	const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
	return result.rows[0] as unknown as User | undefined;
}

export function verifyPassword(user: User, password: string): boolean {
	const hash = hashPassword(password, user.salt);
	return hash === user.password_hash;
}

export async function createSession(userId: string): Promise<Session> {
	const id = crypto.randomUUID();
	const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db.execute({
		sql: 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
		args: [id, userId, expires_at]
	});

	return { id, user_id: userId, expires_at, created_at: new Date().toISOString() };
}

export async function getSession(sessionId: string): Promise<(Session & { email: string; username: string }) | undefined> {
	const result = await db.execute({
		sql: `SELECT sessions.*, users.email, users.username
			FROM sessions
			JOIN users ON users.id = sessions.user_id
			WHERE sessions.id = ? AND sessions.expires_at > datetime('now')`,
		args: [sessionId]
	});
	return result.rows[0] as unknown as (Session & { email: string; username: string }) | undefined;
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [sessionId] });
}

// Recipes

export interface Recipe {
	id: string;
	user_id: string;
	title: string;
	description: string;
	ingredients: string; // JSON array
	instructions: string; // JSON array
	source_url: string;
	prep_time: string;
	cook_time: string;
	total_time: string;
	yield: string;
	category: string;
	cuisine: string;
	image_url: string;
	created_at: string;
	updated_at: string;
}

export async function getRecipesByUser(userId: string): Promise<Recipe[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM recipes WHERE user_id = ? ORDER BY updated_at DESC',
		args: [userId]
	});
	return result.rows as unknown as Recipe[];
}

export async function getRecipeById(id: string, userId: string): Promise<Recipe | undefined> {
	const result = await db.execute({
		sql: 'SELECT * FROM recipes WHERE id = ? AND user_id = ?',
		args: [id, userId]
	});
	return result.rows[0] as unknown as Recipe | undefined;
}

export interface RecipeExtras {
	source_url?: string;
	prep_time?: string;
	cook_time?: string;
	total_time?: string;
	yield?: string;
	category?: string;
	cuisine?: string;
	image_url?: string;
}

export async function createRecipe(
	userId: string,
	title: string,
	description: string,
	ingredients: string[],
	instructions: string[],
	extras: RecipeExtras = {}
): Promise<Recipe> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db.execute({
		sql: `INSERT INTO recipes (id, user_id, title, description, ingredients, instructions,
			source_url, prep_time, cook_time, total_time, yield, category, cuisine, image_url,
			created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			id, userId, title, description,
			JSON.stringify(ingredients), JSON.stringify(instructions),
			extras.source_url ?? '', extras.prep_time ?? '', extras.cook_time ?? '',
			extras.total_time ?? '', extras.yield ?? '', extras.category ?? '',
			extras.cuisine ?? '', extras.image_url ?? '',
			now, now
		]
	});

	return {
		id, user_id: userId, title, description,
		ingredients: JSON.stringify(ingredients),
		instructions: JSON.stringify(instructions),
		source_url: extras.source_url ?? '',
		prep_time: extras.prep_time ?? '',
		cook_time: extras.cook_time ?? '',
		total_time: extras.total_time ?? '',
		yield: extras.yield ?? '',
		category: extras.category ?? '',
		cuisine: extras.cuisine ?? '',
		image_url: extras.image_url ?? '',
		created_at: now, updated_at: now
	};
}

export async function updateRecipe(
	id: string,
	userId: string,
	title: string,
	description: string,
	ingredients: string[],
	instructions: string[],
	extras: RecipeExtras = {}
): Promise<boolean> {
	const result = await db.execute({
		sql: `UPDATE recipes SET title = ?, description = ?, ingredients = ?, instructions = ?,
			source_url = ?, prep_time = ?, cook_time = ?, total_time = ?,
			yield = ?, category = ?, cuisine = ?, image_url = ?,
			updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
		args: [
			title, description, JSON.stringify(ingredients), JSON.stringify(instructions),
			extras.source_url ?? '', extras.prep_time ?? '', extras.cook_time ?? '',
			extras.total_time ?? '', extras.yield ?? '', extras.category ?? '',
			extras.cuisine ?? '', extras.image_url ?? '',
			id, userId
		]
	});
	return result.rowsAffected > 0;
}

export async function deleteRecipe(id: string, userId: string): Promise<boolean> {
	const result = await db.execute({
		sql: 'DELETE FROM recipes WHERE id = ? AND user_id = ?',
		args: [id, userId]
	});
	return result.rowsAffected > 0;
}
