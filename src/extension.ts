import * as vscode from 'vscode';
import {
	assembleCitationPath,
	codeText,
	copiedDiagnosticMessage,
	FAILURE_MS,
	formatCodeCitation,
	formatDiagnosticCitation,
	formatFileLocation,
	formatNotebookLocation,
	formatNotebookSelection,
	isIpynbPath,
	joinDiagnosticCitations,
	MSG,
	selectLineErrors,
	SUCCESS_MS,
} from './citation';

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('coderef.copyCodeCitation', (notebookCells?: boolean) => copyCodeCitation(notebookCells)),
		vscode.commands.registerCommand('coderef.copyDiagnosticCitation', () => copyDiagnosticCitation()),
	);
}

function fail(message: string): void {
	vscode.window.setStatusBarMessage(message, FAILURE_MS);
}

async function copyText(text: string, success: string): Promise<void> {
	try {
		await vscode.env.clipboard.writeText(text);
	} catch {
		fail(MSG.cannotCite);
		return;
	}
	vscode.window.setStatusBarMessage(success, SUCCESS_MS);
}

interface Anchor {
	path: string;
	editor: vscode.TextEditor;
	cellIndex?: number;
}

function anchor(): Anchor | undefined {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return undefined;
	}
	const cell = findCell(editor.document);
	if (cell) {
		// Cell-local lines are not file lines. Only .ipynb has a cell citation form.
		if (!isIpynbPath(cell.notebook.uri.fsPath)) {
			return undefined;
		}
		const path = pathFor(cell.notebook.uri);
		if (!path) {
			return undefined;
		}
		return { path, editor, cellIndex: cell.index };
	}
	const path = pathFor(editor.document.uri);
	if (!path) {
		return undefined;
	}
	return { path, editor };
}

function pathFor(uri: vscode.Uri): string | undefined {
	const folder = vscode.workspace.getWorkspaceFolder(uri);
	const workspaceCount = folder ? vscode.workspace.workspaceFolders?.length ?? 0 : 0;
	return assembleCitationPath({
		scheme: uri.scheme,
		fsPath: uri.fsPath,
		relativePath: folder ? vscode.workspace.asRelativePath(uri, false) : undefined,
		folderName: folder?.name,
		workspaceCount,
	});
}

function findCell(document: vscode.TextDocument): { notebook: vscode.NotebookDocument; index: number } | undefined {
	const key = document.uri.toString();
	for (const notebook of vscode.workspace.notebookDocuments) {
		for (let index = 0; index < notebook.cellCount; index++) {
			if (notebook.cellAt(index).document.uri.toString() === key) {
				return { notebook, index };
			}
		}
	}
	return undefined;
}

function locationFor(found: Anchor, zeroBasedLine: number): string {
	if (found.cellIndex !== undefined) {
		return formatNotebookLocation(found.path, found.cellIndex, zeroBasedLine);
	}
	return formatFileLocation(found.path, zeroBasedLine);
}

async function copyCodeCitation(notebookCells = false): Promise<void> {
	const notebookEditor = vscode.window.activeNotebookEditor;
	const textEditor = vscode.window.activeTextEditor;
	const activeCell = textEditor && findCell(textEditor.document);
	if (notebookEditor && (notebookCells || !textEditor || activeCell?.notebook === notebookEditor.notebook)) {
		const ranges = notebookEditor.selections;
		const selectedCells = new Set<number>();
		for (const range of ranges) {
			for (let index = range.start; index < range.end; index++) {
				selectedCells.add(index);
			}
		}
		if (selectedCells.size > 1 || ((notebookCells || !textEditor) && selectedCells.size > 0)) {
			const uri = notebookEditor.notebook.uri;
			const path = isIpynbPath(uri.fsPath) ? pathFor(uri) : undefined;
			if (!path) {
				fail(MSG.cannotCite);
				return;
			}
			await copyText(formatNotebookSelection(path, ranges, notebookEditor.notebook), MSG.copiedCode);
			return;
		}
	}
	const found = anchor();
	if (!found) {
		fail(MSG.cannotCite);
		return;
	}
	await copyText(formatCodeCitation(found.path, found.editor.selection, found.cellIndex), MSG.copiedCode);
}

async function copyDiagnosticCitation(): Promise<void> {
	const found = anchor();
	if (!found) {
		fail(MSG.cannotCite);
		return;
	}
	const selected = selectLineErrors(
		vscode.languages.getDiagnostics(found.editor.document.uri).map((diagnostic) => ({
			severity: diagnostic.severity,
			startLine: diagnostic.range.start.line,
			startCharacter: diagnostic.range.start.character,
			endLine: diagnostic.range.end.line,
			endCharacter: diagnostic.range.end.character,
			message: diagnostic.message,
			source: diagnostic.source,
			code: codeText(diagnostic.code),
		})),
		found.editor.selection.active.line,
	);
	if (selected.length === 0) {
		fail(MSG.noDiagnostic);
		return;
	}
	const text = joinDiagnosticCitations(selected.map((diagnostic) => formatDiagnosticCitation({
		location: locationFor(found, diagnostic.startLine),
		message: diagnostic.message,
		source: diagnostic.source,
		code: diagnostic.code,
	})));
	await copyText(text, copiedDiagnosticMessage(selected.length));
}
