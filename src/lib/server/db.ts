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
		{ name: 'image_url', def: "TEXT NOT NULL DEFAULT ''" },
		{ name: 'recipe_type', def: "TEXT NOT NULL DEFAULT ''" }
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
		)`,
		`CREATE TABLE IF NOT EXISTS known_ingredients (
			id TEXT PRIMARY KEY,
			canonical_name TEXT UNIQUE NOT NULL,
			category TEXT NOT NULL DEFAULT '',
			density_g_per_cup REAL,
			calories_per_gram REAL,
			preferred_unit TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS user_ingredient_overrides (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			known_ingredient_id TEXT NOT NULL REFERENCES known_ingredients(id) ON DELETE CASCADE,
			brand TEXT NOT NULL DEFAULT '',
			density_g_per_cup REAL,
			calories_per_gram REAL,
			notes TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			UNIQUE(user_id, known_ingredient_id)
		)`,
		`CREATE TABLE IF NOT EXISTS recipe_ingredients (
			id TEXT PRIMARY KEY,
			recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
			position INTEGER NOT NULL DEFAULT 0,
			raw_text TEXT NOT NULL,
			quantity REAL,
			unit TEXT NOT NULL DEFAULT '',
			name TEXT NOT NULL DEFAULT '',
			known_ingredient_id TEXT REFERENCES known_ingredients(id) ON DELETE SET NULL,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)`,
		`CREATE TABLE IF NOT EXISTS recipe_steps (
			id TEXT PRIMARY KEY,
			recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
			position INTEGER NOT NULL DEFAULT 0,
			raw_text TEXT NOT NULL,
			duration_minutes REAL NOT NULL DEFAULT 0,
			is_passive INTEGER NOT NULL DEFAULT 0,
			equipment TEXT NOT NULL DEFAULT '[]',
			ingredients TEXT NOT NULL DEFAULT '[]',
			techniques TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
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

	// Migrate: add calories_per_gram to known_ingredients and user_ingredient_overrides
	for (const table of ['known_ingredients', 'user_ingredient_overrides']) {
		try {
			await db.execute(`ALTER TABLE ${table} ADD COLUMN calories_per_gram REAL`);
		} catch {
			// Column already exists, ignore
		}
	}

	// Migrate: add preferred_unit to known_ingredients
	try {
		await db.execute(`ALTER TABLE known_ingredients ADD COLUMN preferred_unit TEXT NOT NULL DEFAULT ''`);
	} catch {
		// Column already exists, ignore
	}

	await seedKnownIngredients();
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
	recipe_type: string;
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
	recipe_type?: string;
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
			source_url, prep_time, cook_time, total_time, yield, category, cuisine, image_url, recipe_type,
			created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		args: [
			id, userId, title, description,
			JSON.stringify(ingredients), JSON.stringify(instructions),
			extras.source_url ?? '', extras.prep_time ?? '', extras.cook_time ?? '',
			extras.total_time ?? '', extras.yield ?? '', extras.category ?? '',
			extras.cuisine ?? '', extras.image_url ?? '', extras.recipe_type ?? '',
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
		recipe_type: extras.recipe_type ?? '',
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
			yield = ?, category = ?, cuisine = ?, image_url = ?, recipe_type = ?,
			updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
		args: [
			title, description, JSON.stringify(ingredients), JSON.stringify(instructions),
			extras.source_url ?? '', extras.prep_time ?? '', extras.cook_time ?? '',
			extras.total_time ?? '', extras.yield ?? '', extras.category ?? '',
			extras.cuisine ?? '', extras.image_url ?? '', extras.recipe_type ?? '',
			id, userId
		]
	});
	return result.rowsAffected > 0;
}

export async function updateRecipeType(id: string, userId: string, recipeType: string): Promise<void> {
	await db.execute({
		sql: 'UPDATE recipes SET recipe_type = ? WHERE id = ? AND user_id = ?',
		args: [recipeType, id, userId]
	});
}

export async function deleteRecipe(id: string, userId: string): Promise<boolean> {
	const result = await db.execute({
		sql: 'DELETE FROM recipes WHERE id = ? AND user_id = ?',
		args: [id, userId]
	});
	return result.rowsAffected > 0;
}

// Known Ingredients

export interface KnownIngredient {
	id: string;
	canonical_name: string;
	category: string;
	density_g_per_cup: number | null;
	calories_per_gram: number | null;
	preferred_unit: string;
	created_at: string;
}

export interface UserIngredientOverride {
	id: string;
	user_id: string;
	known_ingredient_id: string;
	brand: string;
	density_g_per_cup: number | null;
	calories_per_gram: number | null;
	notes: string;
	created_at: string;
}

export interface RecipeIngredient {
	id: string;
	recipe_id: string;
	position: number;
	raw_text: string;
	quantity: number | null;
	unit: string;
	name: string;
	known_ingredient_id: string | null;
	created_at: string;
}

export async function getAllKnownIngredients(): Promise<KnownIngredient[]> {
	const result = await db.execute('SELECT * FROM known_ingredients ORDER BY canonical_name');
	return result.rows as unknown as KnownIngredient[];
}

export async function getKnownIngredientByName(name: string): Promise<KnownIngredient | undefined> {
	const result = await db.execute({
		sql: 'SELECT * FROM known_ingredients WHERE canonical_name = ?',
		args: [name.toLowerCase()]
	});
	return result.rows[0] as unknown as KnownIngredient | undefined;
}

export async function findKnownIngredientByName(name: string): Promise<KnownIngredient | undefined> {
	// Exact match first
	const exact = await getKnownIngredientByName(name);
	if (exact) return exact;

	// Substring match: ingredient name contains or is contained by a known name
	const normalized = name.toLowerCase();
	const result = await db.execute({
		sql: `SELECT * FROM known_ingredients
			WHERE ? LIKE '%' || canonical_name || '%'
			   OR canonical_name LIKE '%' || ? || '%'
			ORDER BY LENGTH(canonical_name) DESC LIMIT 1`,
		args: [normalized, normalized]
	});
	return result.rows[0] as unknown as KnownIngredient | undefined;
}

export async function createKnownIngredient(
	canonicalName: string,
	category: string,
	densityGPerCup: number | null,
	caloriesPerGram: number | null = null,
	preferredUnit: string = ''
): Promise<KnownIngredient> {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	await db.execute({
		sql: 'INSERT OR IGNORE INTO known_ingredients (id, canonical_name, category, density_g_per_cup, calories_per_gram, preferred_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
		args: [id, canonicalName.toLowerCase(), category, densityGPerCup, caloriesPerGram, preferredUnit, now]
	});
	return { id, canonical_name: canonicalName.toLowerCase(), category, density_g_per_cup: densityGPerCup, calories_per_gram: caloriesPerGram, preferred_unit: preferredUnit, created_at: now };
}

export async function updateKnownIngredient(
	id: string,
	canonicalName: string,
	category: string,
	densityGPerCup: number | null,
	caloriesPerGram: number | null,
	preferredUnit: string = ''
): Promise<void> {
	await db.execute({
		sql: 'UPDATE known_ingredients SET canonical_name = ?, category = ?, density_g_per_cup = ?, calories_per_gram = ?, preferred_unit = ? WHERE id = ?',
		args: [canonicalName.toLowerCase(), category, densityGPerCup, caloriesPerGram, preferredUnit, id]
	});
}

export async function deleteKnownIngredient(id: string): Promise<void> {
	await db.execute({
		sql: 'DELETE FROM known_ingredients WHERE id = ?',
		args: [id]
	});
}

export async function getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY position',
		args: [recipeId]
	});
	return result.rows as unknown as RecipeIngredient[];
}

export async function setRecipeIngredients(
	recipeId: string,
	items: { raw_text: string; quantity: number | null; unit: string; name: string; known_ingredient_id: string | null }[]
): Promise<void> {
	await db.execute({ sql: 'DELETE FROM recipe_ingredients WHERE recipe_id = ?', args: [recipeId] });
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		await db.execute({
			sql: 'INSERT INTO recipe_ingredients (id, recipe_id, position, raw_text, quantity, unit, name, known_ingredient_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			args: [crypto.randomUUID(), recipeId, i, item.raw_text, item.quantity, item.unit, item.name, item.known_ingredient_id]
		});
	}
}

export async function getUserIngredientOverride(
	userId: string,
	knownIngredientId: string
): Promise<UserIngredientOverride | undefined> {
	const result = await db.execute({
		sql: 'SELECT * FROM user_ingredient_overrides WHERE user_id = ? AND known_ingredient_id = ?',
		args: [userId, knownIngredientId]
	});
	return result.rows[0] as unknown as UserIngredientOverride | undefined;
}

export async function setUserIngredientOverride(
	userId: string,
	knownIngredientId: string,
	brand: string,
	densityGPerCup: number | null,
	caloriesPerGram: number | null,
	notes: string
): Promise<void> {
	const id = crypto.randomUUID();
	await db.execute({
		sql: `INSERT INTO user_ingredient_overrides (id, user_id, known_ingredient_id, brand, density_g_per_cup, calories_per_gram, notes)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, known_ingredient_id) DO UPDATE SET brand = ?, density_g_per_cup = ?, calories_per_gram = ?, notes = ?`,
		args: [id, userId, knownIngredientId, brand, densityGPerCup, caloriesPerGram, notes, brand, densityGPerCup, caloriesPerGram, notes]
	});
}

// Seed default known ingredients
export async function seedKnownIngredients(): Promise<void> {
	const defaults: { name: string; category: string; density: number; cal: number | null; pref: string }[] = [
		{ name: 'all-purpose flour', category: 'flour', density: 125, cal: 3.64, pref: 'g' },
		{ name: 'bread flour', category: 'flour', density: 127, cal: 3.61, pref: 'g' },
		{ name: 'cake flour', category: 'flour', density: 114, cal: 3.62, pref: 'g' },
		{ name: 'whole wheat flour', category: 'flour', density: 128, cal: 3.40, pref: 'g' },
		{ name: 'granulated sugar', category: 'sweetener', density: 200, cal: 3.87, pref: 'g' },
		{ name: 'brown sugar', category: 'sweetener', density: 220, cal: 3.80, pref: 'g' },
		{ name: 'powdered sugar', category: 'sweetener', density: 120, cal: 3.89, pref: 'g' },
		{ name: 'butter', category: 'dairy', density: 227, cal: 7.17, pref: 'g' },
		{ name: 'milk', category: 'dairy', density: 244, cal: 0.61, pref: 'cup' },
		{ name: 'heavy cream', category: 'dairy', density: 238, cal: 3.40, pref: 'cup' },
		{ name: 'sour cream', category: 'dairy', density: 230, cal: 1.98, pref: 'cup' },
		{ name: 'cream cheese', category: 'dairy', density: 232, cal: 3.42, pref: 'g' },
		{ name: 'vegetable oil', category: 'oil', density: 218, cal: 8.84, pref: 'cup' },
		{ name: 'olive oil', category: 'oil', density: 216, cal: 8.84, pref: 'cup' },
		{ name: 'honey', category: 'sweetener', density: 340, cal: 3.04, pref: 'cup' },
		{ name: 'maple syrup', category: 'sweetener', density: 312, cal: 2.60, pref: 'cup' },
		{ name: 'cocoa powder', category: 'baking', density: 86, cal: 2.28, pref: 'g' },
		{ name: 'cornstarch', category: 'baking', density: 128, cal: 3.81, pref: 'g' },
		{ name: 'baking powder', category: 'baking', density: 230, cal: 0.53, pref: 'tsp' },
		{ name: 'baking soda', category: 'baking', density: 220, cal: 0, pref: 'tsp' },
		{ name: 'salt', category: 'seasoning', density: 288, cal: 0, pref: 'tsp' },
		{ name: 'rolled oats', category: 'grain', density: 90, cal: 3.79, pref: 'g' },
		{ name: 'rice', category: 'grain', density: 185, cal: 3.65, pref: 'g' },
		{ name: 'peanut butter', category: 'nut', density: 258, cal: 5.88, pref: 'g' },
		{ name: 'almond flour', category: 'flour', density: 96, cal: 5.71, pref: 'g' },
		{ name: 'coconut flour', category: 'flour', density: 112, cal: 4.00, pref: 'g' },
		{ name: 'water', category: 'liquid', density: 237, cal: 0, pref: 'cup' },
	];

	for (const d of defaults) {
		await db.execute({
			sql: 'INSERT OR IGNORE INTO known_ingredients (id, canonical_name, category, density_g_per_cup, calories_per_gram, preferred_unit) VALUES (?, ?, ?, ?, ?, ?)',
			args: [crypto.randomUUID(), d.name, d.category, d.density, d.cal, d.pref]
		});
	}
}

// Recipe Steps

export interface RecipeStep {
	id: string;
	recipe_id: string;
	position: number;
	raw_text: string;
	duration_minutes: number;
	is_passive: number; // 0 = active, 1 = passive
	equipment: string; // JSON array
	ingredients: string; // JSON array
	techniques: string; // JSON array
	created_at: string;
}

export async function getRecipeSteps(recipeId: string): Promise<RecipeStep[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY position',
		args: [recipeId]
	});
	return result.rows as unknown as RecipeStep[];
}

export async function setRecipeSteps(
	recipeId: string,
	steps: {
		raw_text: string;
		duration_minutes: number;
		is_passive: boolean;
		equipment: string[];
		ingredients: string[];
		techniques: string[];
	}[]
): Promise<void> {
	await db.execute({ sql: 'DELETE FROM recipe_steps WHERE recipe_id = ?', args: [recipeId] });
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i];
		await db.execute({
			sql: `INSERT INTO recipe_steps (id, recipe_id, position, raw_text, duration_minutes, is_passive, equipment, ingredients, techniques)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			args: [
				crypto.randomUUID(), recipeId, i, step.raw_text,
				step.duration_minutes, step.is_passive ? 1 : 0,
				JSON.stringify(step.equipment), JSON.stringify(step.ingredients), JSON.stringify(step.techniques)
			]
		});
	}
}
