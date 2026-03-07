/**
 * Gantt chart scheduler for cooking multiple recipes.
 *
 * Computes a timeline that respects:
 * - Number of cooks (max concurrent active steps)
 * - Equipment availability (e.g. 2 ovens, 1 stove)
 * - Step ordering within each recipe (sequential)
 * - Passive steps can overlap with active steps
 */

export interface ScheduleStep {
	id: string; // unique key: `${recipeIndex}-${stepIndex}`
	recipeIndex: number;
	recipeTitle: string;
	stepIndex: number;
	label: string;
	durationMinutes: number;
	isPassive: boolean;
	equipment: string[];
	ingredients: string[];
	techniques: string[];
	startMinute: number;
	multiplier: number;
}

export interface ScheduleConfig {
	cooks: number;
	equipment: Record<string, number>; // e.g. { oven: 2, stove: 1 }
}

export interface RecipeInput {
	title: string;
	steps: {
		raw_text: string;
		duration_minutes: number;
		is_passive: boolean;
		equipment: string[];
		ingredients: string[];
		techniques: string[];
	}[];
}

export function buildSchedule(
	recipes: RecipeInput[],
	config: ScheduleConfig,
	overrides?: Map<string, { multiplier?: number; startMinute?: number }>
): ScheduleStep[] {
	const result: ScheduleStep[] = [];

	// First pass: create all steps with default timing
	for (let ri = 0; ri < recipes.length; ri++) {
		const recipe = recipes[ri];
		for (let si = 0; si < recipe.steps.length; si++) {
			const step = recipe.steps[si];
			const id = `${ri}-${si}`;
			const override = overrides?.get(id);
			const multiplier = override?.multiplier ?? 1;
			result.push({
				id,
				recipeIndex: ri,
				recipeTitle: recipe.title,
				stepIndex: si,
				label: step.raw_text,
				durationMinutes: step.duration_minutes * multiplier,
				isPassive: step.is_passive,
				equipment: step.equipment,
				ingredients: step.ingredients,
				techniques: step.techniques,
				startMinute: override?.startMinute ?? -1, // -1 means needs scheduling
				multiplier,
			});
		}
	}

	// If all steps have explicit start times (user-dragged), respect those
	const needsScheduling = result.filter((s) => s.startMinute < 0);

	if (needsScheduling.length === 0) {
		return result;
	}

	// Auto-schedule: greedy algorithm respecting constraints
	scheduleSteps(result, config);

	return result;
}

function scheduleSteps(steps: ScheduleStep[], config: ScheduleConfig): void {
	// Group steps by recipe, maintaining order
	const recipeGroups = new Map<number, ScheduleStep[]>();
	for (const step of steps) {
		if (!recipeGroups.has(step.recipeIndex)) {
			recipeGroups.set(step.recipeIndex, []);
		}
		recipeGroups.get(step.recipeIndex)!.push(step);
	}

	// Sort each group by step index
	for (const group of recipeGroups.values()) {
		group.sort((a, b) => a.stepIndex - b.stepIndex);
	}

	// Track active cook usage over time: array of { end: number }
	// Track equipment usage over time: equipment name -> array of { start, end }
	interface TimeSlot { start: number; end: number }
	const activeSlots: TimeSlot[] = [];
	const equipmentSlots: Map<string, TimeSlot[]> = new Map();

	// Next available time per recipe (ensures sequential steps within a recipe)
	const recipeNextTime = new Map<number, number>();
	for (const ri of recipeGroups.keys()) {
		recipeNextTime.set(ri, 0);
	}

	// Schedule steps that already have start times first
	for (const step of steps) {
		if (step.startMinute >= 0) {
			const end = step.startMinute + step.durationMinutes;
			if (!step.isPassive) {
				activeSlots.push({ start: step.startMinute, end });
			}
			for (const eq of step.equipment) {
				if (!equipmentSlots.has(eq)) equipmentSlots.set(eq, []);
				equipmentSlots.get(eq)!.push({ start: step.startMinute, end });
			}
			// Update recipe next time
			const current = recipeNextTime.get(step.recipeIndex) ?? 0;
			if (end > current) recipeNextTime.set(step.recipeIndex, end);
		}
	}

	// Now schedule remaining steps
	// Strategy: process recipes round-robin, one step at a time
	const cursors = new Map<number, number>(); // recipe -> next unscheduled step index
	for (const [ri, group] of recipeGroups) {
		// Find the first unscheduled step
		const firstUnscheduled = group.findIndex((s) => s.startMinute < 0);
		cursors.set(ri, firstUnscheduled >= 0 ? firstUnscheduled : group.length);
	}

	let maxIterations = steps.length * 2;
	while (maxIterations-- > 0) {
		// Find the recipe with the earliest next-available time
		let bestRecipe = -1;
		let bestTime = Infinity;

		for (const [ri, cursor] of cursors) {
			const group = recipeGroups.get(ri)!;
			if (cursor >= group.length) continue;
			const nextTime = recipeNextTime.get(ri) ?? 0;
			if (nextTime < bestTime) {
				bestTime = nextTime;
				bestRecipe = ri;
			}
		}

		if (bestRecipe < 0) break; // All done

		const group = recipeGroups.get(bestRecipe)!;
		const cursor = cursors.get(bestRecipe)!;
		const step = group[cursor];

		// Find earliest feasible start time
		const recipeEarliest = recipeNextTime.get(bestRecipe) ?? 0;
		let startTime = recipeEarliest;

		// If the step needs a cook (active), find when a cook is free
		if (!step.isPassive) {
			startTime = findEarliestActiveSlot(startTime, step.durationMinutes, activeSlots, config.cooks);
		}

		// Check equipment availability
		for (const eq of step.equipment) {
			const maxCount = config.equipment[eq] ?? 1;
			const slots = equipmentSlots.get(eq) ?? [];
			startTime = findEarliestEquipmentSlot(startTime, step.durationMinutes, slots, maxCount);
		}

		// If start was pushed forward due to constraints, re-check cook availability
		if (!step.isPassive && startTime > recipeEarliest) {
			startTime = findEarliestActiveSlot(startTime, step.durationMinutes, activeSlots, config.cooks);
			// Re-check equipment at new time
			for (const eq of step.equipment) {
				const maxCount = config.equipment[eq] ?? 1;
				const slots = equipmentSlots.get(eq) ?? [];
				startTime = findEarliestEquipmentSlot(startTime, step.durationMinutes, slots, maxCount);
			}
		}

		// Assign the step
		step.startMinute = startTime;
		const endTime = startTime + step.durationMinutes;

		if (!step.isPassive) {
			activeSlots.push({ start: startTime, end: endTime });
		}
		for (const eq of step.equipment) {
			if (!equipmentSlots.has(eq)) equipmentSlots.set(eq, []);
			equipmentSlots.get(eq)!.push({ start: startTime, end: endTime });
		}

		recipeNextTime.set(bestRecipe, endTime);
		cursors.set(bestRecipe, cursor + 1);
	}
}

function findEarliestActiveSlot(
	earliest: number,
	duration: number,
	activeSlots: { start: number; end: number }[],
	maxCooks: number
): number {
	let t = earliest;
	for (let attempts = 0; attempts < 200; attempts++) {
		const concurrent = activeSlots.filter((s) => s.start < t + duration && s.end > t).length;
		if (concurrent < maxCooks) return t;
		// Jump to the earliest ending slot that overlaps
		const overlapping = activeSlots
			.filter((s) => s.start < t + duration && s.end > t)
			.sort((a, b) => a.end - b.end);
		if (overlapping.length > 0) {
			t = overlapping[0].end;
		} else {
			break;
		}
	}
	return t;
}

function findEarliestEquipmentSlot(
	earliest: number,
	duration: number,
	slots: { start: number; end: number }[],
	maxCount: number
): number {
	let t = earliest;
	for (let attempts = 0; attempts < 200; attempts++) {
		const concurrent = slots.filter((s) => s.start < t + duration && s.end > t).length;
		if (concurrent < maxCount) return t;
		const overlapping = slots
			.filter((s) => s.start < t + duration && s.end > t)
			.sort((a, b) => a.end - b.end);
		if (overlapping.length > 0) {
			t = overlapping[0].end;
		} else {
			break;
		}
	}
	return t;
}

export function totalDuration(steps: ScheduleStep[]): number {
	if (steps.length === 0) return 0;
	return Math.max(...steps.map((s) => s.startMinute + s.durationMinutes));
}

export function formatMinutes(minutes: number): string {
	if (minutes === 0) return '0 min';
	if (minutes < 60) return `${Math.round(minutes)} min`;
	const h = Math.floor(minutes / 60);
	const m = Math.round(minutes % 60);
	if (m === 0) return `${h}h`;
	return `${h}h ${m}m`;
}
