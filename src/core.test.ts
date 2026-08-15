import { describe, expect, it } from 'vitest';
import { captureSnapshot, evaluateShrink, isPathExcluded } from './core';

describe('path exclusions', () => {
	it('matches a folder and its descendants without matching prefix siblings', () => {
		expect(isPathExcluded('Archive/note.md', ['Archive'])).toBe(true);
		expect(isPathExcluded('Archive', ['Archive'])).toBe(true);
		expect(isPathExcluded('Archive-old/note.md', ['Archive'])).toBe(false);
	});
});

describe('captureSnapshot', () => {
	it('counts visible files, markdown files, and bytes after exclusions', () => {
		const snapshot = captureSnapshot(
			[
				{ path: 'a.md', extension: 'md', size: 10 },
				{ path: 'img.png', extension: 'png', size: 90 },
				{ path: 'Cache/ignored.md', extension: 'md', size: 999 },
			],
			['Cache'],
			123,
		);

		expect(snapshot).toEqual({ checkedAt: 123, fileCount: 2, markdownCount: 1, totalBytes: 100 });
	});
});

const thresholds = {
	minimumFileDrop: 50,
	fileDropPercent: 10,
	minimumMarkdownDrop: 20,
	markdownDropPercent: 10,
	sizeDropPercent: 20,
};

describe('evaluateShrink', () => {
	it('alerts on a large absolute file drop', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 10_000, markdownCount: 1_000, totalBytes: 1_000_000 },
			{ checkedAt: 2, fileCount: 9_940, markdownCount: 1_000, totalBytes: 999_000 },
			thresholds,
		);
		expect(result.alert).toBe(true);
		expect(result.reasons).toContain('files');
	});

	it('alerts on a percentage file drop even below the absolute threshold', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 200, markdownCount: 100, totalBytes: 100_000 },
			{ checkedAt: 2, fileCount: 178, markdownCount: 100, totalBytes: 99_000 },
			thresholds,
		);
		expect(result.alert).toBe(true);
		expect(result.reasons).toContain('files');
	});

	it('does not use the percentage trigger on very small vaults', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 20, markdownCount: 20, totalBytes: 10_000 },
			{ checkedAt: 2, fileCount: 18, markdownCount: 18, totalBytes: 9_500 },
			thresholds,
		);
		expect(result.alert).toBe(false);
	});

	it('alerts when markdown notes disappear inside an attachment-heavy vault', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 5_000, markdownCount: 200, totalBytes: 10_000_000 },
			{ checkedAt: 2, fileCount: 4_980, markdownCount: 180, totalBytes: 9_900_000 },
			thresholds,
		);
		expect(result.alert).toBe(true);
		expect(result.reasons).toContain('markdown');
	});

	it('alerts on a large storage-size drop', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 50, markdownCount: 20, totalBytes: 1_000_000 },
			{ checkedAt: 2, fileCount: 49, markdownCount: 20, totalBytes: 700_000 },
			thresholds,
		);
		expect(result.alert).toBe(true);
		expect(result.reasons).toContain('size');
	});

	it('does not alert when the vault grows', () => {
		const result = evaluateShrink(
			{ checkedAt: 1, fileCount: 100, markdownCount: 80, totalBytes: 1_000_000 },
			{ checkedAt: 2, fileCount: 101, markdownCount: 81, totalBytes: 1_010_000 },
			thresholds,
		);
		expect(result.alert).toBe(false);
	});
});
