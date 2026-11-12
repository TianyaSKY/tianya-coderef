import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	assembleCitationPath,
	codeText,
	copiedDiagnosticMessage,
	ERROR_SEVERITY,
	formatDiagnosticCitation,
	formatFileLocation,
	formatNotebookLocation,
	isIpynbPath,
	joinDiagnosticCitations,
	MSG,
	selectLineErrors,
} from './citation';

test('code citation is path and 1-based line with no trailing newline', () => {
	const text = formatFileLocation('memory/03_longterm_memory.py', 16);
	assert.equal(text, 'memory/03_longterm_memory.py:17');
	assert.equal(text.endsWith('\n'), false);
});

test('ipynb citation counts every cell from 1 and uses the cell line', () => {
	assert.equal(
		formatNotebookLocation('memory/03_longterm_memory.ipynb', 2, 16),
		'memory/03_longterm_memory.ipynb:cell3:17',
	);
});

test('single-root path omits the workspace folder name', () => {
	assert.equal(assembleCitationPath({
		scheme: 'file',
		fsPath: '/ws/memory/03_longterm_memory.py',
		relativePath: 'memory/03_longterm_memory.py',
		folderName: 'Project',
		workspaceCount: 1,
	}), 'memory/03_longterm_memory.py');
});

test('multi-root path prefixes the configured folder name without quotes', () => {
	assert.equal(assembleCitationPath({
		scheme: 'file',
		fsPath: '/ws/backend/src/app.py',
		relativePath: 'src/app.py',
		folderName: 'backend',
		workspaceCount: 2,
	}), 'backend/src/app.py');
	assert.equal(assembleCitationPath({
		scheme: 'file',
		fsPath: '/ws/my project/src/app.py',
		relativePath: 'src/app.py',
		folderName: 'my project',
		workspaceCount: 2,
	}), 'my project/src/app.py');
});

test('outside the workspace uses a slash absolute path and no file URI', () => {
	assert.equal(assembleCitationPath({
		scheme: 'file',
		fsPath: 'C:\\Users\\My Documents\\a.py',
		workspaceCount: 0,
	}), 'C:/Users/My Documents/a.py');
	assert.equal(assembleCitationPath({
		scheme: 'vscode-remote',
		fsPath: '/home/tianya/a.py',
		workspaceCount: 0,
	}), '/home/tianya/a.py');
});

test('remote files in a workspace stay relative and drop the authority', () => {
	assert.equal(assembleCitationPath({
		scheme: 'vscode-remote',
		fsPath: '/home/tianya/Project/memory/03_longterm_memory.py',
		relativePath: 'memory/03_longterm_memory.py',
		folderName: 'CodeRef',
		workspaceCount: 1,
	}), 'memory/03_longterm_memory.py');
});

test('untitled, output, git, and interactive documents cannot be cited', () => {
	for (const scheme of ['untitled', 'output', 'git', 'vscode-interactive']) {
		assert.equal(assembleCitationPath({
			scheme,
			fsPath: '/tmp/ignored.py',
			relativePath: 'ignored.py',
			folderName: 'ws',
			workspaceCount: 1,
		}), undefined);
	}
});

test('backslash relative paths are normalized and a leading dot-slash is removed', () => {
	assert.equal(assembleCitationPath({
		scheme: 'file',
		fsPath: 'C:\\ws\\memory\\a.py',
		relativePath: '.\\memory\\a.py',
		folderName: 'ws',
		workspaceCount: 1,
	}), 'memory/a.py');
});

test('only ipynb paths use cell coordinates', () => {
	assert.equal(isIpynbPath('memory/03_longterm_memory.ipynb'), true);
	assert.equal(isIpynbPath('C:\\notes\\Demo.IPYNB'), true);
	assert.equal(isIpynbPath('memory/03_longterm_memory.py'), false);
	assert.equal(isIpynbPath('notes/file.ipynb.bak'), false);
});

test('diagnostic citation keeps the message and puts source and code on the next line', () => {
	const text = formatDiagnosticCitation({
		location: 'persist_diagloge.py:15',
		message: '“create_agent”的重载与提供的参数不匹配\n  参数类型:(BaseChatModel, SqliteSaver)',
		source: 'Pylance',
		code: 'reportCallIssue',
	});
	assert.equal(text, [
		'persist_diagloge.py:15 “create_agent”的重载与提供的参数不匹配',
		'  参数类型:(BaseChatModel, SqliteSaver)',
		'Pylance reportCallIssue',
	].join('\n'));
	assert.equal(text.endsWith('\n'), false);
});

test('notebook diagnostic location uses the diagnostic start line inside the cell', () => {
	assert.equal(
		formatNotebookLocation('persist_diagloge.ipynb', 2, 14),
		'persist_diagloge.ipynb:cell3:15',
	);
});

test('empty message is still cited, and missing source or code is omitted', () => {
	assert.equal(formatDiagnosticCitation({
		location: 'a.py:1',
		message: '',
		source: 'Pylance',
		code: 'reportCallIssue',
	}), 'a.py:1\nPylance reportCallIssue');
	assert.equal(formatDiagnosticCitation({
		location: 'a.py:1',
		message: 'boom',
		source: 'Pylance',
	}), 'a.py:1 boom\nPylance');
	assert.equal(formatDiagnosticCitation({
		location: 'a.py:1',
		message: 'boom',
		code: 'reportCallIssue',
	}), 'a.py:1 boom\nreportCallIssue');
	assert.equal(formatDiagnosticCitation({
		location: 'a.py:1',
		message: 'boom',
	}), 'a.py:1 boom');
});

test('code keeps the value only, including numeric zero', () => {
	assert.equal(codeText({ value: 'reportCallIssue', target: 'https://example.invalid' } as { value: string }), 'reportCallIssue');
	assert.equal(codeText(2322), '2322');
	assert.equal(codeText(0), '0');
	assert.equal(codeText(''), undefined);
	assert.equal(codeText(undefined), undefined);
});

test('multiple diagnostics are separated by one blank line and not trailed by one', () => {
	const joined = joinDiagnosticCitations([
		'a.py:15 first\nPylance reportCallIssue',
		'a.py:10 second\nESLint no-undef',
	]);
	assert.equal(joined, 'a.py:15 first\nPylance reportCallIssue\n\na.py:10 second\nESLint no-undef');
});

test('line overlap includes the cursor line even off the token, and excludes other severities', () => {
	const selected = selectLineErrors([
		{ severity: 1, startLine: 14, startCharacter: 0, endLine: 14, endCharacter: 12, message: 'warn' },
		{ severity: ERROR_SEVERITY, startLine: 14, startCharacter: 8, endLine: 14, endCharacter: 20, message: 'token' },
		{ severity: ERROR_SEVERITY, startLine: 10, startCharacter: 0, endLine: 16, endCharacter: 1, message: 'span' },
		{ severity: ERROR_SEVERITY, startLine: 13, startCharacter: 0, endLine: 14, endCharacter: 0, message: 'ends before' },
		{ severity: ERROR_SEVERITY, startLine: 14, startCharacter: 8, endLine: 14, endCharacter: 20, message: 'same-pos-later' },
		{ severity: ERROR_SEVERITY, startLine: 20, startCharacter: 0, endLine: 20, endCharacter: 3, message: 'other line' },
	], 14);
	assert.deepEqual(selected.map((item) => item.message), ['span', 'token', 'same-pos-later']);
});

test('status text matches the agreed copy', () => {
	assert.equal(MSG.copiedCode, '已复制代码引用');
	assert.equal(copiedDiagnosticMessage(1), '已复制诊断引用');
	assert.equal(copiedDiagnosticMessage(3), '已复制 3 条诊断引用');
	assert.equal(MSG.cannotCite, '无法生成引用');
	assert.equal(MSG.noDiagnostic, '没有可复制的诊断');
});
