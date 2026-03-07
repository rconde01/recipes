import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/db';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ cookies }) => {
		const sessionId = cookies.get('session_id');
		if (sessionId) {
			await deleteSession(sessionId);
			cookies.delete('session_id', { path: '/' });
		}
		redirect(303, '/');
	}
};
