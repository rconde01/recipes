import { fail, redirect } from '@sveltejs/kit';
import { createUser, getUserByEmail, createSession } from '$lib/server/db';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) {
		redirect(303, '/recipes');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';
		const username = formData.get('username')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const confirmPassword = formData.get('confirmPassword')?.toString() ?? '';

		if (!email || !username || !password) {
			return fail(400, { error: 'All fields are required.', email, username });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', email, username });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.', email, username });
		}

		if (username.length < 3 || username.length > 30) {
			return fail(400, { error: 'Username must be between 3 and 30 characters.', email, username });
		}

		const existing = getUserByEmail(email);
		if (existing) {
			return fail(400, { error: 'An account with this email already exists.', email, username });
		}

		try {
			const user = createUser(email, username, password);
			const session = createSession(user.id);

			cookies.set('session_id', session.id, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 30 * 24 * 60 * 60
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : 'Registration failed.';
			if (message.includes('UNIQUE constraint failed: users.username')) {
				return fail(400, { error: 'This username is already taken.', email, username });
			}
			return fail(500, { error: 'Registration failed. Please try again.', email, username });
		}

		redirect(303, '/recipes');
	}
};
