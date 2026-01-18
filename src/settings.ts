import { type App, type Plugin, PluginSettingTab, Setting } from "obsidian";
import type { Rule, RuleInputType } from "./types";

export class DynamicClassnameSettingTab extends PluginSettingTab {
	plugin: Plugin & {
		settings: { rules: Rule[] };
		saveSettings: () => Promise<void>;
	};
	private currentTab: number = 0;

	constructor(
		app: App,
		plugin: Plugin & {
			settings: { rules: Rule[] };
			saveSettings: () => Promise<void>;
		},
	) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", { text: "Dynamic Classname Rules" });

		// ルール追加ボタン
		new Setting(containerEl)
			.setName("Add new rule")
			.setDesc("Create a new classname rule")
			.addButton((button) =>
				button.setButtonText("Add Rule").onClick(async () => {
					const newRule: Rule = {
						id: `rule-${Date.now()}`,
						name: "New Rule",
						enabled: true,
						className: "my-classname",
						config: {
							type: "individual",
							tags: [],
							paths: [],
							titles: [],
							frontmatter: {},
						},
					};
					this.plugin.settings.rules.push(newRule);
					this.currentTab = this.plugin.settings.rules.length - 1;
					await this.plugin.saveSettings();
					this.display();
				}),
			);

		if (this.plugin.settings.rules.length === 0) {
			containerEl.createEl("p", {
				text: "No rules defined. Click 'Add Rule' to create one.",
			});
			return;
		}

		// タブナビゲーション
		const tabContainer = containerEl.createDiv({
			cls: "dynamic-classname-tabs",
		});
		this.plugin.settings.rules.forEach((rule, index) => {
			const tab = tabContainer.createEl("button", {
				text: rule.name,
				cls:
					index === this.currentTab
						? "dynamic-classname-tab active"
						: "dynamic-classname-tab",
			});
			tab.onclick = () => {
				this.currentTab = index;
				this.display();
			};
		});

		// 現在のタブのルールを表示
		const rule = this.plugin.settings.rules[this.currentTab];
		if (!rule) {
			this.currentTab = 0;
			this.display();
			return;
		}

		const ruleContainer = containerEl.createDiv({
			cls: "dynamic-classname-rule-container",
		});

		// ルールタイトルとDeleteボタンを横並びに
		const headerContainer = ruleContainer.createDiv({
			cls: "dynamic-classname-header",
		});
		headerContainer.createEl("h3", {
			text: `Rule: ${rule.name}`,
			cls: "dynamic-classname-title",
		});

		const deleteBtn = headerContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning dynamic-classname-delete-btn",
		});
		deleteBtn.onclick = async () => {
			this.plugin.settings.rules.splice(this.currentTab, 1);
			this.currentTab = Math.max(0, this.currentTab - 1);
			await this.plugin.saveSettings();
			this.display();
		};

		// ルール名
		new Setting(ruleContainer).setName("Rule Name").addText((text) =>
			text.setValue(rule.name).onChange(async (value) => {
				rule.name = value;
				await this.plugin.saveSettings();
				this.display();
			}),
		);

		// 有効/無効
		new Setting(ruleContainer).setName("Enabled").addToggle((toggle) =>
			toggle.setValue(rule.enabled).onChange(async (value) => {
				rule.enabled = value;
				await this.plugin.saveSettings();
			}),
		);

		// 入力タイプ選択
		new Setting(ruleContainer)
			.setName("Input Type")
			.setDesc("Choose how to define the matching rule")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("individual", "Individual Fields")
					.addOption("function-file", "File Function")
					.setValue(rule.config.type)
					.onChange(async (value: RuleInputType) => {
						if (value === "individual") {
							rule.config = {
								type: "individual",
								tags: [],
								paths: [],
								titles: [],
								frontmatter: {},
							};
						} else {
							rule.config = {
								type: "function-file",
								filePath: "",
							};
						}
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		// クラス名 (Individualのみ)
		if (rule.config.type === "individual") {
			new Setting(ruleContainer).setName("Class Name").addText((text) =>
				text.setValue(rule.className).onChange(async (value) => {
					rule.className = value.trim();
					await this.plugin.saveSettings();
				}),
			);
		}

		// タイプ別の設定UI
		if (rule.config.type === "individual") {
			this.displayIndividualConfig(ruleContainer, rule);
		} else if (rule.config.type === "function-file") {
			this.displayFileFunctionConfig(ruleContainer, rule);
		}
	}

	private displayIndividualConfig(containerEl: HTMLElement, rule: Rule) {
		if (rule.config.type !== "individual") return;

		const config = rule.config;

		new Setting(containerEl)
			.setName("Tags")
			.setDesc("One tag per line. Prefix with ! to exclude.")
			.addTextArea((text) =>
				text.setValue(config.tags.join("\n")).onChange(async (value) => {
					config.tags = value.split("\n").filter((v) => v);
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Paths")
			.setDesc(
				"One path per line (startsWith match). Prefix with ! to exclude.",
			)
			.addTextArea((text) =>
				text.setValue(config.paths.join("\n")).onChange(async (value) => {
					config.paths = value.split("\n").filter((v) => v);
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Titles")
			.setDesc("One title per line (includes match). Prefix with ! to exclude.")
			.addTextArea((text) =>
				text.setValue(config.titles.join("\n")).onChange(async (value) => {
					config.titles = value.split("\n").filter((v) => v);
					await this.plugin.saveSettings();
				}),
			);

		const frontmatterSetting = new Setting(containerEl)
			.setName("Frontmatter")
			.setDesc(
				String.raw`JSON format: Record<string, string | string[]>
Example: {"publish": "false", "tags": ["tag1", "tag2"]}`,
			);

		let frontmatterErrorEl: HTMLElement | null = null;

		frontmatterSetting.addTextArea((text) => {
			text
				.setValue(JSON.stringify(config.frontmatter, null, 2))
				.onChange(async (value) => {
					try {
						config.frontmatter = JSON.parse(value);
						await this.plugin.saveSettings();

						// エラー表示をクリア
						text.inputEl.removeClass("has-error");
						if (frontmatterErrorEl) {
							frontmatterErrorEl.remove();
							frontmatterErrorEl = null;
						}
					} catch (error) {
						console.error(error);

						// 入力欄を赤く
						text.inputEl.addClass("has-error");

						// エラーメッセージを表示
						if (!frontmatterErrorEl) {
							frontmatterErrorEl = containerEl.createDiv({
								cls: "setting-error-message",
							});
						}
						frontmatterErrorEl.setText(
							`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				});
		});
	}

	private displayFileFunctionConfig(containerEl: HTMLElement, rule: Rule) {
		if (rule.config.type !== "function-file") return;

		const config = rule.config;

		const fileSetting = new Setting(containerEl)
			.setName("File Path")
			.setDesc("Path to .js file in your vault (e.g., rules/my-rule.js)");

		let errorEl: HTMLElement | null = null;

		fileSetting.addText((text) =>
			text.setValue(config.filePath).onChange(async (value) => {
				config.filePath = value;
				await this.plugin.saveSettings();

				// ファイルをリロード
				const { preloadRuleFile } = await import("../src/evaluator");
				try {
					await preloadRuleFile(this.app, value);

					// エラー表示をクリア
					text.inputEl.removeClass("has-error");
					if (errorEl) {
						errorEl.remove();
						errorEl = null;
					}
				} catch (error) {
					console.error("Failed to load rule file:", error);

					// 入力欄を赤く
					text.inputEl.addClass("has-error");

					// エラーメッセージを表示
					if (!errorEl) {
						errorEl = containerEl.createDiv({
							cls: "setting-error-message",
						});
					}
					errorEl.setText(
						`File not found: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			}),
		);

		containerEl.createDiv({
			cls: "setting-item-description",
			text: "File should contain: (metadata) => { return 'classname' or ''; }",
		});
	}
}
