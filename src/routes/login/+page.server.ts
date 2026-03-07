import { fail, redirect } from '@sveltejs/kit';
import { getUserByEmail, verifyPassword, createSession } from '$lib/server/db';
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
		const password = formData.get('password')?.toString() ?? '';

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const user = await getUserByEmail(email);
		if (!user || !verifyPassword(user, password)) {
			return fail(400, { error: 'Invalid email or password.', email });
		}

		const session = await createSession(user.id);

		cookies.set('session_id', session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: 30 * 24 * 60 * 60
		});

		redirect(303, '/recipes');
	}
};
