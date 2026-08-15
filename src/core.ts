export interface VaultFileLike {
	path: string;
	extension: string;
	size: number;
}

export interface VaultSnapshot {
	checkedAt: number;
	fileCount: number;
	markdownCount: number;
	totalBytes: number;
}

export interface CanaryThresholds {
	minimumFileDrop: number;
	fileDropPercent: number;
	minimumMarkdownDrop: number;
	markdownDropPercent: number;
	sizeDropPercent: number;
}

export type ShrinkReason = 'files' | 'markdown' | 'size';

export interface ShrinkEvaluation {
	alert: boolean;
	reasons: ShrinkReason[];
	fileDrop: number;
	fileDropPercent: number;
	markdownDrop: number;
	markdownDropPercent: number;
	sizeDropBytes: number;
	sizeDropPercent: number;
}

const MIN_FILES_FOR_PERCENT_TRIGGER = 100;
const MIN_MARKDOWN_FOR_PERCENT_TRIGGER = 50;

export function normalizeExcludedFolders(folders: readonly string[]): string[] {
	return folders
		.map((folder) => folder.trim().replaceAll('\\', '/').replace(/^\/+|\/+$/g, ''))
		.filter((folder) => folder.length > 0)
		.filter((folder, index, all) => all.indexOf(folder) === index);
}

export function isPathExcluded(path: string, excludedFolders: readonly string[]): boolean {
	return isPathExcludedNormalized(path, normalizeExcludedFolders(excludedFolders));
}

export function captureSnapshot(
	files: readonly VaultFileLike[],
	excludedFolders: readonly string[],
	checkedAt = Date.now(),
): VaultSnapshot {
	const normalizedExcluded = normalizeExcludedFolders(excludedFolders);
	let fileCount = 0;
	let markdownCount = 0;
	let totalBytes = 0;

	for (const file of files) {
		if (isPathExcludedNormalized(file.path, normalizedExcluded)) {
			continue;
		}

		fileCount += 1;
		totalBytes += Math.max(0, file.size);
		if (file.extension.toLowerCase() === 'md') {
			markdownCount += 1;
		}
	}

	return { checkedAt, fileCount, markdownCount, totalBytes };
}

export function evaluateShrink(
	baseline: VaultSnapshot,
	current: VaultSnapshot,
	thresholds: CanaryThresholds,
): ShrinkEvaluation {
	const fileDrop = Math.max(0, baseline.fileCount - current.fileCount);
	const markdownDrop = Math.max(0, baseline.markdownCount - current.markdownCount);
	const sizeDropBytes = Math.max(0, baseline.totalBytes - current.totalBytes);

	const fileDropPercent = percentageDrop(baseline.fileCount, current.fileCount);
	const markdownDropPercent = percentageDrop(baseline.markdownCount, current.markdownCount);
	const sizeDropPercent = percentageDrop(baseline.totalBytes, current.totalBytes);

	const fileTriggered =
		fileDrop >= thresholds.minimumFileDrop ||
		(baseline.fileCount >= MIN_FILES_FOR_PERCENT_TRIGGER &&
			fileDropPercent >= thresholds.fileDropPercent);
	const markdownTriggered =
		markdownDrop >= thresholds.minimumMarkdownDrop ||
		(baseline.markdownCount >= MIN_MARKDOWN_FOR_PERCENT_TRIGGER &&
			markdownDropPercent >= thresholds.markdownDropPercent);
	const sizeTriggered = sizeDropBytes > 0 && sizeDropPercent >= thresholds.sizeDropPercent;

	const reasons: ShrinkReason[] = [];
	if (fileTriggered) {
		reasons.push('files');
	}
	if (markdownTriggered) {
		reasons.push('markdown');
	}
	if (sizeTriggered) {
		reasons.push('size');
	}

	return {
		alert: reasons.length > 0,
		reasons,
		fileDrop,
		fileDropPercent,
		markdownDrop,
		markdownDropPercent,
		sizeDropBytes,
		sizeDropPercent,
	};
}

export function snapshotsHaveSameMetrics(a: VaultSnapshot, b: VaultSnapshot): boolean {
	return (
		a.fileCount === b.fileCount &&
		a.markdownCount === b.markdownCount &&
		a.totalBytes === b.totalBytes
	);
}

export function currentMetricsCoverBaseline(
	baseline: VaultSnapshot,
	current: VaultSnapshot,
): boolean {
	return (
		current.fileCount >= baseline.fileCount &&
		current.markdownCount >= baseline.markdownCount &&
		current.totalBytes >= baseline.totalBytes
	);
}

function isPathExcludedNormalized(path: string, normalizedExcludedFolders: readonly string[]): boolean {
	const normalizedPath = path.replaceAll('\\', '/').replace(/^\/+/, '');
	return normalizedExcludedFolders.some(
		(folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`),
	);
}

function percentageDrop(baseline: number, current: number): number {
	if (baseline <= 0 || current >= baseline) {
		return 0;
	}
	return ((baseline - current) / baseline) * 100;
}
