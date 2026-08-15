import { Notice, PluginSettingTab } from 'obsidian';
import type {
	App,
	SettingDefinition,
	SettingDefinitionItem,
} from 'obsidian';
import type { CanaryThresholds } from './core';
import {
	isLocalePreference,
	t,
	type LocalePreference,
} from './i18n';
import type VaultCanaryPlugin from './main';

export interface VaultCanarySettings extends CanaryThresholds {
	checkIntervalMinutes: number;
	startupDelaySeconds: number;
	alertCooldownMinutes: number;
	excludedFolders: string[];
	locale: LocalePreference;
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
	locale: 'auto',
};

type NumericSettingKey =
	| 'checkIntervalMinutes'
	| 'startupDelaySeconds'
	| 'alertCooldownMinutes'
	| 'minimumFileDrop'
	| 'fileDropPercent'
	| 'minimumMarkdownDrop'
	| 'markdownDropPercent'
	| 'sizeDropPercent';

interface NumericSettingRange {
	min: number;
	max: number;
	step: number;
}

const NUMERIC_SETTING_RANGES: Record<NumericSettingKey, NumericSettingRange> = {
	checkIntervalMinutes: { min: 5, max: 1_440, step: 1 },
	startupDelaySeconds: { min: 10, max: 600, step: 1 },
	alertCooldownMinutes: { min: 1, max: 1_440, step: 1 },
	minimumFileDrop: { min: 1, max: 100_000, step: 1 },
	fileDropPercent: { min: 0.1, max: 100, step: 0.1 },
	minimumMarkdownDrop: { min: 1, max: 100_000, step: 1 },
	markdownDropPercent: { min: 0.1, max: 100, step: 0.1 },
	sizeDropPercent: { min: 0.1, max: 100, step: 0.1 },
};

export class VaultCanarySettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: VaultCanaryPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const locale = this.plugin.locale;

		return [
			{
				name: t(locale, 'settings.title'),
				desc: t(locale, 'settings.description'),
			},
			{
				type: 'group',
				heading: t(locale, 'settings.general'),
				items: [
					{
						name: t(locale, 'settings.language'),
						desc: t(locale, 'settings.languageDesc'),
						control: {
							type: 'dropdown',
							key: 'locale',
							defaultValue: DEFAULT_SETTINGS.locale,
							options: {
								auto: t(locale, 'language.auto'),
								ja: t(locale, 'language.japanese'),
								en: t(locale, 'language.english'),
							},
						},
					},
				],
			},
			{
				type: 'group',
				heading: t(locale, 'settings.actions'),
				items: [
					this.actionDefinition(
						t(locale, 'settings.checkNow'),
						t(locale, 'settings.checkNowDesc'),
						t(locale, 'settings.check'),
						() => this.plugin.checkVault('manual', true),
					),
					this.actionDefinition(
						t(locale, 'settings.setBaseline'),
						t(locale, 'settings.setBaselineDesc'),
						t(locale, 'settings.setBaselineButton'),
						() => this.plugin.setCurrentAsBaseline(true),
					),
					{
						name: t(locale, 'settings.currentBaseline'),
						desc: describeBaseline(this.plugin.baseline, locale),
					},
				],
			},
			{
				type: 'group',
				heading: t(locale, 'settings.monitoring'),
				items: [
					this.numericDefinition(
						t(locale, 'settings.checkInterval'),
						t(locale, 'settings.checkIntervalDesc'),
						'checkIntervalMinutes',
					),
					this.numericDefinition(
						t(locale, 'settings.startupDelay'),
						t(locale, 'settings.startupDelayDesc'),
						'startupDelaySeconds',
					),
					this.numericDefinition(
						t(locale, 'settings.cooldown'),
						t(locale, 'settings.cooldownDesc'),
						'alertCooldownMinutes',
					),
				],
			},
			{
				type: 'group',
				heading: t(locale, 'settings.thresholds'),
				items: [
					this.numericDefinition(
						t(locale, 'settings.minimumFileDrop'),
						t(locale, 'settings.minimumFileDropDesc'),
						'minimumFileDrop',
					),
					this.numericDefinition(
						t(locale, 'settings.fileDropPercent'),
						t(locale, 'settings.fileDropPercentDesc'),
						'fileDropPercent',
					),
					this.numericDefinition(
						t(locale, 'settings.minimumMarkdownDrop'),
						t(locale, 'settings.minimumMarkdownDropDesc'),
						'minimumMarkdownDrop',
					),
					this.numericDefinition(
						t(locale, 'settings.markdownDropPercent'),
						t(locale, 'settings.markdownDropPercentDesc'),
						'markdownDropPercent',
					),
					this.numericDefinition(
						t(locale, 'settings.sizeDropPercent'),
						t(locale, 'settings.sizeDropPercentDesc'),
						'sizeDropPercent',
					),
				],
			},
			{
				type: 'group',
				heading: t(locale, 'settings.scope'),
				items: [
					{
						name: t(locale, 'settings.excludedFolders'),
						desc: t(locale, 'settings.excludedFoldersDesc'),
						control: {
							type: 'textarea',
							key: 'excludedFoldersText',
							placeholder: t(locale, 'settings.excludedFoldersPlaceholder'),
							rows: 3,
						},
					},
				],
			},
			{
				name: t(locale, 'settings.safety'),
				desc: t(locale, 'settings.safetyDesc'),
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'locale') {
			return this.plugin.settings.locale;
		}
		if (key === 'excludedFoldersText') {
			return this.plugin.settings.excludedFolders.join('\n');
		}
		return this.plugin.settings[key as keyof VaultCanarySettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key === 'locale') {
			if (!isLocalePreference(value)) {
				return;
			}
			this.plugin.settings.locale = value;
			await this.plugin.saveSettings();
			new Notice(t(this.plugin.locale, 'notice.languageChanged'));
			this.update();
			return;
		}
		if (key === 'excludedFoldersText') {
			await this.plugin.updateExcludedFolders(String(value).split(/\r?\n/));
			return;
		}

		if (!isNumericSettingKey(key) || typeof value !== 'number' || !Number.isFinite(value)) {
			return;
		}

		const range = NUMERIC_SETTING_RANGES[key];
		this.plugin.settings[key] = Math.min(range.max, Math.max(range.min, value));
		await this.plugin.saveSettings();
	}

	private actionDefinition(
		name: string,
		desc: string,
		buttonText: string,
		action: () => Promise<void>,
	): SettingDefinition {
		return {
			name,
			desc,
			render: (setting) => {
				setting.addButton((button) =>
					button.setButtonText(buttonText).onClick(async () => {
						try {
							await action();
						} finally {
							this.update();
						}
					}),
				);
			},
		};
	}

	private numericDefinition(
		name: string,
		desc: string,
		key: NumericSettingKey,
	): SettingDefinition {
		const range = NUMERIC_SETTING_RANGES[key];
		return {
			name,
			desc,
			control: {
				type: 'number',
				key,
				defaultValue: DEFAULT_SETTINGS[key],
				min: range.min,
				max: range.max,
				step: range.step,
			},
		};
	}
}

function isNumericSettingKey(key: string): key is NumericSettingKey {
	return Object.prototype.hasOwnProperty.call(NUMERIC_SETTING_RANGES, key);
}

function describeBaseline(
	baseline: VaultCanaryPlugin['baseline'],
	locale: VaultCanaryPlugin['locale'],
): string {
	if (baseline === null) {
		return t(locale, 'settings.noBaseline');
	}
	return t(locale, 'settings.baseline', {
		files: baseline.fileCount.toLocaleString(locale),
		markdown: baseline.markdownCount.toLocaleString(locale),
		size: formatBytes(baseline.totalBytes, locale),
	});
}

function formatBytes(bytes: number, locale: VaultCanaryPlugin['locale']): string {
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
