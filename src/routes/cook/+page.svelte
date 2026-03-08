<script lang="ts">
	import type { PageData } from './$types';
	import { buildSchedule, totalDuration, formatMinutes } from '$lib/scheduler';
	import type { ScheduleStep, RecipeInput, ScheduleConfig } from '$lib/scheduler';

	let { data } = $props<{ data: PageData }>();

	let selectedRecipeIds = $state<Set<string>>(new Set());
	let cooks = $state(1);
	let equipmentList = $state<{ name: string; count: number }[]>([
		{ name: 'oven', count: 1 },
		{ name: 'stove', count: 1 },
	]);
	let multipliers = $state<Map<string, number>>(new Map());
	let dragOffsets = $state<Map<string, number>>(new Map());
	let finishTime = $state('');

	// Drag state
	let dragStepId = $state<string | null>(null);
	let dragStartX = $state(0);
	let dragOriginalStart = $state(0);

	// Color palette for recipes
	const RECIPE_COLORS = ['#e65100', '#1565c0', '#2e7d32', '#7b1fa2', '#c62828', '#00838f', '#4e342e', '#37474f'];
	const RECIPE_COLORS_LIGHT = ['#fff3e0', '#e3f2fd', '#e8f5e9', '#f3e5f5', '#ffebee', '#e0f7fa', '#efebe9', '#eceff1'];
	const PASSIVE_COLORS = ['#ffcc80', '#90caf9', '#a5d6a7', '#ce93d8', '#ef9a9a', '#80deea', '#bcaaa4', '#b0bec5'];

	$effect(() => {
		selectedRecipeIds = new Set(data.selectedIds);
	});

	function toggleRecipe(id: string) {
		const next = new Set(selectedRecipeIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedRecipeIds = next;
	}

	function generateUrl(): string {
		const params = new URLSearchParams();
		for (const id of selectedRecipeIds) {
			params.append('recipe', id);
		}
		return `/cook?${params.toString()}`;
	}

	function addEquipment() {
		equipmentList = [...equipmentList, { name: '', count: 1 }];
	}

	function removeEquipment(index: number) {
		equipmentList = equipmentList.filter((_: { name: string; count: number }, i: number) => i !== index);
	}

	function getMultiplier(stepId: string): number {
		return multipliers.get(stepId) ?? 1;
	}

	function setMultiplier(stepId: string, value: number) {
		const next = new Map(multipliers);
		if (value === 1) {
			next.delete(stepId);
		} else {
			next.set(stepId, value);
		}
		multipliers = next;
	}

	// Build the schedule
	let recipeInputs = $derived<RecipeInput[]>(
		data.selectedRecipes.map((r: { title: string; steps: { raw_text: string; duration_minutes: number; is_passive: boolean; equipment: string[]; ingredients: string[]; techniques: string[] }[] }) => ({
			title: r.title,
			steps: r.steps,
		}))
	);

	let config = $derived<ScheduleConfig>({
		cooks,
		equipment: Object.fromEntries(
			equipmentList
				.filter((e: { name: string; count: number }) => e.name.trim())
				.map((e: { name: string; count: number }) => [e.name.trim().toLowerCase(), e.count])
		),
	});

	let overrides = $derived(() => {
		const map = new Map<string, { multiplier?: number; startMinute?: number }>();
		for (const [id, m] of multipliers) {
			map.set(id, { ...(map.get(id) ?? {}), multiplier: m });
		}
		for (const [id, offset] of dragOffsets) {
			const existing = map.get(id) ?? {};
			map.set(id, { ...existing, startMinute: offset });
		}
		return map;
	});

	let schedule = $derived<ScheduleStep[]>(
		data.selectedRecipes.length > 0
			? buildSchedule(recipeInputs, config, overrides())
			: []
	);

	let totalTime = $derived(totalDuration(schedule));

	// Gantt chart dimensions
	const ROW_HEIGHT = 48;
	const LABEL_WIDTH = 0;
	const MIN_CHART_WIDTH = 800;

	let chartContainerEl = $state<HTMLDivElement | null>(null);
	let chartWidth = $state(MIN_CHART_WIDTH);

	$effect(() => {
		if (chartContainerEl) {
			chartWidth = Math.max(chartContainerEl.clientWidth - LABEL_WIDTH, MIN_CHART_WIDTH);
		}
	});

	function minuteToX(minute: number): number {
		if (totalTime === 0) return 0;
		return (minute / totalTime) * chartWidth;
	}

	function xToMinute(x: number): number {
		if (chartWidth === 0) return 0;
		return (x / chartWidth) * totalTime;
	}

	// Group schedule by recipe for swimlane layout
	let swimlanes = $derived(() => {
		const lanes: { recipeIndex: number; title: string; steps: ScheduleStep[] }[] = [];
		const seen = new Set<number>();
		for (const step of schedule) {
			if (!seen.has(step.recipeIndex)) {
				seen.add(step.recipeIndex);
				lanes.push({
					recipeIndex: step.recipeIndex,
					title: step.recipeTitle,
					steps: [],
				});
			}
			lanes.find((l) => l.recipeIndex === step.recipeIndex)!.steps.push(step);
		}
		return lanes;
	});

	// All equipment mentioned across all steps
	let detectedEquipment = $derived(() => {
		const eqSet = new Set<string>();
		for (const r of data.selectedRecipes) {
			for (const s of r.steps) {
				for (const e of s.equipment) {
					eqSet.add(e.toLowerCase());
				}
			}
		}
		return [...eqSet].sort();
	});

	// Ensure detected equipment is in the list
	$effect(() => {
		const detected = detectedEquipment();
		const existing = new Set(equipmentList.map((e: { name: string; count: number }) => e.name.toLowerCase()));
		const toAdd = detected.filter((e: string) => !existing.has(e));
		if (toAdd.length > 0) {
			equipmentList = [
				...equipmentList,
				...toAdd.map((name: string) => ({ name, count: 1 }))
			];
		}
	});

	// Drag handling
	function onDragStart(e: MouseEvent, stepId: string) {
		const step = schedule.find((s) => s.id === stepId);
		if (!step) return;
		dragStepId = stepId;
		dragStartX = e.clientX;
		dragOriginalStart = step.startMinute;

		e.preventDefault();
	}

	function onDragMove(e: MouseEvent) {
		if (!dragStepId) return;
		const dx = e.clientX - dragStartX;
		const dMinutes = xToMinute(dx);
		const newStart = Math.max(0, Math.round(dragOriginalStart + dMinutes));

		const next = new Map(dragOffsets);
		next.set(dragStepId, newStart);
		dragOffsets = next;
	}

	function onDragEnd() {
		dragStepId = null;
	}

	function resetDrag(stepId: string) {
		const next = new Map(dragOffsets);
		next.delete(stepId);
		dragOffsets = next;
	}

	function resetAllDrags() {
		dragOffsets = new Map();
	}

	// Time markers for the axis
	let timeMarkers = $derived(() => {
		if (totalTime === 0) return [];
		const interval = totalTime <= 30 ? 5
			: totalTime <= 120 ? 15
			: totalTime <= 360 ? 30
			: 60;
		const markers: number[] = [];
		for (let t = 0; t <= totalTime; t += interval) {
			markers.push(t);
		}
		return markers;
	});

	// Tooltip state
	let tooltipStep = $state<ScheduleStep | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function showTooltip(e: MouseEvent, step: ScheduleStep) {
		tooltipStep = step;
		tooltipX = e.clientX + 12;
		tooltipY = e.clientY + 12;
	}

	function hideTooltip() {
		tooltipStep = null;
	}

	// Finish time: convert a relative minute offset to a clock time string
	function minuteToClock(minute: number): string {
		if (!finishTime) return '';
		const [h, m] = finishTime.split(':').map(Number);
		if (isNaN(h) || isNaN(m)) return '';
		const finishTotalMin = h * 60 + m;
		const startTotalMin = finishTotalMin - totalTime;
		const clockMin = startTotalMin + minute;
		const clockH = Math.floor(((clockMin % 1440) + 1440) % 1440 / 60);
		const clockM = Math.round(((clockMin % 60) + 60) % 60);
		const period = clockH >= 12 ? 'PM' : 'AM';
		const displayH = clockH === 0 ? 12 : clockH > 12 ? clockH - 12 : clockH;
		return `${displayH}:${clockM.toString().padStart(2, '0')} ${period}`;
	}
</script>

<svelte:head>
	<title>Cook - Gantt Scheduler</title>
</svelte:head>

<svelte:window onmousemove={onDragMove} onmouseup={onDragEnd} />

<div class="cook-layout">
	<aside class="cook-sidebar">
		<div class="sidebar-header">
			<h2>Cook Scheduler</h2>
		</div>

		<div class="sidebar-section">
			<h3>Select Recipes</h3>
			{#if data.recipes.length === 0}
				<p class="empty">No recipes yet. <a href="/recipes">Create some first</a>.</p>
			{:else}
				<ul class="recipe-list">
					{#each data.recipes as recipe}
						<li>
							<label class="recipe-checkbox">
								<input
									type="checkbox"
									checked={selectedRecipeIds.has(recipe.id)}
									onchange={() => toggleRecipe(recipe.id)}
								/>
								<span>{recipe.title}</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}
			<a href={generateUrl()} class="btn-schedule">Schedule</a>
		</div>

		<div class="sidebar-section">
			<h3>Cooks</h3>
			<div class="cooks-control">
				<button onclick={() => { if (cooks > 1) cooks--; }}>-</button>
				<span class="cooks-num">{cooks}</span>
				<button onclick={() => cooks++}>+</button>
				<span class="cooks-label">cook{cooks === 1 ? '' : 's'}</span>
			</div>
		</div>

		<div class="sidebar-section">
			<h3>Equipment</h3>
			{#each equipmentList as eq, i}
				<div class="equipment-row">
					<input type="text" bind:value={eq.name} placeholder="e.g. oven" class="eq-name" />
					<div class="eq-count-control">
						<button onclick={() => { if (eq.count > 1) eq.count--; }}>-</button>
						<span>{eq.count}</span>
						<button onclick={() => eq.count++}>+</button>
					</div>
					<button class="btn-remove-eq" onclick={() => removeEquipment(i)}>&times;</button>
				</div>
			{/each}
			<button class="btn-add-eq" onclick={addEquipment}>+ Add Equipment</button>
		</div>

		<div class="sidebar-section">
			<h3>Finish Time</h3>
			<p class="finish-time-hint">Set when you want to be done eating. Steps will show clock times.</p>
			<div class="finish-time-control">
				<input type="time" bind:value={finishTime} class="finish-time-input" />
				{#if finishTime}
					<button class="btn-clear-time" onclick={() => finishTime = ''}>Clear</button>
				{/if}
			</div>
			{#if finishTime && totalTime > 0}
				<p class="finish-time-summary">Start cooking at <strong>{minuteToClock(0)}</strong></p>
			{/if}
		</div>
	</aside>

	<section class="gantt-area">
		{#if data.selectedRecipes.length === 0}
			<div class="placeholder">
				<p>Select recipes and click "Schedule" to create a cooking timeline.</p>
			</div>
		{:else if schedule.length === 0}
			<div class="placeholder">
				<p>No steps to schedule. Make sure your recipes have analyzed instructions.</p>
				<p>Try editing and saving your recipes to trigger step analysis.</p>
			</div>
		{:else}
			<div class="gantt-header">
				<div class="gantt-summary">
					<span><strong>Total time:</strong> {formatMinutes(totalTime)}</span>
					<span><strong>Recipes:</strong> {data.selectedRecipes.length}</span>
					<span><strong>Steps:</strong> {schedule.length}</span>
					<span><strong>Cooks:</strong> {cooks}</span>
				</div>
				<div class="gantt-actions">
					<button class="btn-reset" onclick={resetAllDrags}>Reset Timing</button>
				</div>
			</div>

			<div class="gantt-container" bind:this={chartContainerEl}>
				<!-- Time axis -->
				<div class="time-axis" class:has-clock={!!finishTime} style="width: {chartWidth}px">
					{#each timeMarkers() as t}
						<div class="time-marker" style="left: {minuteToX(t)}px">
							{#if finishTime}
								<span class="time-label clock-label">{minuteToClock(t)}</span>
							{/if}
							<span class="time-label">{formatMinutes(t)}</span>
						</div>
					{/each}
				</div>

				<!-- Swimlanes -->
				{#each swimlanes() as lane}
					<div class="swimlane">
						<div class="swimlane-label">
							<span class="recipe-color-dot" style="background: {RECIPE_COLORS[lane.recipeIndex % RECIPE_COLORS.length]}"></span>
							{lane.title}
						</div>
						<div class="swimlane-chart" style="width: {chartWidth}px; height: {ROW_HEIGHT}px">
							<!-- Grid lines -->
							{#each timeMarkers() as t}
								<div class="grid-line" style="left: {minuteToX(t)}px; height: {ROW_HEIGHT}px"></div>
							{/each}

							{#each lane.steps as step}
								{@const x = minuteToX(step.startMinute)}
								{@const w = Math.max(minuteToX(step.startMinute + step.durationMinutes) - x, 24)}
								{@const color = step.isPassive ? PASSIVE_COLORS[step.recipeIndex % PASSIVE_COLORS.length] : RECIPE_COLORS[step.recipeIndex % RECIPE_COLORS.length]}
								{@const isDragged = dragOffsets.has(step.id)}
								<div
									class="gantt-bar"
									class:dragging={dragStepId === step.id}
									class:dragged={isDragged}
									style="left: {x}px; width: {w}px; height: {ROW_HEIGHT - 8}px; background: {color}; top: 4px"
									onmousedown={(e) => onDragStart(e, step.id)}
									onmouseenter={(e) => showTooltip(e, step)}
									onmouseleave={hideTooltip}
									role="button"
									tabindex="0"
								>
									<span class="bar-text" style="color: {step.isPassive ? '#333' : '#fff'}">
										{step.stepIndex + 1}. {step.durationMinutes > 0 ? formatMinutes(step.durationMinutes) : '—'}
									</span>
									{#if isDragged}
										<button class="bar-reset" onclick={(e) => { e.stopPropagation(); resetDrag(step.id); }}
											onmousedown={(e) => e.stopPropagation()}
											title="Reset to auto-scheduled time">&#x21ba;</button>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<!-- End time marker -->
				<div class="time-axis-bottom" class:has-clock={!!finishTime} style="width: {chartWidth}px">
					{#each timeMarkers() as t}
						<div class="time-marker" style="left: {minuteToX(t)}px">
							<span class="time-label">{formatMinutes(t)}</span>
							{#if finishTime}
								<span class="time-label clock-label">{minuteToClock(t)}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Step detail / multiplier table -->
			<div class="step-details">
				<h3>Step Details &amp; Time Multipliers</h3>
				{#each swimlanes() as lane}
					<div class="detail-recipe">
						<h4>
							<span class="recipe-color-dot" style="background: {RECIPE_COLORS[lane.recipeIndex % RECIPE_COLORS.length]}"></span>
							{lane.title}
						</h4>
						<table class="detail-table">
							<thead>
								<tr>
									<th class="col-step">#</th>
									<th class="col-time">Time</th>
									<th class="col-mult">Multiplier</th>
									<th class="col-adj">Adjusted</th>
									<th class="col-type">Type</th>
									<th class="col-start">Start</th>
									<th>Description</th>
								</tr>
							</thead>
							<tbody>
								{#each lane.steps as step}
									{@const baseDuration = data.selectedRecipes[step.recipeIndex]?.steps[step.stepIndex]?.duration_minutes ?? 0}
									{@const mult = getMultiplier(step.id)}
									<tr>
										<td class="col-step">{step.stepIndex + 1}</td>
										<td class="col-time">{formatMinutes(baseDuration)}</td>
										<td class="col-mult">
											<div class="multiplier-control">
												<button onclick={() => setMultiplier(step.id, Math.max(0.25, mult - 0.25))}>-</button>
												<span class="mult-value" class:modified={mult !== 1}>{mult}x</span>
												<button onclick={() => setMultiplier(step.id, mult + 0.25)}>+</button>
											</div>
										</td>
										<td class="col-adj">{formatMinutes(baseDuration * mult)}</td>
										<td class="col-type">
											{#if step.isPassive}
												<span class="type-badge passive">passive</span>
											{:else}
												<span class="type-badge active">active</span>
											{/if}
										</td>
										<td class="col-start">
										{formatMinutes(step.startMinute)}
										{#if finishTime}
											<span class="clock-time">{minuteToClock(step.startMinute)}</span>
										{/if}
									</td>
										<td class="col-desc">
											{step.label.length > 80 ? step.label.slice(0, 80) + '...' : step.label}
											{#if step.equipment.length > 0}
												<div class="step-meta">
													{#each step.equipment as eq}
														<span class="meta-tag eq-tag">{eq}</span>
													{/each}
													{#each step.techniques as tech}
														<span class="meta-tag tech-tag">{tech}</span>
													{/each}
												</div>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- Tooltip -->
{#if tooltipStep}
	<div class="tooltip" style="left: {tooltipX}px; top: {tooltipY}px">
		<strong>Step {tooltipStep.stepIndex + 1}: {tooltipStep.recipeTitle}</strong>
		<p>{tooltipStep.label.length > 120 ? tooltipStep.label.slice(0, 120) + '...' : tooltipStep.label}</p>
		<div class="tooltip-meta">
			<span>Duration: {formatMinutes(tooltipStep.durationMinutes)}</span>
			<span>Starts: {formatMinutes(tooltipStep.startMinute)}{finishTime ? ` (${minuteToClock(tooltipStep.startMinute)})` : ''}</span>
			<span>Type: {tooltipStep.isPassive ? 'Passive' : 'Active'}</span>
		</div>
		{#if tooltipStep.equipment.length > 0}
			<div class="tooltip-meta">Equipment: {tooltipStep.equipment.join(', ')}</div>
		{/if}
		{#if tooltipStep.techniques.length > 0}
			<div class="tooltip-meta">Techniques: {tooltipStep.techniques.join(', ')}</div>
		{/if}
	</div>
{/if}

<style>
	.cook-layout {
		display: flex;
		gap: 0;
		min-height: calc(100vh - 73px);
		margin: 0 auto;
		max-width: none;
	}

	aside.cook-sidebar {
		width: 300px;
		min-width: 300px;
		background: #fff;
		border-right: 1px solid #e0e0e0;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.sidebar-header {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.sidebar-header h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.sidebar-section {
		padding: 1rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.sidebar-section h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #888;
	}

	.recipe-list {
		list-style: none;
		margin: 0;
		padding: 0;
		max-height: 200px;
		overflow-y: auto;
	}

	.recipe-checkbox {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.recipe-checkbox:hover { color: #e65100; }

	.recipe-checkbox input[type='checkbox'] {
		accent-color: #e65100;
		width: 16px;
		height: 16px;
	}

	.btn-schedule {
		display: block;
		text-align: center;
		background: #e65100;
		color: white;
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-weight: 600;
		font-size: 0.85rem;
		margin-top: 0.75rem;
	}

	.btn-schedule:hover { background: #bf360c; }

	.cooks-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.cooks-control button {
		width: 28px;
		height: 28px;
		border: 1px solid #ccc;
		background: #fff;
		border-radius: 4px;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.cooks-control button:hover { background: #f5f5f5; }

	.cooks-num {
		font-size: 1.2rem;
		font-weight: 700;
		min-width: 1.5rem;
		text-align: center;
	}

	.cooks-label {
		color: #888;
		font-size: 0.85rem;
	}

	.equipment-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}

	.eq-name {
		flex: 1;
		padding: 0.3rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.85rem;
	}

	.eq-count-control {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.eq-count-control button {
		width: 22px;
		height: 22px;
		border: 1px solid #ccc;
		background: #fff;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.eq-count-control span {
		min-width: 1rem;
		text-align: center;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.btn-remove-eq {
		background: none;
		border: none;
		color: #999;
		font-size: 1.1rem;
		cursor: pointer;
		padding: 0 0.2rem;
	}

	.btn-remove-eq:hover { color: #c62828; }

	.btn-add-eq {
		background: none;
		border: 1px solid #ccc;
		padding: 0.3rem 0.6rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
		margin-top: 0.3rem;
	}

	.btn-add-eq:hover { background: #f5f5f5; }

	.empty {
		color: #999;
		font-size: 0.9rem;
	}

	.empty a { color: #e65100; }

	/* Gantt area */
	section.gantt-area {
		flex: 1;
		padding: 1.5rem;
		overflow-x: auto;
		overflow-y: auto;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 300px;
		color: #999;
	}

	.gantt-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.gantt-summary {
		display: flex;
		gap: 1.5rem;
		font-size: 0.9rem;
	}

	.gantt-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-reset {
		background: #fff;
		border: 1px solid #ccc;
		padding: 0.4rem 0.8rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.btn-reset:hover { background: #f5f5f5; }

	.gantt-container {
		background: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
		overflow-x: auto;
		padding: 0 1rem 1rem 1rem;
	}

	.time-axis, .time-axis-bottom {
		position: relative;
		height: 24px;
	}

	.time-marker {
		position: absolute;
		top: 0;
	}

	.time-label {
		font-size: 0.7rem;
		color: #999;
		transform: translateX(-50%);
		display: inline-block;
		white-space: nowrap;
	}

	.swimlane {
		border-bottom: 1px solid #f0f0f0;
		padding: 0.25rem 0;
	}

	.swimlane-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #555;
		padding: 0.2rem 0;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.recipe-color-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	.swimlane-chart {
		position: relative;
		overflow: visible;
	}

	.grid-line {
		position: absolute;
		top: 0;
		width: 1px;
		background: #f0f0f0;
	}

	.gantt-bar {
		position: absolute;
		border-radius: 4px;
		cursor: grab;
		display: flex;
		align-items: center;
		padding: 0 0.4rem;
		overflow: hidden;
		user-select: none;
		transition: box-shadow 0.15s;
		box-sizing: border-box;
	}

	.gantt-bar:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		z-index: 10;
	}

	.gantt-bar.dragging {
		cursor: grabbing;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
		z-index: 20;
		opacity: 0.9;
	}

	.gantt-bar.dragged {
		outline: 2px dashed #666;
		outline-offset: -2px;
	}

	.bar-text {
		font-size: 0.7rem;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.bar-reset {
		background: none;
		border: none;
		color: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0 0.2rem;
		margin-left: auto;
		opacity: 0.7;
	}

	.bar-reset:hover { opacity: 1; }

	/* Step details */
	.step-details {
		margin-top: 2rem;
	}

	.step-details h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
	}

	.detail-recipe {
		margin-bottom: 1.5rem;
	}

	.detail-recipe h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.95rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.detail-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	.detail-table th {
		text-align: left;
		padding: 0.4rem 0.5rem;
		background: #f5f5f5;
		border-bottom: 2px solid #e0e0e0;
		font-weight: 600;
		color: #555;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.detail-table td {
		padding: 0.35rem 0.5rem;
		border-bottom: 1px solid #f0f0f0;
		vertical-align: top;
	}

	.detail-table tr:hover { background: #fafafa; }

	.col-step { width: 2rem; text-align: center; }
	.col-time { width: 4.5rem; white-space: nowrap; }
	.col-mult { width: 7rem; }
	.col-adj { width: 4.5rem; white-space: nowrap; }
	.col-type { width: 4.5rem; }
	.col-start { width: 4.5rem; white-space: nowrap; }

	.multiplier-control {
		display: flex;
		align-items: center;
		gap: 0.2rem;
	}

	.multiplier-control button {
		width: 20px;
		height: 20px;
		border: 1px solid #ccc;
		background: #fff;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.multiplier-control button:hover { background: #f5f5f5; }

	.mult-value {
		min-width: 2rem;
		text-align: center;
		font-weight: 500;
		font-size: 0.85rem;
	}

	.mult-value.modified {
		color: #e65100;
		font-weight: 700;
	}

	.type-badge {
		display: inline-block;
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		font-weight: 500;
	}

	.type-badge.active {
		background: #fff3e0;
		color: #e65100;
	}

	.type-badge.passive {
		background: #e3f2fd;
		color: #1565c0;
	}

	.step-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.2rem;
		margin-top: 0.2rem;
	}

	.meta-tag {
		display: inline-block;
		font-size: 0.65rem;
		padding: 0.05rem 0.35rem;
		border-radius: 3px;
		font-weight: 500;
	}

	.eq-tag {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.tech-tag {
		background: #e8f5e9;
		color: #2e7d32;
	}

	.col-desc {
		font-size: 0.8rem;
		color: #555;
		line-height: 1.3;
	}

	/* Tooltip */
	.tooltip {
		position: fixed;
		z-index: 100;
		background: #333;
		color: #fff;
		padding: 0.6rem 0.8rem;
		border-radius: 6px;
		font-size: 0.8rem;
		max-width: 350px;
		pointer-events: none;
		line-height: 1.4;
	}

	.tooltip strong {
		display: block;
		margin-bottom: 0.3rem;
	}

	.tooltip p {
		margin: 0 0 0.3rem 0;
	}

	.tooltip-meta {
		font-size: 0.75rem;
		color: #ccc;
	}

	.tooltip-meta span {
		display: inline-block;
		margin-right: 0.8rem;
	}

	/* Finish time */
	.finish-time-hint {
		font-size: 0.8rem;
		color: #999;
		margin: 0 0 0.5rem 0;
	}

	.finish-time-control {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.finish-time-input {
		padding: 0.35rem 0.5rem;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 0.9rem;
		flex: 1;
	}

	.btn-clear-time {
		background: none;
		border: 1px solid #ccc;
		padding: 0.3rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.75rem;
		color: #888;
	}

	.btn-clear-time:hover { background: #f5f5f5; color: #333; }

	.finish-time-summary {
		font-size: 0.85rem;
		margin: 0.5rem 0 0 0;
		color: #555;
	}

	.clock-label {
		color: #e65100 !important;
		font-weight: 600;
	}

	.time-axis.has-clock, .time-axis-bottom.has-clock {
		height: 38px;
	}

	.has-clock .time-marker {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.clock-time {
		display: block;
		font-size: 0.7rem;
		color: #e65100;
		font-weight: 500;
	}
</style>
