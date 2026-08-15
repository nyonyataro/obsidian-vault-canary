import { Notice, Plugin } from 'obsidian';
import type { TFile } from 'obsidian';
import {
	captureSnapshot,
	currentMetricsCoverBaseline,
	evaluateShrink,
	normalizeExcludedFolders,
	snapshotsHaveSameMetrics,
} from './core';
import type { VaultSnapshot } from './core';
import {
	isLocalePreference,
	resolveLocale,
	t,
	type Locale,
} from './i18n';
import { DEFAULT_SETTINGS, VaultCanarySettingTab } from './settings';
import type { VaultCanarySettings } from './settings';

interface StoredData {
	settings?: Partial<VaultCanarySettings>;
	baseline?: VaultSnapshot;
	lastAlertAt?: number;
	pendingShrink?: boolean;
}

export type CheckTrigger = 'startup' | 'scheduled' | 'event' | 'manual';

const EVENT_DEBOUNCE_MS = 5_000;
const HEARTBEAT_MS = 60_000;
const ALERT_NOTICE_MS = 15_000;

export default class VaultCanaryPlugin extends Plugin {
	settings: VaultCanarySettings = { ...DEFAULT_SETTINGS };
	baseline: VaultSnapshot | null = null;
	private lastAlertAt = 0;
	private pendingShrink = false;
	private lastCheckAt = 0;
	private monitoringAllowedAfter = 0;
	private checkInFlight = false;
	private startupTimer: number | null = null;
	private eventCheckTimer: number | null = null;

	get locale(): Locale {
		return resolveLocale(this.settings.locale);
	}

	async onload(): Promise<void> {
		await this.loadState();

		this.addSettingTab(new VaultCanarySettingTab(this.app, this));
		this.addCommand({
			id: 'check-vault-now',
			name: t(this.locale, 'command.checkNow'),
			callback: () => void this.checkVault('manual', true),
		});
		this.addCommand({
			id: 'set-current-baseline',
			name: t(this.locale, 'command.setBaseline'),
			callback: () => void this.setCurrentAsBaseline(true),
		});

		this.app.workspace.onLayoutReady(() => {
			this.startMonitoring();
		});
	}

	onunload(): void {
		if (this.startupTimer !== null) {
			window.clearTimeout(this.startupTimer);
		}
		if (this.eventCheckTimer !== null) {
			window.clearTimeout(this.eventCheckTimer);
		}
	}

	async saveSettings(): Promise<void> {
		this.settings.excludedFolders = normalizeExcludedFolders(this.settings.excludedFolders);
		await this.saveState();
	}

	async updateExcludedFolders(folders: string[]): Promise<void> {
		const normalized = normalizeExcludedFolders(folders);
		if (sameStringArray(normalized, this.settings.excludedFolders)) {
			return;
		}
		this.settings.excludedFolders = normalized;
		this.baseline = null;
		this.lastAlertAt = 0;
		this.pendingShrink = false;
		await this.saveState();
	}

	async setCurrentAsBaseline(showNotice: boolean): Promise<void> {
		const snapshot = this.captureCurrentSnapshot();
		this.baseline = snapshot;
		this.lastAlertAt = 0;
		this.pendingShrink = false;
		this.lastCheckAt = Date.now();
		await this.saveState();

		if (showNotice) {
			new Notice(t(this.locale, 'notice.baselineSet', this.snapshotValues(snapshot)));
		}
	}

	async checkVault(trigger: CheckTrigger, forceNotice = false): Promise<void> {
		if (this.checkInFlight) {
			return;
		}
		if (trigger !== 'manual' && Date.now() < this.monitoringAllowedAfter) {
			return;
		}

		this.checkInFlight = true;
		try {
			const current = this.captureCurrentSnapshot();
			this.lastCheckAt = Date.now();

			if (this.baseline === null) {
				this.baseline = current;
				this.lastAlertAt = 0;
				this.pendingShrink = false;
				await this.saveState();
				if (forceNotice) {
					new Notice(t(this.locale, 'notice.createdBaseline', {
						files: current.fileCount.toLocaleString(this.locale),
					}));
				}
				return;
			}

			const evaluation = evaluateShrink(this.baseline, current, this.settings);
			if (evaluation.alert) {
				const pendingStateChanged = !this.pendingShrink;
				this.pendingShrink = true;
				const cooldownMs = this.settings.alertCooldownMinutes * 60_000;
				const cooldownPassed = Date.now() - this.lastAlertAt >= cooldownMs;
				if (forceNotice || cooldownPassed) {
					this.lastAlertAt = Date.now();
					await this.saveState();
					new Notice(buildAlertMessage(evaluation, this.baseline, current, this.locale), ALERT_NOTICE_MS);
				} else if (pendingStateChanged) {
					await this.saveState();
				}
				return;
			}

			const alertStateWasActive = this.lastAlertAt !== 0;
			const pendingShrinkWasActive = this.pendingShrink;
			const baselineChanged = !snapshotsHaveSameMetrics(this.baseline, current);
			const shrinkRecovered = currentMetricsCoverBaseline(this.baseline, current);
			this.lastAlertAt = 0;
			if (!this.pendingShrink || shrinkRecovered) {
				this.pendingShrink = false;
			}
			const baselineWillChange = !this.pendingShrink && baselineChanged;
			if (baselineWillChange) {
				this.baseline = current;
			}
			if (baselineWillChange || alertStateWasActive || pendingShrinkWasActive !== this.pendingShrink) {
				await this.saveState();
			}

			if (forceNotice) {
				if (this.pendingShrink) {
					new Notice(t(this.locale, 'notice.stillSmaller'));
				} else {
					new Notice(t(this.locale, 'notice.noUnexpectedShrink', this.snapshotValues(current)));
				}
			}
		} finally {
			this.checkInFlight = false;
		}
	}

	private startMonitoring(): void {
		this.monitoringAllowedAfter = Date.now() + this.settings.startupDelaySeconds * 1_000;

		this.registerEvent(this.app.vault.on('delete', () => this.scheduleEventCheck()));
		this.registerEvent(this.app.vault.on('create', () => this.scheduleEventCheck()));
		this.registerEvent(this.app.vault.on('rename', () => this.scheduleEventCheck()));
		this.registerEvent(this.app.vault.on('modify', () => this.scheduleEventCheck()));

		this.startupTimer = window.setTimeout(() => {
			this.startupTimer = null;
			void this.checkVault('startup');
		}, this.settings.startupDelaySeconds * 1_000);

		this.registerInterval(
			window.setInterval(() => {
				void this.maybeRunScheduledCheck();
			}, HEARTBEAT_MS),
		);
	}

	private scheduleEventCheck(): void {
		if (this.eventCheckTimer !== null) {
			window.clearTimeout(this.eventCheckTimer);
		}

		const remainingStartupGrace = Math.max(0, this.monitoringAllowedAfter - Date.now());
		const delay = Math.max(EVENT_DEBOUNCE_MS, remainingStartupGrace);
		this.eventCheckTimer = window.setTimeout(() => {
			this.eventCheckTimer = null;
			void this.checkVault('event');
		}, delay);
	}

	private async maybeRunScheduledCheck(): Promise<void> {
		if (Date.now() < this.monitoringAllowedAfter) {
			return;
		}
		const intervalMs = this.settings.checkIntervalMinutes * 60_000;
		if (Date.now() - this.lastCheckAt >= intervalMs) {
			await this.checkVault('scheduled');
		}
	}

	private captureCurrentSnapshot(): VaultSnapshot {
		const files = this.app.vault.getFiles().map((file: TFile) => ({
			path: file.path,
			extension: file.extension,
			size: file.stat.size,
		}));
		return captureSnapshot(files, this.settings.excludedFolders);
	}

	private async loadState(): Promise<void> {
		const data = (await this.loadData()) as StoredData | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...(data?.settings ?? {}),
			locale: isLocalePreference(data?.settings?.locale)
				? data.settings.locale
				: DEFAULT_SETTINGS.locale,
			excludedFolders: normalizeExcludedFolders(data?.settings?.excludedFolders ?? []),
		};
		this.baseline = data?.baseline ?? null;
		this.lastAlertAt = data?.lastAlertAt ?? 0;
		this.pendingShrink = data?.pendingShrink ?? this.lastAlertAt !== 0;
	}

	private async saveState(): Promise<void> {
		const data: StoredData = {
			settings: this.settings,
			baseline: this.baseline ?? undefined,
			lastAlertAt: this.lastAlertAt,
			pendingShrink: this.pendingShrink,
		};
		await this.saveData(data);
	}

	private snapshotValues(snapshot: VaultSnapshot): Record<string, string> {
		return {
			files: snapshot.fileCount.toLocaleString(this.locale),
			markdown: snapshot.markdownCount.toLocaleString(this.locale),
			size: formatBytes(snapshot.totalBytes, this.locale),
		};
	}
}

function buildAlertMessage(
	evaluation: ReturnType<typeof evaluateShrink>,
	baseline: VaultSnapshot,
	current: VaultSnapshot,
	locale: Locale,
): string {
	const details: string[] = [];
	if (evaluation.reasons.includes('files')) {
		details.push(t(locale, 'alert.files', {
			count: evaluation.fileDrop.toLocaleString(locale),
			percent: evaluation.fileDropPercent.toFixed(1),
		}));
	}
	if (evaluation.reasons.includes('markdown')) {
		details.push(t(locale, 'alert.markdown', {
			count: evaluation.markdownDrop.toLocaleString(locale),
			percent: evaluation.markdownDropPercent.toFixed(1),
		}));
	}
	if (evaluation.reasons.includes('size')) {
		details.push(t(locale, 'alert.size', {
			size: formatBytes(evaluation.sizeDropBytes, locale),
			percent: evaluation.sizeDropPercent.toFixed(1),
		}));
	}

	return t(locale, 'alert.detected', {
		details: details.join(locale === 'ja' ? '、' : ', '),
		baseline: baseline.fileCount.toLocaleString(locale),
		current: current.fileCount.toLocaleString(locale),
	});
}

function formatBytes(bytes: number, locale: Locale): string {
	if (bytes < 1_024) {
		return `${bytes.toLocaleString(locale)} B`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1_024;
	let unitIndex = 0;
	while (value >= 1_024 && unitIndex < units.length - 1) {
		value /= 1_024;
		unitIndex += 1;
	}
	return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

function sameStringArray(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}
