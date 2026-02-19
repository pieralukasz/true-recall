import { useCallback, useState } from "preact/hooks";
import { FSRS_CONFIG } from "../../../constants";
import { notify } from "../../../services";
import { EasyDaysModal } from "../../modals";
import { useApp } from "../../preact";
import {
	ActionButton,
	InfoBlock,
	SelectInput,
	SettingRow,
	SliderInput,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "../../preact/components";
import { usePreset, useSettings } from "../hooks/useSettings";

interface FSRSTabProps {
	selectedPresetId: string;
	onPresetChange: (id: string) => void;
}

export function FSRSTab({ selectedPresetId, onPresetChange }: FSRSTabProps) {
	const { settings, save, plugin } = useSettings();
	const { preset, updatePreset } = usePreset(selectedPresetId);
	const app = useApp();
	const [version, setVersion] = useState(0);

	const refresh = useCallback(() => setVersion((v) => v + 1), []);

	const presets = settings.fsrsPresets;
	const isDefault = preset.id === settings.defaultPresetId;

	// Force re-read on version changes
	void version;

	// ── Preset CRUD ──

	const handleCreatePreset = useCallback(async () => {
		const newPreset = await plugin.presetService.createPreset({
			name: `${preset.name} (copy)`,
			requestRetention: preset.requestRetention,
			maximumInterval: preset.maximumInterval,
			weights: preset.weights ? [...preset.weights] : null,
			learningSteps: [...preset.learningSteps],
			relearningSteps: [...preset.relearningSteps],
			newCardsPerDay: preset.newCardsPerDay,
			reviewsPerDay: preset.reviewsPerDay,
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		onPresetChange(newPreset.id);
		refresh();
	}, [plugin, preset, onPresetChange, refresh]);

	const handleDeletePreset = useCallback(async () => {
		await plugin.presetService.deletePreset(preset.id);
		onPresetChange(settings.defaultPresetId);
		refresh();
	}, [plugin, preset.id, settings.defaultPresetId, onPresetChange, refresh]);

	return (
		<>
			<PresetSection
				presets={presets}
				preset={preset}
				isDefault={isDefault}
				selectedPresetId={selectedPresetId}
				onPresetChange={onPresetChange}
				onCreate={handleCreatePreset}
				onDelete={handleDeletePreset}
				onRename={(name) => updatePreset({ name })}
			/>

			<AlgorithmSection preset={preset} updatePreset={updatePreset} />

			<DailyLimitsSection preset={preset} updatePreset={updatePreset} />

			<ParametersSection
				preset={preset}
				updatePreset={updatePreset}
				plugin={plugin}
				onRefresh={refresh}
			/>

			<EasyDaysSection
				plugin={plugin}
				settings={settings}
				save={save}
				app={app}
				onRefresh={refresh}
			/>

			<LoadBalanceSection settings={settings} save={save} plugin={plugin} />

			<SiblingDisperseSection settings={settings} save={save} plugin={plugin} />

			<ScheduledBreaksSection
				settings={settings}
				save={save}
				plugin={plugin}
				onRefresh={refresh}
			/>

			<BulkOperationsSection plugin={plugin} />
		</>
	);
}

// ── Preset Section ──

function PresetSection({
	presets,
	preset,
	isDefault,
	selectedPresetId,
	onPresetChange,
	onCreate,
	onDelete,
	onRename,
}: {
	presets: any[];
	preset: any;
	isDefault: boolean;
	selectedPresetId: string;
	onPresetChange: (id: string) => void;
	onCreate: () => void;
	onDelete: () => void;
	onRename: (name: string) => void;
}) {
	return (
		<>
			<SettingRow heading name="FSRS presets" />

			<SettingRow
				name="Active preset"
				description="Each preset has its own retention target, weights, steps, and daily limits"
			>
				<SelectInput
					value={selectedPresetId}
					onChange={onPresetChange}
					options={presets.map((p: any) => ({ value: p.id, label: p.name }))}
				/>
				<ActionButton label="New" variant="secondary" onClick={onCreate} />
				{!isDefault && (
					<ActionButton label="Delete" variant="danger" onClick={onDelete} />
				)}
			</SettingRow>

			{!isDefault && (
				<SettingRow name="Preset name">
					<TextInput
						value={preset.name}
						onChange={(v) => {
							if (v.trim()) onRename(v.trim());
						}}
					/>
				</SettingRow>
			)}
		</>
	);
}

// ── Algorithm Section ──

function AlgorithmSection({
	preset,
	updatePreset,
}: {
	preset: any;
	updatePreset: (c: any) => Promise<void>;
}) {
	return (
		<>
			<SettingRow heading name="FSRS algorithm" />

			<SettingRow
				name="Desired retention"
				description={`Target probability of recall (${FSRS_CONFIG.minRetention}-${FSRS_CONFIG.maxRetention}). Default: 0.9 (90%)`}
			>
				<SliderInput
					value={preset.requestRetention}
					onChange={(v) => void updatePreset({ requestRetention: v })}
					min={FSRS_CONFIG.minRetention}
					max={FSRS_CONFIG.maxRetention}
					step={0.01}
					formatTooltip={(v) => v.toFixed(2)}
				/>
			</SettingRow>

			<SettingRow
				name="Maximum interval (days)"
				description="Maximum days between reviews. Default: 36500 (100 years)"
			>
				<TextInput
					value={String(preset.maximumInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 36500;
						void updatePreset({ maximumInterval: Math.max(1, num) });
					}}
					placeholder="36500"
				/>
			</SettingRow>
		</>
	);
}

// ── Daily Limits Section ──

function DailyLimitsSection({
	preset,
	updatePreset,
}: {
	preset: any;
	updatePreset: (c: any) => Promise<void>;
}) {
	return (
		<>
			<SettingRow heading name="Daily limits" />

			<SettingRow
				name="New cards per day"
				description="Maximum number of new cards introduced per day"
			>
				<TextInput
					value={String(preset.newCardsPerDay)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 20;
						void updatePreset({ newCardsPerDay: Math.max(0, num) });
					}}
					placeholder="20"
				/>
			</SettingRow>

			<SettingRow
				name="Reviews per day"
				description="Maximum number of reviews per day (0 = unlimited)"
			>
				<TextInput
					value={String(preset.reviewsPerDay)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 200;
						void updatePreset({ reviewsPerDay: Math.max(0, num) });
					}}
					placeholder="200"
				/>
			</SettingRow>
		</>
	);
}

// ── Parameters Section ──

function ParametersSection({
	preset,
	updatePreset,
	plugin,
	onRefresh,
}: {
	preset: any;
	updatePreset: (c: any) => Promise<void>;
	plugin: any;
	onRefresh: () => void;
}) {
	const [optimizing, setOptimizing] = useState(false);

	const totalReviews = plugin.cardStore?.stats?.getTotalReviewCount() ?? 0;
	const canOptimize = totalReviews >= FSRS_CONFIG.minReviewsForOptimization;
	const lastOpt = preset.lastOptimization;
	const lastOptCount = preset.lastOptimizationReviewCount;
	const weightsString = preset.weights ? preset.weights.join(", ") : "";

	const handleOptimize = useCallback(async () => {
		setOptimizing(true);
		try {
			const result = await plugin.fsrsHelper?.optimizeParameters(
				undefined,
				preset.name,
				preset.weights,
			);
			if (result && result.metrics.convergenceStatus !== "insufficient_data") {
				await updatePreset({
					weights: result.weights,
					lastOptimization: new Date().toISOString(),
					lastOptimizationReviewCount: result.metrics.reviewCount,
					lastOptimizationMetrics: result.metrics,
				});
				notify().success(
					`Optimization complete! RMSE: ${result.metrics.rmse.toFixed(4)}`,
				);
				onRefresh();
			} else {
				notify().error("Optimization failed: insufficient data");
			}
		} catch (err) {
			notify().error(`Optimization failed: ${String(err)}`);
		} finally {
			setOptimizing(false);
		}
	}, [plugin, preset, updatePreset, onRefresh]);

	const handleReset = useCallback(async () => {
		await updatePreset({
			weights: null,
			lastOptimization: null,
			lastOptimizationReviewCount: null,
			lastOptimizationMetrics: null,
		});
		notify().success("Parameters reset to defaults");
		onRefresh();
	}, [updatePreset, onRefresh]);

	const handleWeightsChange = useCallback(
		async (value: string) => {
			const trimmed = value.trim();
			if (trimmed === "") {
				await updatePreset({ weights: null });
				return;
			}

			const parts = trimmed.split(",").map((s) => parseFloat(s.trim()));
			const validLengths = [17, 19, 21];
			if (!validLengths.includes(parts.length)) {
				notify().error(
					`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`,
				);
				return;
			}
			if (parts.some((n) => Number.isNaN(n))) {
				notify().error("Invalid weights: some values are not numbers.");
				return;
			}

			await updatePreset({
				weights: parts,
				lastOptimization: new Date().toISOString(),
			});
			notify().success("FSRS weights saved!");
		},
		[updatePreset],
	);

	return (
		<>
			<SettingRow heading name="FSRS parameters" />

			<InfoBlock>
				<p>
					FSRS parameters affect how cards are scheduled. You can optimize them
					based on your review history.
				</p>
				<p>
					<strong>Current reviews: </strong>
					{totalReviews.toLocaleString()}{" "}
					{canOptimize
						? "(ready for optimization)"
						: `(need ${FSRS_CONFIG.minReviewsForOptimization}+ for optimization)`}
				</p>
				{lastOpt && (
					<p>
						<strong>Last optimized: </strong>
						{new Date(lastOpt).toLocaleDateString()} (
						{lastOptCount?.toLocaleString() ?? "unknown"} reviews used)
					</p>
				)}
			</InfoBlock>

			<SettingRow
				name="Optimize parameters"
				description="Analyze your review history to find optimal FSRS weights for this preset"
			>
				<ActionButton
					label={optimizing ? "Optimizing..." : "Optimize now"}
					variant="primary"
					disabled={!canOptimize || optimizing}
					onClick={handleOptimize}
				/>
				<ActionButton
					label="Reset to defaults"
					variant="secondary"
					onClick={handleReset}
				/>
			</SettingRow>

			<SettingRow
				name="Custom FSRS weights"
				description="Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults"
			>
				<TextAreaInput
					value={weightsString}
					onChange={handleWeightsChange}
					placeholder="0.40255, 1.18385, 3.173, 15.69105, ..."
					rows={3}
					class="ep:w-full ep:font-mono ep:text-ui-small"
				/>
			</SettingRow>
		</>
	);
}

// ── Easy Days Section ──

function EasyDaysSection({
	plugin,
	settings,
	save,
	app,
	onRefresh,
}: {
	plugin: any;
	settings: any;
	save: (patch: any) => Promise<void>;
	app: any;
	onRefresh: () => void;
}) {
	const easyDays = settings.easyDays;
	const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	const recurringDaysText =
		easyDays.recurringDays.length > 0
			? easyDays.recurringDays.map((d: number) => dayNames[d]).join(", ")
			: "None";
	const specificDatesCount = easyDays.specificDates.length;

	const pushUndo = useCallback(
		(affectedCount: number, changes: any[]) => {
			plugin.undoService?.push({
				id: crypto.randomUUID(),
				actionType: "fsrs-helper-operation",
				description: `Apply easy days (${affectedCount} cards)`,
				timestamp: Date.now(),
				payload: {
					type: "fsrs-helper-operation",
					operation: "apply-easy-days",
					changes: changes.map((c: any) => ({
						cardId: c.cardId,
						originalDue: c.originalDue,
						newDue: c.newDue,
					})),
				},
			});
		},
		[plugin],
	);

	const handleConfigure = useCallback(async () => {
		const modal = new EasyDaysModal(app, {
			easyDays: settings.easyDays,
			multiplier: settings.easyDaysMultiplier,
		});
		const result = await modal.openAndWait();
		if (!result.cancelled && result.easyDays) {
			await save({
				easyDays: result.easyDays,
				...(result.multiplier !== undefined && {
					easyDaysMultiplier: result.multiplier,
				}),
			});

			if (result.applyNow) {
				const applyResult = await plugin.fsrsHelper?.applyEasyDays({
					dryRun: false,
				});
				if (applyResult && applyResult.affectedCount > 0) {
					pushUndo(applyResult.affectedCount, applyResult.changes);
					notify().success(
						`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`,
					);
				} else if (applyResult) {
					notify().info("No cards needed to be moved");
				}
			}
			onRefresh();
		}
	}, [app, settings, save, plugin, pushUndo, onRefresh]);

	const handleApplyNow = useCallback(async () => {
		const applyResult = await plugin.fsrsHelper?.applyEasyDays({
			dryRun: false,
		});
		if (applyResult && applyResult.affectedCount > 0) {
			pushUndo(applyResult.affectedCount, applyResult.changes);
			notify().success(
				`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`,
			);
		} else if (applyResult) {
			notify().info("No cards needed to be moved");
		}
	}, [plugin, pushUndo]);

	return (
		<>
			<SettingRow heading name="Easy days" />

			<InfoBlock>
				<p>
					Reduce your review workload on specific days (recurring weekdays or
					specific dates). Cards due on easy days will be moved to adjacent
					days.
				</p>
			</InfoBlock>

			<SettingRow
				name="Easy days"
				description={`Recurring: ${recurringDaysText} | Specific dates: ${specificDatesCount} | Workload: ${Math.round(settings.easyDaysMultiplier * 100)}%`}
			>
				<ActionButton
					label="Configure..."
					variant="secondary"
					onClick={handleConfigure}
				/>
				<ActionButton
					label="Apply now"
					variant="secondary"
					onClick={handleApplyNow}
				/>
			</SettingRow>
		</>
	);
}

// ── Load Balance Section ──

function LoadBalanceSection({
	settings,
	save,
	plugin,
}: {
	settings: any;
	save: (patch: any) => Promise<void>;
	plugin: any;
}) {
	const [balancing, setBalancing] = useState(false);

	const handleBalance = useCallback(async () => {
		setBalancing(true);
		try {
			const result = await plugin.fsrsHelper?.balanceWorkload({
				dryRun: false,
			});
			if (result && result.affectedCount > 0) {
				plugin.undoService?.push({
					id: crypto.randomUUID(),
					actionType: "fsrs-helper-operation",
					description: `Balance workload (${result.affectedCount} cards)`,
					timestamp: Date.now(),
					payload: {
						type: "fsrs-helper-operation",
						operation: "balance-workload",
						changes: result.changes.map((c: any) => ({
							cardId: c.cardId,
							originalDue: c.originalDue,
							newDue: c.newDue,
						})),
					},
				});
				notify().success(
					`Balanced ${result.affectedCount} cards (Ctrl+Z to undo)`,
				);
			} else if (result) {
				notify().info("No cards needed balancing");
			}
		} catch (err) {
			notify().error(`Balance failed: ${String(err)}`);
		} finally {
			setBalancing(false);
		}
	}, [plugin]);

	return (
		<>
			<SettingRow heading name="Load balance" />

			<SettingRow
				name="Enable load balancing"
				description="Automatically distribute reviews to prevent workload spikes"
			>
				<ToggleInput
					value={settings.loadBalanceEnabled}
					onChange={(v) => save({ loadBalanceEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Target daily reviews"
				description="Target number of reviews per day for balancing"
			>
				<TextInput
					value={String(settings.loadBalanceTarget)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 100;
						void save({ loadBalanceTarget: Math.max(1, num) });
					}}
					placeholder="100"
				/>
			</SettingRow>

			<SettingRow
				name="Maximum deviation (%)"
				description="Allow this much deviation from target before rebalancing"
			>
				<SliderInput
					value={settings.loadBalanceMaxDeviation}
					onChange={(v) => save({ loadBalanceMaxDeviation: v })}
					min={0}
					max={50}
					step={5}
					formatTooltip={(v) => `${v}%`}
				/>
			</SettingRow>

			<SettingRow
				name="Balance workload now"
				description="Redistribute reviews for the next 30 days"
			>
				<ActionButton
					label={balancing ? "Balancing..." : "Balance now"}
					variant="secondary"
					disabled={balancing}
					onClick={handleBalance}
				/>
			</SettingRow>
		</>
	);
}

// ── Sibling Dispersal Section ──

function SiblingDisperseSection({
	settings,
	save,
	plugin,
}: {
	settings: any;
	save: (patch: any) => Promise<void>;
	plugin: any;
}) {
	const [dispersing, setDispersing] = useState(false);

	const handleDisperse = useCallback(async () => {
		setDispersing(true);
		try {
			const result = await plugin.fsrsHelper?.disperseSiblings({
				dryRun: false,
			});
			if (result && result.affectedCount > 0) {
				plugin.undoService?.push({
					id: crypto.randomUUID(),
					actionType: "fsrs-helper-operation",
					description: `Disperse siblings (${result.affectedCount} cards)`,
					timestamp: Date.now(),
					payload: {
						type: "fsrs-helper-operation",
						operation: "disperse-siblings",
						changes: result.changes.map((c: any) => ({
							cardId: c.cardId,
							originalDue: c.originalDue,
							newDue: c.newDue,
						})),
					},
				});
				notify().success(
					`Dispersed ${result.affectedCount} cards (Ctrl+Z to undo)`,
				);
			} else if (result) {
				notify().info("No siblings needed dispersing");
			}
		} catch (err) {
			notify().error(`Disperse failed: ${String(err)}`);
		} finally {
			setDispersing(false);
		}
	}, [plugin]);

	return (
		<>
			<SettingRow heading name="Sibling dispersal" />

			<InfoBlock>
				<p>
					Cards from the same source note are "siblings". Spreading them apart
					helps avoid interference during review.
				</p>
			</InfoBlock>

			<SettingRow
				name="Enable sibling dispersal"
				description="Automatically space out cards from the same note"
			>
				<ToggleInput
					value={settings.siblingDisperseEnabled}
					onChange={(v) => save({ siblingDisperseEnabled: v })}
				/>
			</SettingRow>

			<SettingRow
				name="Minimum sibling interval"
				description="Minimum days between siblings from the same source"
			>
				<TextInput
					value={String(settings.siblingMinInterval)}
					onChange={(v) => {
						const num = parseInt(v, 10) || 3;
						void save({ siblingMinInterval: Math.max(1, num) });
					}}
					placeholder="3"
				/>
			</SettingRow>

			<SettingRow
				name="Disperse siblings now"
				description="Spread out siblings that are currently too close"
			>
				<ActionButton
					label={dispersing ? "Dispersing..." : "Disperse now"}
					variant="secondary"
					disabled={dispersing}
					onClick={handleDisperse}
				/>
			</SettingRow>
		</>
	);
}

// ── Scheduled Breaks Section ──

function ScheduledBreaksSection({
	settings,
	save,
	plugin,
	onRefresh,
}: {
	settings: any;
	save: (patch: any) => Promise<void>;
	plugin: any;
	onRefresh: () => void;
}) {
	const breaks = settings.scheduledBreaks as Array<{
		id: string;
		startDate: string;
		endDate: string;
		redistributeBefore: boolean;
		redistributeAfter: boolean;
	}>;

	const handleDeleteBreak = useCallback(
		async (index: number) => {
			await save({
				scheduledBreaks: breaks.filter((_, i) => i !== index),
			});
			onRefresh();
		},
		[breaks, save, onRefresh],
	);

	const handleAddBreak = useCallback(async () => {
		// eslint-disable-next-line no-alert
		const startDate = prompt("Start date (YYYY-MM-DD):");
		// eslint-disable-next-line no-alert
		const endDate = prompt("End date (YYYY-MM-DD):");
		if (startDate && endDate) {
			await save({
				scheduledBreaks: [
					...breaks,
					{
						id: crypto.randomUUID(),
						startDate,
						endDate,
						redistributeBefore: true,
						redistributeAfter: true,
					},
				],
			});
			onRefresh();
		}
	}, [breaks, save, onRefresh]);

	return (
		<>
			<SettingRow heading name="Scheduled breaks" />

			<InfoBlock>
				<p>
					Schedule breaks (vacations) to redistribute reviews and prevent
					backlog accumulation.
				</p>
			</InfoBlock>

			{breaks.length > 0 && (
				<div class="ep:space-y-2 ep:mb-4">
					{breaks.map((brk, index) => (
						<div
							key={brk.id}
							class="ep:flex ep:items-center ep:justify-between ep:p-2 ep:bg-obs-background-modifier-form ep:rounded-lg"
						>
							<span>
								{brk.startDate} to {brk.endDate}
							</span>
							<button
								class="ep:text-ui-small"
								onClick={() => handleDeleteBreak(index)}
							>
								Delete
							</button>
						</div>
					))}
				</div>
			)}

			<SettingRow
				name="Add scheduled break"
				description="Schedule a break period"
			>
				<ActionButton
					label="Add break..."
					variant="secondary"
					onClick={handleAddBreak}
				/>
			</SettingRow>
		</>
	);
}

// ── Bulk Operations Section ──

function BulkOperationsSection({ plugin }: { plugin: any }) {
	const [rescheduling, setRescheduling] = useState(false);
	const [postponing, setPostponing] = useState(false);
	const [postponeDays, setPostponeDays] = useState("7");

	const handleReschedule = useCallback(async () => {
		setRescheduling(true);
		try {
			const previewResult = await plugin.fsrsHelper?.rescheduleCards({
				scope: "all",
				dryRun: true,
			});
			if (previewResult && previewResult.affectedCount > 0) {
				// eslint-disable-next-line no-alert
				const confirmed = window.confirm(
					`This will reschedule ${previewResult.affectedCount} cards. Proceed?`,
				);
				if (confirmed) {
					const result = await plugin.fsrsHelper?.rescheduleCards({
						scope: "all",
						dryRun: false,
					});
					if (result && result.affectedCount > 0) {
						plugin.undoService?.push({
							id: crypto.randomUUID(),
							actionType: "fsrs-helper-operation",
							description: `Reschedule cards (${result.affectedCount} cards)`,
							timestamp: Date.now(),
							payload: {
								type: "fsrs-helper-operation",
								operation: "reschedule-cards",
								changes: result.changes.map((c: any) => ({
									cardId: c.cardId,
									originalDue: c.originalDue,
									newDue: c.newDue,
								})),
							},
						});
						notify().success(
							`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`,
						);
					}
				}
			} else if (previewResult) {
				notify().info("No cards to reschedule");
			}
		} catch (err) {
			notify().error(`Reschedule failed: ${String(err)}`);
		} finally {
			setRescheduling(false);
		}
	}, [plugin]);

	const handlePostpone = useCallback(async () => {
		const days = parseInt(postponeDays, 10) || 7;
		setPostponing(true);
		try {
			const result = await plugin.fsrsHelper?.shiftDueDates({
				action: "postpone",
				days,
				scope: "due_today",
				dryRun: false,
			});
			if (result && result.affectedCount > 0) {
				plugin.undoService?.push({
					id: crypto.randomUUID(),
					actionType: "fsrs-helper-operation",
					description: `Postpone ${result.affectedCount} cards by ${days} days`,
					timestamp: Date.now(),
					payload: {
						type: "fsrs-helper-operation",
						operation: "shift-due-dates",
						changes: result.changes.map((c: any) => ({
							cardId: c.cardId,
							originalDue: c.originalDue,
							newDue: c.newDue,
						})),
					},
				});
				notify().success(
					`Postponed ${result.affectedCount} cards by ${days} days (Ctrl+Z to undo)`,
				);
			} else if (result) {
				notify().info("No cards to postpone");
			}
		} catch (err) {
			notify().error(`Postpone failed: ${String(err)}`);
		} finally {
			setPostponing(false);
		}
	}, [plugin, postponeDays]);

	return (
		<>
			<SettingRow heading name="Bulk operations" />

			<SettingRow
				name="Reschedule all cards"
				description="Recalculate all intervals with current FSRS weights (preview first)"
			>
				<ActionButton
					label={rescheduling ? "Calculating..." : "Preview reschedule"}
					variant="secondary"
					disabled={rescheduling}
					onClick={handleReschedule}
				/>
			</SettingRow>

			<SettingRow
				name="Postpone all due cards"
				description="Push all due cards forward by N days"
			>
				<TextInput
					value={postponeDays}
					onChange={setPostponeDays}
					placeholder="7"
				/>
				<ActionButton
					label={postponing ? "Postponing..." : "Postpone"}
					variant="secondary"
					disabled={postponing}
					onClick={handlePostpone}
				/>
			</SettingRow>
		</>
	);
}
