import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	defineTool,
	type ExtensionAPI,
	formatSize,
	keyHint,
	type Theme,
	truncateTail,
	truncateToVisualLines,
	type TruncationResult,
} from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { Container, Text, truncateToWidth } from "@mariozechner/pi-tui";
import { runWsCommand } from "../lib/cdp/ws.js";

const PREVIEW_LINES = 5;

interface EgoCdpWsToolDetails {
	timeout: number;
	truncation?: TruncationResult;
	fullOutputPath?: string;
}

type ResultRenderState = {
	cachedWidth: number | undefined;
	cachedLines: string[] | undefined;
	cachedSkipped: number | undefined;
};

class EgoCdpWsResultRenderComponent extends Container {
	state: ResultRenderState = {
		cachedWidth: undefined,
		cachedLines: undefined,
		cachedSkipped: undefined,
	};
}

function getTempFilePath(): string {
	const id = randomBytes(8).toString("hex");
	return path.join(tmpdir(), `pi-ego-cdp-${id}.log`);
}

function ensureParentDir(filePath: string) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeTextFile(filePath: string, text: string) {
	ensureParentDir(filePath);
	fs.writeFileSync(filePath, text);
}

function stringifyInline(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function parseCdpMessage(message: string): {
	method?: string;
	id?: string;
	sessionId?: string;
	params?: unknown;
	raw: string;
} {
	try {
		const parsed = JSON.parse(message);
		if (!parsed || typeof parsed !== "object") return { raw: message };
		return {
			method: typeof parsed.method === "string" ? parsed.method : undefined,
			id: parsed.id === undefined ? undefined : String(parsed.id),
			sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
			params: parsed.params,
			raw: message,
		};
	} catch {
		return { raw: message };
	}
}

function getTruncationNotice(truncation: TruncationResult, fullOutputPath: string): string {
	const startLine = truncation.totalLines - truncation.outputLines + 1;
	const endLine = truncation.totalLines;
	if (truncation.lastLinePartial) {
		return `\n\n[Showing last ${formatSize(truncation.outputBytes)} of line ${endLine}. Full output: ${fullOutputPath}]`;
	}
	if (truncation.truncatedBy === "lines") {
		return `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${fullOutputPath}]`;
	}
	return `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit). Full output: ${fullOutputPath}]`;
}

function finalizeSuccessOutput(response: string, timeout: number) {
	const normalized = response || "(no output)";
	const truncation = truncateTail(normalized, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	let fullOutputPath: string | undefined;
	if (truncation.truncated) {
		fullOutputPath = getTempFilePath();
		writeTextFile(fullOutputPath, normalized);
	}

	return {
		content: [{ type: "text", text: truncation.content || "(no output)" }],
		details: {
			timeout,
			truncation: truncation.truncated ? truncation : undefined,
			fullOutputPath,
		} satisfies EgoCdpWsToolDetails,
	};
}

function finalizeErrorOutput(message: string): string {
	const normalized = message || "(no output)";
	const truncation = truncateTail(normalized, {
		maxLines: DEFAULT_MAX_LINES,
		maxBytes: DEFAULT_MAX_BYTES,
	});

	if (!truncation.truncated) {
		return truncation.content || "(no output)";
	}

	const fullOutputPath = getTempFilePath();
	writeTextFile(fullOutputPath, normalized);
	return `${truncation.content || "(no output)"}${getTruncationNotice(truncation, fullOutputPath)}`;
}

function rebuildResultRenderComponent(
	component: EgoCdpWsResultRenderComponent,
	result: {
		content: Array<{ type: string; text?: string }>;
		details?: EgoCdpWsToolDetails;
	},
	options: { expanded: boolean },
	theme: Theme,
): void {
	const state = component.state;
	component.clear();

	const textContent = result.content.find((part) => part.type === "text");
	const output = textContent?.text?.trim() ?? "";

	if (output) {
		const styledOutput = output
			.split("\n")
			.map((line) => theme.fg("toolOutput", line))
			.join("\n");

		if (options.expanded) {
			component.addChild(new Text(`\n${styledOutput}`, 0, 0));
		} else {
			component.addChild({
				render: (width: number) => {
					if (state.cachedLines === undefined || state.cachedWidth !== width) {
						const preview = truncateToVisualLines(styledOutput, PREVIEW_LINES, width);
						state.cachedLines = preview.visualLines;
						state.cachedSkipped = preview.skippedCount;
						state.cachedWidth = width;
					}
					if (state.cachedSkipped && state.cachedSkipped > 0) {
						const hint =
							theme.fg("muted", `... (${state.cachedSkipped} earlier lines,`) +
							` ${keyHint("app.tools.expand", "to expand")})`;
						return ["", truncateToWidth(hint, width, "..."), ...(state.cachedLines ?? [])];
					}
					return ["", ...(state.cachedLines ?? [])];
				},
				invalidate: () => {
					state.cachedWidth = undefined;
					state.cachedLines = undefined;
					state.cachedSkipped = undefined;
				},
			});
		}
	}

	const details = result.details;
	if (details?.truncation?.truncated || details?.fullOutputPath) {
		const warnings: string[] = [];
		if (details.fullOutputPath) {
			warnings.push(`Full output: ${details.fullOutputPath}`);
		}
		if (details.truncation?.truncated) {
			if (details.truncation.truncatedBy === "lines") {
				warnings.push(`Truncated: showing ${details.truncation.outputLines} of ${details.truncation.totalLines} lines`);
			} else {
				warnings.push(
					`Truncated: ${details.truncation.outputLines} lines shown (${formatSize(details.truncation.maxBytes ?? DEFAULT_MAX_BYTES)} limit)`,
				);
			}
		}
		component.addChild(new Text(`\n${theme.fg("warning", `[${warnings.join(". ")}]`)}`, 0, 0));
	}
}

const egoCdpWsTool = defineTool({
	name: "ego_cdp_ws",
	label: "ego-cdp WS",
	description:
		"Send a raw Chrome DevTools Protocol JSON message through ego-cdp's persistent WebSocket daemon. Output is truncated to the last 2000 lines or 50KB (whichever is hit first). If truncated, full output is saved to a temp file.",
	promptSnippet:
		"Send raw Chrome DevTools Protocol JSON-RPC messages through the ego-cdp daemon and return the raw JSON response.",
	promptGuidelines: [
		"Use ego_cdp_ws for Chrome DevTools Protocol commands once ego-cdp is running; prefer it over invoking `bin/ego-cdp ws ...` through bash.",
		"Use bash only for ego-cdp lifecycle commands such as `bin/ego-cdp start`, `bin/ego-cdp start --user`, `bin/ego-cdp status`, and `bin/ego-cdp stop`.",
	],
	parameters: Type.Object({
		message: Type.String({
			description:
				'Raw CDP JSON message, for example {"id":1,"method":"Browser.getVersion"}',
		}),
		timeout: Type.Optional(
			Type.Number({
				description: "Timeout in seconds. Defaults to 60.",
				minimum: 1,
			}),
		),
	}),
	renderCall(args, theme, _context) {
		const cdp = parseCdpMessage(args.message);
		let text = theme.fg("toolTitle", theme.bold("ego_cdp_ws "));
		text += theme.fg("accent", cdp.method ?? cdp.raw);

		const meta: string[] = [];
		if (cdp.id) meta.push(`id=${cdp.id}`);
		if (cdp.sessionId) meta.push(`session=${cdp.sessionId}`);
		if (args.timeout && args.timeout !== 60) meta.push(`timeout=${args.timeout}s`);
		if (meta.length) text += " " + theme.fg("dim", `(${meta.join(", ")})`);

		if (cdp.params && typeof cdp.params === "object" && Object.keys(cdp.params as object).length > 0) {
			text += `\n${theme.fg("dim", `  params: ${stringifyInline(cdp.params)}`)}`;
		}

		return new Text(text, 0, 0);
	},
	async execute(_toolCallId, params) {
		const timeout = params.timeout ?? 60;
		try {
			const response = await runWsCommand({
				message: params.message,
				timeout: timeout * 1000,
			});
			return finalizeSuccessOutput(response, timeout);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(finalizeErrorOutput(message));
		}
	},
	renderResult(result, options, theme, context) {
		const component =
			(context.lastComponent as EgoCdpWsResultRenderComponent | undefined) ?? new EgoCdpWsResultRenderComponent();
		rebuildResultRenderComponent(component, result as { content: Array<{ type: string; text?: string }>; details?: EgoCdpWsToolDetails }, { expanded: options.expanded }, theme);
		component.invalidate();
		return component;
	},
});

export default function egoCdpExtension(pi: ExtensionAPI) {
	pi.registerTool(egoCdpWsTool);
}
