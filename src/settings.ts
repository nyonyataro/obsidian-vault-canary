import { App, PluginSettingTab, Setting } from 'obsidian';
import { normalizeExcludedFolders } from './core';
import type { CanaryThresholds } from './core';
import type VaultCanaryPlugin from './main';

export interface VaultCanarySettings extends CanaryThresholds {
	checkIntervalMinutes: number;
	startupDelaySeconds: number;
	alertCooldownMinutes: number;
	excludedFolders: string[];
}

export const DEFAULT_SETTINGS: VaultCanarySettings = {
	checkIntervalMinutes: 30,
	startupDelaySeconds: 60,
	alertCooldownMinutes: 30,
	minimumFileDrop: 50,
	fileDropPercent: 10,
	minimumMarkdownDrop: 20,
	markdownDropPercent: 10,
	sizeDropPercent: 20,
	excludedFolders: [],
};

export class VaultCanarySettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: VaultCanaryPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName('Vault Canary').setHeading();
		containerEl.createEl('p', {
			text: 'Warn when the visible vault unexpectedly loses files, Markdown notes, or total storage size. Vault Canary never modifies note content.',
		});

		new Setting(containerEl)
			.setName('Check now')
			.setDesc('Compare the current vault against the saved baseline.')
			.addButton((button) =>
				button.setButtonText('Check').onClick(async () => {
					await this.plugin.checkVault('manual', true);
				}),
			);

		new Setting(containerEl)
			.setName('Set current state as baseline')
			.setDesc('Accept the current file counts and size as the new normal state.')
			.addButton((button) =>
				button.setButtonText('Set baseline').onClick(async () => {
					await this.plugin.setCurrentAsBaseline(true);
					this.display();
				}),
			);

		if (this.plugin.baseline !== null) {
			containerEl.createEl('p', {
				text:
					`Current baseline: ${this.plugin.baseline.fileCount.toLocaleString()} files, ` +
					`${this.plugin.baseline.markdownCount.toLocaleString()} Markdown notes, ` +
					`${formatBytes(this.plugin.baseline.totalBytes)}.`,
			});
		} else {
			containerEl.createEl('p', {
				text: 'No baseline is stored yet. Vault Canary will create one on the next check.',
			});
		}

		new Setting(containerEl).setName('Monitoring').setHeading();
		this.addNumberSetting(
			containerEl,
			'Check interval (minutes)',
			'Periodic checks run at approximately this interval. Minimum: 5 minutes.',
			this.plugin.settings.checkIntervalMinutes,
			5,
			1_440,
			(value) => (this.plugin.settings.checkIntervalMinutes = value),
		);
		this.addNumberSetting(
			containerEl,
			'Startup delay (seconds)',
			'Wait after the workspace is ready before the first automatic check. This reduces false alarms while sync settles. Changes apply on the next plugin reload.',
			this.plugin.settings.startupDelaySeconds,
			10,
			600,
			(value) => (this.plugin.settings.startupDelaySeconds = value),
		);
		this.addNumberSetting(
			containerEl,
			'Alert cooldown (minutes)',
			'Automatic alerts for an unresolved shrink are rate-limited by this duration.',
			this.plugin.settings.alertCooldownMinutes,
			1,
			1_440,
			(value) => (this.plugin.settings.alertCooldownMinutes = value),
		);

		new Setting(containerEl).setName('Detection thresholds').setHeading();
		this.addNumberSetting(
			containerEl,
			'Minimum file drop',
			'Alert when at least this many visible files disappear, even if the percentage is small.',
			this.plugin.settings.minimumFileDrop,
			1,
			100_000,
			(value) => (this.plugin.settings.minimumFileDrop = value),
		);
		this.addNumberSetting(
			containerEl,
			'File drop (%)',
			'Alert when the visible file count drops by this percentage. Percentage detection starts at 100 baseline files.',
			this.plugin.settings.fileDropPercent,
			0.1,
			100,
			(value) => (this.plugin.settings.fileDropPercent = value),
		);
		this.addNumberSetting(
			containerEl,
			'Minimum Markdown drop',
			'Alert when at least this many Markdown notes disappear.',
			this.plugin.settings.minimumMarkdownDrop,
			1,
			100_000,
			(value) => (this.plugin.settings.minimumMarkdownDrop = value),
		);
		this.addNumberSetting(
			containerEl,
			'Markdown drop (%)',
			'Alert when Markdown note count drops by this percentage. Percentage detection starts at 50 baseline notes.',
			this.plugin.settings.markdownDropPercent,
			0.1,
			100,
			(value) => (this.plugin.settings.markdownDropPercent = value),
		);
		this.addNumberSetting(
			containerEl,
			'Storage size drop (%)',
			'Alert when the total size of visible vault files drops by this percentage.',
			this.plugin.settings.sizeDropPercent,
			0.1,
			100,
			(value) => (this.plugin.settings.sizeDropPercent = value),
		);

		new Setting(containerEl).setName('Scope').setHeading();
		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('One vault-relative folder per line. Folder contents are ignored. Changing this list clears the old baseline so different scopes are not compared.')
			.addTextArea((text) => {
				text.setPlaceholder('Archive\nGenerated/cache')
					.setValue(this.plugin.settings.excludedFolders.join('\n'))
					.onChange(async (value) => {
						await this.plugin.updateExcludedFolders(
							normalizeExcludedFolders(value.split('\n')),
						);
					});
			});

		containerEl.createEl('p', {
			text: 'Vault Canary is an early-warning signal, not a backup. Keep a separate backup or version history for recovery.',
		});
	}

	private addNumberSetting(
		containerEl: HTMLElement,
		name: string,
		description: string,
		currentValue: number,
		minimum: number,
		maximum: number,
		apply: (value: number) => void,
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) =>
				text
					.setValue(String(currentValue))
					.onChange(async (rawValue) => {
						const parsed = Number(rawValue);
						if (!Number.isFinite(parsed)) {
							return;
						}
						const clamped = Math.min(maximum, Math.max(minimum, parsed));
						apply(clamped);
						await this.plugin.saveSettings();
					}),
			);
	}
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
