import { Notice, Plugin } from 'obsidian';
import type { TFile } from 'obsidian';
import {
	captureSnapshot,
	evaluateShrink,
	normalizeExcludedFolders,
	snapshotsHaveSameMetrics,
} from './core';
import type { VaultSnapshot } from './core';
import { DEFAULT_SETTINGS, VaultCanarySettingTab } from './settings';
import type { VaultCanarySettings } from './settings';

interface StoredData {
	settings?: Partial<VaultCanarySettings>;
	baseline?: VaultSnapshot;
	lastAlertAt?: number;
}

export type CheckTrigger = 'startup' | 'scheduled' | 'event' | 'manual';

const EVENT_DEBOUNCE_MS = 5_000;
const HEARTBEAT_MS = 60_000;
const ALERT_NOTICE_MS = 15_000;

export default class VaultCanaryPlugin extends Plugin {
	settings: VaultCanarySettings = { ...DEFAULT_SETTINGS };
	baseline: VaultSnapshot | null = null;
	private lastAlertAt = 0;
	private lastCheckAt = 0;
	private monitoringAllowedAfter = 0;
	private checkInFlight = false;
	private startupTimer: number | null = null;
	private eventCheckTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadState();

		this.addSettingTab(new VaultCanarySettingTab(this.app, this));
		this.addCommand({
			id: 'check-vault-now',
			name: 'Check vault now',
			callback: () => void this.checkVault('manual', true),
		});
		this.addCommand({
			id: 'set-current-baseline',
			name: 'Set current vault state as baseline',
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
		await this.saveState();
	}

	async setCurrentAsBaseline(showNotice: boolean): Promise<void> {
		const snapshot = this.captureCurrentSnapshot();
		this.baseline = snapshot;
		this.lastAlertAt = 0;
		this.lastCheckAt = Date.now();
		await this.saveState();

		if (showNotice) {
			new Notice(
				`Vault Canary baseline set: ${snapshot.fileCount.toLocaleString()} files, ` +
					`${snapshot.markdownCount.toLocaleString()} Markdown notes, ${formatBytes(snapshot.totalBytes)}.`,
			);
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
				await this.saveState();
				if (forceNotice) {
					new Notice(
						`Vault Canary created its first baseline: ${current.fileCount.toLocaleString()} files.`,
					);
				}
				return;
			}

			const evaluation = evaluateShrink(this.baseline, current, this.settings);
			if (evaluation.alert) {
				const cooldownMs = this.settings.alertCooldownMinutes * 60_000;
				const cooldownPassed = Date.now() - this.lastAlertAt >= cooldownMs;
				if (forceNotice || cooldownPassed) {
					this.lastAlertAt = Date.now();
					await this.saveState();
					new Notice(buildAlertMessage(evaluation, this.baseline, current), ALERT_NOTICE_MS);
				}
				return;
			}

			this.lastAlertAt = 0;
			if (!snapshotsHaveSameMetrics(this.baseline, current)) {
				this.baseline = current;
				await this.saveState();
			}

			if (forceNotice) {
				new Notice(
					`Vault Canary found no unexpected shrink: ${current.fileCount.toLocaleString()} files, ` +
						`${current.markdownCount.toLocaleString()} Markdown notes, ${formatBytes(current.totalBytes)}.`,
				);
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
			excludedFolders: normalizeExcludedFolders(data?.settings?.excludedFolders ?? []),
		};
		this.baseline = data?.baseline ?? null;
		this.lastAlertAt = data?.lastAlertAt ?? 0;
	}

	private async saveState(): Promise<void> {
		const data: StoredData = {
			settings: this.settings,
			baseline: this.baseline ?? undefined,
			lastAlertAt: this.lastAlertAt,
		};
		await this.saveData(data);
	}
}

function buildAlertMessage(
	evaluation: ReturnType<typeof evaluateShrink>,
	baseline: VaultSnapshot,
	current: VaultSnapshot,
): string {
	const details: string[] = [];
	if (evaluation.reasons.includes('files')) {
		details.push(
			`${evaluation.fileDrop.toLocaleString()} files (${evaluation.fileDropPercent.toFixed(1)}%)`,
		);
	}
	if (evaluation.reasons.includes('markdown')) {
		details.push(
			`${evaluation.markdownDrop.toLocaleString()} Markdown notes (${evaluation.markdownDropPercent.toFixed(1)}%)`,
		);
	}
	if (evaluation.reasons.includes('size')) {
		details.push(
			`${formatBytes(evaluation.sizeDropBytes)} (${evaluation.sizeDropPercent.toFixed(1)}%) of storage`,
		);
	}

	return (
		`Vault Canary detected an unexpected shrink: ${details.join(', ')}. ` +
		`Baseline ${baseline.fileCount.toLocaleString()} → current ${current.fileCount.toLocaleString()} files. ` +
		'Review sync or backups before accepting the current state as a new baseline.'
	);
}

function formatBytes(bytes: number): string {
	if (bytes < 1_024) {
		return `${bytes.toLocaleString()} B`;
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
