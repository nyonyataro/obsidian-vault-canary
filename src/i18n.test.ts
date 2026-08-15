import { describe, expect, it } from 'vitest';
import en from './i18n/en';
import ja from './i18n/ja';
import { localeFromLanguage } from './i18n/locale';

describe('i18n', () => {
	it('keeps Japanese and English dictionaries in sync', () => {
		expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
	});

	it('detects Japanese language codes and falls back to English', () => {
		expect(localeFromLanguage('ja')).toBe('ja');
		expect(localeFromLanguage('ja-JP')).toBe('ja');
		expect(localeFromLanguage('en')).toBe('en');
		expect(localeFromLanguage('fr')).toBe('en');
	});
});
