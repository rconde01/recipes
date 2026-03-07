import type { Handle } from '@sveltejs/kit';
import { initDb, getSession } from '$lib/server/db';

await initDb();

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session_id');

	if (sessionId) {
		const session = await getSession(sessionId);
		if (session) {
			event.locals.user = {
				id: session.user_id,
				email: session.email,
				username: session.username
			};
		} else {
			event.cookies.delete('session_id', { path: '/' });
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	return resolve(event);
};
