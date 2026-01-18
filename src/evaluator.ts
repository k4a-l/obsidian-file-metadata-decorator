import type { App } from "obsidian";
import type {
	EvaluateRuleResult,
	FileFunctionRuleConfig,
	IndividualRuleConfig,
	MetadataInfo,
	Rule,
} from "./types";
import { logging, splitByPosNeg } from "./utils";

// ファイルキャッシュ
const fileCache = new Map<string, string>();

export function evaluateRule(
	app: App,
	rule: Rule,
	metadata: MetadataInfo,
): EvaluateRuleResult | null {
	if (rule.config.type === "individual") {
		return evaluateIndividualRule(rule.config, metadata);
	}
	if (rule.config.type === "function-file") {
		return evaluateFileFunctionRule(app, rule.config, metadata);
	}
	return null;
}

async function loadFileContent(app: App, filePath: string): Promise<string> {
	// キャッシュをチェック
	if (fileCache.has(filePath)) {
		const cached = fileCache.get(filePath);
		if (cached !== undefined) {
			return cached;
		}
	}

	try {
		const content = await app.vault.adapter.read(filePath);
		fileCache.set(filePath, content);
		return content;
	} catch (error) {
		console.error(`Failed to load file: ${filePath}`, error);
		throw error;
	}
}

// 外部から呼び出し可能なプリロード関数
export async function preloadRuleFile(
	app: App,
	filePath: string,
): Promise<void> {
	await loadFileContent(app, filePath);
}

function evaluateFileFunctionRule(
	app: App,
	config: FileFunctionRuleConfig,
	metadata: MetadataInfo,
): EvaluateRuleResult | null {
	try {
		const cachedContent = fileCache.get(config.filePath);
		console.log({ cachedContent });
		if (!cachedContent) {
			console.warn(
				`File not cached: ${config.filePath}. Loading asynchronously...`,
			);
			// 非同期でロード（次回の評価で使用される）
			loadFileContent(app, config.filePath).catch((e) =>
				console.error("Failed to load file:", e),
			);
			return null;
		}

		// ファイル内容は即時実行関数: (function() { ... return func; })()
		// これを実行して関数を取得
		const getFunction = new Function(`return ${cachedContent}`);
		const evaluateFunc = getFunction() as (
			metadata: MetadataInfo,
		) => EvaluateRuleResult;

		// 取得した関数でmetadataを評価
		const result = evaluateFunc(metadata);

		if (result && typeof result === "object") {
			return result;
		}

		return null;
	} catch (error) {
		console.error("File function evaluation error:", error);
		return null;
	}
}

function evaluateIndividualRule(
	config: IndividualRuleConfig,
	metadata: MetadataInfo,
): EvaluateRuleResult | null {
	const { tags, path, title, frontmatter } = metadata;

	const tagsSplit = splitByPosNeg(config.tags);
	const pathsSplit = splitByPosNeg(config.paths);
	const titleSplit = splitByPosNeg(config.titles);

	const negativeMatch =
		tagsSplit.neg.some((tag) => tags.includes(tag)) ||
		pathsSplit.neg.some((p) => path.startsWith(p)) ||
		titleSplit.neg.some((t) => title.includes(t));

	if (negativeMatch) {
		logging("negative matched");
		return null;
	}

	// 個別ルールの場合、クラス名は呼び出し元(main.ts)でrule.classNameが適用されるため
	// ここではマッチしたこと(=空のEvaluateRuleResult)を返せばよい
	const matchedResult: EvaluateRuleResult = { classNames: [] };

	if (tagsSplit.pos.some((tag) => tags.includes(tag))) {
		logging("tag matched");
		return matchedResult;
	}

	if (pathsSplit.pos.some((p) => path.startsWith(p))) {
		logging("path matched");
		return matchedResult;
	}

	if (titleSplit.pos.some((t) => title.includes(t))) {
		logging("title matched");
		return matchedResult;
	}

	type SingleValue = string | number | boolean;
	const isSingleValue = (v: unknown): v is SingleValue =>
		typeof v === "string" || typeof v === "number" || typeof v === "boolean";

	const isMatch = (v1: SingleValue, v2: SingleValue) => {
		return v1.toString() === v2.toString();
	};

	if (
		Object.entries(config.frontmatter).some(([sKey, sValue]) => {
			const fValue = frontmatter[sKey];
			if (isSingleValue(sValue)) {
				if (isSingleValue(fValue)) {
					return isMatch(sValue, fValue);
				}
				if (Array.isArray(fValue)) {
					return fValue.some((v) => isMatch(sValue, v));
				}
			} else if (Array.isArray(sValue)) {
				if (isSingleValue(fValue)) {
					return sValue.some((v) => isMatch(v, fValue));
				}
				if (Array.isArray(fValue)) {
					return sValue.some((v) => fValue.some((f) => isMatch(v, f)));
				}
			}
			return false;
		})
	) {
		return matchedResult;
	}

	logging("no matched", {
		title,
		f: config.titles,
	});

	return null;
}
