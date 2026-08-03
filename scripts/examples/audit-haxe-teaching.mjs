#!/usr/bin/env node

import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const examplesRoot = path.join(repositoryRoot, "examples");

async function collectHaxeFiles(directory) {
	const entries = await readdir(directory, {withFileTypes: true});
	const nested = await Promise.all(entries.map(async entry => {
		const absolute = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			if (
				entry.name === ".next"
				|| entry.name === ".nextjshx"
				|| entry.name === "node_modules"
				|| entry.name === "src-gen"
			) {
				return [];
			}
			return collectHaxeFiles(absolute);
		}
		return entry.isFile() && entry.name.endsWith(".hx") ? [absolute] : [];
	}));
	return nested.flat();
}

function lineOf(source, offset) {
	return source.slice(0, offset).split("\n").length;
}

function matchingBrace(source, openingOffset) {
	let depth = 0;
	let quote = null;
	let escaped = false;
	let lineComment = false;
	let blockComment = false;

	for (let index = openingOffset; index < source.length; index += 1) {
		const character = source[index];
		const next = source[index + 1];
		if (lineComment) {
			if (character === "\n") lineComment = false;
			continue;
		}
		if (blockComment) {
			if (character === "*" && next === "/") {
				blockComment = false;
				index += 1;
			}
			continue;
		}
		if (quote !== null) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === quote) quote = null;
			continue;
		}
		if (character === "/" && next === "/") {
			lineComment = true;
			index += 1;
			continue;
		}
		if (character === "/" && next === "*") {
			blockComment = true;
			index += 1;
			continue;
		}
		if (character === '"' || character === "'") {
			quote = character;
			continue;
		}
		if (character === "{") depth += 1;
		if (character === "}" && --depth === 0) return index;
	}
	return -1;
}

function hasAdjacentDoc(source, declarationOffset) {
	const prefix = source.slice(0, declarationOffset)
		.replace(/(?:[ \t]*(?:@:[^\n]+|#(?:if|elseif|else|end)[^\n]*)[ \t]*\n?)+$/g, "")
		.trimEnd();
	return /\*\/$/.test(prefix) && /\/\*\*[\s\S]*\*\/$/.test(prefix);
}

function topLevelMembers(body) {
	const members = [];
	let depth = 0;
	for (const [index, line] of body.split("\n").entries()) {
		const trimmed = line.trim();
		if (depth === 0) {
			const match = /^(?:(public|private)\s+)?(?:(static)\s+)?(?:inline\s+|final\s+|macro\s+|override\s+|dynamic\s+)*(function|var|final)\s+([A-Za-z_]\w*)/.exec(trimmed);
			if (match) {
				members.push({line: index + 1, name: match[4], isStatic: match[2] === "static"});
			}
		}
		for (const character of trimmed.replace(/(["'])(?:\\.|(?!\1).)*\1/g, "")) {
			if (character === "{") depth += 1;
			else if (character === "}") depth -= 1;
		}
	}
	return members;
}

function auditFile(absolutePath, source) {
	const relativePath = path.relative(repositoryRoot, absolutePath);
	const declarations = [];
	const declarationPattern = /(^|\n)([ \t]*)(?:(extern)\s+)?class\s+([A-Za-z_]\w*)([^{]*)\{/g;
	for (const match of source.matchAll(declarationPattern)) {
		const openingOffset = match.index + match[0].lastIndexOf("{");
		const closingOffset = matchingBrace(source, openingOffset);
		if (closingOffset < 0) continue;
		const declarationOffset = match.index + match[1].length;
		const body = source.slice(openingOffset + 1, closingOffset);
		const members = topLevelMembers(body);
		const isStaticShell = !match[3]
			&& !/\b(?:extends|implements)\b/.test(match[5])
			&& members.length > 0
			&& members.every(member => member.isStatic);
		const nearbyPrefix = source.slice(Math.max(0, declarationOffset - 800), declarationOffset);
		const retainedClassHint = /@:next\.[A-Za-z]/.test(nearbyPrefix)
			? "NextJsHx type metadata"
			: /@:next\.hook\b/.test(body)
				? "current Hook analyzer bridge"
			: /Main$/.test(match[4])
				? "Haxe -main entrypoint"
				: null;
		declarations.push({
			kind: "class",
			name: match[4],
			line: lineOf(source, declarationOffset),
			documented: hasAdjacentDoc(source, declarationOffset),
			staticShell: isStaticShell,
			retainedClassHint,
			members,
		});
	}
	const complexFunctions = [];
	const functionPattern = /\bfunction\s+([A-Za-z_]\w*)(?:\s*<[^>{}]+>)?\s*\([^;{}]*\)\s*(?::[^;={]+)?\s*\{/g;
	for (const match of source.matchAll(functionPattern)) {
		const openingOffset = match.index + match[0].lastIndexOf("{");
		const closingOffset = matchingBrace(source, openingOffset);
		if (closingOffset < 0) continue;
		const startLine = lineOf(source, match.index);
		const endLine = lineOf(source, closingOffset);
		const declarationLineOffset = source.lastIndexOf("\n", match.index) + 1;
		if (endLine - startLine + 1 < 20 || hasAdjacentDoc(source, declarationLineOffset)) continue;
		complexFunctions.push({
			name: match[1],
			line: startLine,
			endLine,
			lines: endLine - startLine + 1,
		});
	}
	return {path: relativePath, declarations, complexFunctions};
}

const files = (await collectHaxeFiles(examplesRoot)).sort();
const audits = await Promise.all(files.map(async absolutePath =>
	auditFile(absolutePath, await readFile(absolutePath, "utf8"))));
const classes = audits.flatMap(file => file.declarations.map(declaration => ({...declaration, path: file.path})));
const report = {
	haxeFiles: files.length,
	classes: classes.length,
	staticShells: classes.filter(candidate => candidate.staticShell),
	undocumentedClasses: classes.filter(candidate => !candidate.documented),
	undocumentedComplexFunctions: audits.flatMap(file =>
		file.complexFunctions.map(candidate => ({...candidate, path: file.path}))),
};

if (process.argv.includes("--json")) {
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
	console.log(`[examples:audit] ${report.haxeFiles} Haxe files; ${report.classes} classes`);
	console.log(`[examples:audit] ${report.staticShells.length} all-static class candidates`);
	for (const candidate of report.staticShells) {
		const hint = candidate.retainedClassHint === null ? "module candidate" : `retain candidate: ${candidate.retainedClassHint}`;
		console.log(`  ${candidate.path}:${candidate.line} ${candidate.name} — ${hint}`);
	}
	console.log(`[examples:audit] ${report.undocumentedClasses.length} classes without adjacent HaxeDoc`);
	for (const candidate of report.undocumentedClasses) {
		console.log(`  ${candidate.path}:${candidate.line} ${candidate.name}`);
	}
	console.log(`[examples:audit] ${report.undocumentedComplexFunctions.length} complex functions without adjacent HaxeDoc`);
	for (const candidate of report.undocumentedComplexFunctions) {
		console.log(`  ${candidate.path}:${candidate.line} ${candidate.name} (${candidate.lines} lines)`);
	}
}
