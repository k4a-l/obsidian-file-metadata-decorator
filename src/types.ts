export type OrArray<T> = T | T[];

// メタデータ情報の型定義
export interface MetadataInfo {
	frontmatter: Record<string, unknown>;
	path: string;
	title: string;
	tags: string[];
}

// 評価結果の型定義
export type DynamicElement = {
	className?: string;
	text?: string;
	style?: Partial<CSSStyleDeclaration>;
};

export type EvaluateRuleResult = {
	classNames: string[];
	// cssVariables?: Record<string, string>;
	elements?: DynamicElement[];
};

// 評価関数の型定義
export type EvaluateFunction = (metadata: MetadataInfo) => EvaluateRuleResult;

// ルールの入力タイプ
export type RuleInputType = "individual" | "function-file";

// 個別入力方式のルール設定
export interface IndividualRuleConfig {
	type: "individual";
	tags: string[];
	paths: string[];
	titles: string[];
	frontmatter: Record<string, OrArray<string | number | boolean>>;
}

// ファイル関数方式のルール設定
export interface FileFunctionRuleConfig {
	type: "function-file";
	filePath: string;
}

// ルール設定の共通部分
export interface BaseRule {
	id: string;
	name: string;
	enabled: boolean;
	className: string;
	config: IndividualRuleConfig | FileFunctionRuleConfig;
}

export type Rule = BaseRule;

export interface MyPluginSettings {
	rules: Rule[];
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	rules: [],
};
