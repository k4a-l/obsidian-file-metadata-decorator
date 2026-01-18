import {
	type App,
	type EventRef,
	MarkdownView,
	Notice,
	Plugin,
	type TAbstractFile,
} from "obsidian";
import { evaluateRule } from "./src/evaluator";
import { DynamicClassnameSettingTab } from "./src/settings";
import type { EvaluateRuleResult, MetadataInfo, MyPluginSettings } from "./src/types";
import { DEFAULT_SETTINGS } from "./src/types";
import { splitByPosNeg } from "./src/utils";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	private eventRefs: EventRef[];

	async onload() {
		await this.loadSettings();

		// ファイルモードのルールファイルをプリロード
		await this.preloadRuleFiles();

		this.addSettingTab(new DynamicClassnameSettingTab(this.app, this));

		this.eventRefs = [
			this.app.workspace.on("file-open", () => {
				this.exec();
			}),
			this.app.metadataCache.on("resolve", (f) => {
				const currentFile = this.app.workspace.getActiveFile();
				if (currentFile?.name === f.name) {
					this.exec();
				}
			}),
			this.app.vault.on("rename", (f) => {
				this.exec(f);
			}),
		];
	}
	onunload() {
		for (const ref of this.eventRefs) {
			this.app.metadataCache.offref(ref);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private async preloadRuleFiles() {
		const { preloadRuleFile } = await import("./src/evaluator");

		for (const rule of this.settings.rules) {
			if (rule.config.type === "function-file") {
				try {
					await preloadRuleFile(this.app, rule.config.filePath);
				} catch (error) {
					const errorMsg = `Failed to load rule file for "${rule.name}": ${rule.config.filePath}`;
					console.error(errorMsg, error);
					
					// 起動時にポップアップエラーを表示
					new Notice(
						`⚠️ Dynamic Classname Plugin\n${errorMsg}\n${error instanceof Error ? error.message : String(error)}`,
						10000, // 10秒間表示
					);
				}
			}
		}
	}

	private exec(tAbstractFile?: TAbstractFile) {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);

		const activeFile = markdownView?.file;
		const activeFileCache = activeFile
			? this.app.metadataCache.getFileCache(activeFile)
			: undefined;

		const title = activeFile?.basename ?? tAbstractFile?.name;
		const path = activeFile?.path ?? tAbstractFile?.path;

		if (!title || !path) return;

		const tags = activeFileCache
			? (activeFileCache.tags?.map((t) => t.tag.replace("#", "")) ?? [])
			: [];
		const frontmatter = activeFileCache
			? activeFileCache.frontmatter
			: undefined;

		const targets = activeFile
			? this.app.workspace
					.getLeavesOfType("markdown")
					.filter((leaf) => {
						// @ts-ignore: leaf.view.file exists in MarkdownView
						return leaf.view?.file?.path === activeFile.path;
					})
					.map((leaf) => ({
						// @ts-ignore
						containerEl: leaf.view.containerEl as HTMLElement,
						// @ts-ignore
						contentEl: leaf.view.containerEl.querySelector(
							".view-content",
						) as HTMLElement,
					}))
			: this.app.workspace.getLeavesOfType("markdown").map((leaf) => ({
					// @ts-ignore
					containerEl: leaf.view.containerEl as HTMLElement,
					// @ts-ignore
					contentEl: leaf.view.containerEl.querySelector(
						".view-content",
					) as HTMLElement,
				}));
		// todo: もう少し安全なアクセス方法があるはず
		// tAbstractFileを使うのはrenameのとき
		//  ファイルを直接renameするときは普通にfileがつかえる
		//  エクスプローラーから移動するときはactiveFileがないのでtAbstractFileを使わないといけない

		const metadata: MetadataInfo = {
			tags,
			path,
			title,
			frontmatter: frontmatter ?? {},
		};


		// 各ルールを評価して適用
		for (const rule of this.settings.rules) {
            if (!rule.enabled) continue;
            
			// 前回の適用状態をクリアするためのキー
			const stateKeyClasses = `data-fmd-classes-${rule.id}`;
			const containerClass = `fmd-container-${rule.id}`;

			const result = evaluateRule(this.app, rule, metadata);


			for (const { containerEl, contentEl } of targets) {
				if (!contentEl || !containerEl) continue;
				const htmlEl = contentEl;

				// 1. 以前の適用状態を取得してクリーンアップ (Class & Vars)
				const prevClasses = htmlEl.getAttribute(stateKeyClasses)?.split(" ") || [];

				// クラス削除
				if (rule.config.type === "individual") {
					htmlEl.classList.remove(rule.className);
				}
				for (const cls of prevClasses) {
					if (cls) htmlEl.classList.remove(cls);
				}

	
				// 属性クリア
				htmlEl.removeAttribute(stateKeyClasses);

				// Dom要素削除 (ルールごとにコンテナを削除)
				const existingContainers = htmlEl.querySelectorAll(`.${containerClass}`);
				for (const c of Array.from(existingContainers)) {
					c.remove();
				}

				// 2. 新しい結果を適用
				if (result) {
					// --- A. Class & CSS Variables (既存) ---

					console.log(
						`[FileMetadataDecorator] Applied to ${metadata.path}:`,
						result,
					);
					
					// Individualルールの場合は固定クラス名を適用
					if (rule.config.type === "individual") {
						htmlEl.classList.add(rule.className);
					}

					// 動的クラス名の適用
					if (result.classNames && result.classNames.length > 0) {
						for (const cls of result.classNames) {
							if (cls) htmlEl.classList.add(cls);
						}
						// 適用したクラス名を記録
						htmlEl.setAttribute(stateKeyClasses, result.classNames.join(" "));
					}

			
                    
					// --- B. DOM Elements (新規) ---
					if (result.elements && result.elements.length > 0) {
						// コンテナを作成
						// ユーザー指定のクラス名があればそれも付けるが、ここでは固定クラス + IDクラス
						const container = htmlEl.createDiv({
							cls: `obsidian-file-metadata-decorator ${containerClass}`,
						});



						for (const elemData of result.elements) {
							const child = container.createDiv({
								cls: elemData.className,
							});
							if (elemData.text) {
								child.setText(elemData.text);
							}
                
							if (elemData.style) {
								for (const [key, value] of Object.entries(elemData.style)) {
									// キャメルケースをケバブケースに変換
									const kebabKey = key.replace(
										/[A-Z]/g,
										(m) => `-${m.toLowerCase()}`,
									);
									child.style.setProperty(kebabKey, String(value));
								}
							}
						}
					}
				}
			}
		}
	}
}
