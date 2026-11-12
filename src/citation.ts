/** Error severity. Matches vscode.DiagnosticSeverity.Error. Theme color is irrelevant. */
export const ERROR_SEVERITY = 0;

export const SUCCESS_MS = 3000;
export const FAILURE_MS = 5000;

export const MSG = {
	copiedCode: '已复制代码引用',
	copiedDiagnostic: '已复制诊断引用',
	cannotCite: '无法生成引用',
	noDiagnostic: '没有可复制的诊断',
} as const;

const FILE_SCHEME: Record<string, true> = {
	file: true,
	'vscode-remote': true,
};

export function copiedDiagnosticMessage(count: number): string {
	return count > 1 ? `已复制 ${count} 条诊断引用` : MSG.copiedDiagnostic;
}

export function normalizeFsPath(fsPath: string): string {
	return fsPath.replace(/\\/g, '/');
}

export function isIpynbPath(fsPath: string): boolean {
	return normalizeFsPath(fsPath).toLowerCase().endsWith('.ipynb');
}

export function assembleCitationPath(input: {
	scheme: string;
	fsPath: string;
	/** Workspace-relative path without the workspace folder name. Omit outside a workspace. */
	relativePath?: string;
	folderName?: string;
	workspaceCount: number;
}): string | undefined {
	if (!FILE_SCHEME[input.scheme]) {
		return undefined;
	}
	const absolute = normalizeFsPath(input.fsPath);
	if (input.relativePath === undefined || input.workspaceCount < 1 || input.folderName === undefined) {
		return absolute;
	}
	const rel = normalizeFsPath(input.relativePath).replace(/^\.\//, '');
	if (rel === '' || rel === '.' || rel.startsWith('../') || rel.startsWith('/') || /^[A-Za-z]:\//.test(rel)) {
		return absolute;
	}
	if (input.workspaceCount > 1) {
		return `${input.folderName}/${rel}`;
	}
	return rel;
}

export function formatLocation(path: string, oneBasedLine: number, oneBasedCell?: number): string {
	if (oneBasedCell !== undefined) {
		return `${path}:cell${oneBasedCell}:${oneBasedLine}`;
	}
	return `${path}:${oneBasedLine}`;
}

export function formatFileLocation(path: string, zeroBasedLine: number): string {
	return formatLocation(path, zeroBasedLine + 1);
}

export function formatNotebookLocation(path: string, zeroBasedCellIndex: number, zeroBasedLine: number): string {
	return formatLocation(path, zeroBasedLine + 1, zeroBasedCellIndex + 1);
}

export function rangeOverlapsLine(startLine: number, endLine: number, endCharacter: number, line: number): boolean {
	if (startLine > line || endLine < line) {
		return false;
	}
	// A range ending at column 0 covers no characters on that line.
	if (endLine === line && endCharacter === 0 && startLine < line) {
		return false;
	}
	return true;
}

export interface Positioned {
	startLine: number;
	startCharacter: number;
}

export function sortByStart<T extends Positioned>(items: readonly T[]): T[] {
	return items
		.map((item, index) => ({ item, index }))
		.sort((a, b) => {
			if (a.item.startLine !== b.item.startLine) {
				return a.item.startLine - b.item.startLine;
			}
			if (a.item.startCharacter !== b.item.startCharacter) {
				return a.item.startCharacter - b.item.startCharacter;
			}
			return a.index - b.index;
		})
		.map(({ item }) => item);
}

export interface LineError extends Positioned {
	severity: number;
	endLine: number;
	endCharacter: number;
}

export function selectLineErrors<T extends LineError>(items: readonly T[], cursorLine: number): T[] {
	return sortByStart(items.filter((item) =>
		item.severity === ERROR_SEVERITY &&
		rangeOverlapsLine(item.startLine, item.endLine, item.endCharacter, cursorLine),
	));
}

export function codeText(code: string | number | { value: string | number } | undefined): string | undefined {
	if (code === undefined) {
		return undefined;
	}
	if (typeof code === 'number') {
		return String(code);
	}
	if (typeof code === 'string') {
		return code.length > 0 ? code : undefined;
	}
	return codeText(code.value);
}

export function formatSourceCode(source: string | undefined, code: string | undefined): string | undefined {
	const hasSource = source !== undefined && source.length > 0;
	const hasCode = code !== undefined && code.length > 0;
	if (hasSource && hasCode) {
		return `${source} ${code}`;
	}
	if (hasSource) {
		return source;
	}
	if (hasCode) {
		return code;
	}
	return undefined;
}

export function formatDiagnosticCitation(input: {
	location: string;
	message: string;
	source?: string;
	code?: string;
}): string {
	const head = input.message.length > 0 ? `${input.location} ${input.message}` : input.location;
	const tail = formatSourceCode(input.source, input.code);
	return tail === undefined ? head : `${head}\n${tail}`;
}

export function joinDiagnosticCitations(citations: readonly string[]): string {
	return citations.join('\n\n');
}
