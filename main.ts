import {
    App,
    EventRef,
    FrontMatterCache,
    MarkdownView,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TAbstractFile,
} from "obsidian";

type OrArray<T> = T | T[];

interface MyPluginSettings {
    tags: string[];
    paths: string[];
    titles: string[];
    frontmatter: Record<string, OrArray<string | number | boolean>>;
    className: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    tags: ["private"],
    paths: ["private"],
    titles: ["🔐"],
    frontmatter: { publish: ["false"] },
    className: "dynamic-classname",
};

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    private eventRefs: EventRef[];

    async onload() {
        await this.loadSettings();

        this.addSettingTab(new SampleSettingTab(this.app, this));

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
        this.eventRefs.forEach((ref) => this.app.metadataCache.offref(ref));
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        );
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    private exec(tAbstractFile?: TAbstractFile) {
        const markdownView =
            this.app.workspace.getActiveViewOfType(MarkdownView);

        const activeFile = markdownView?.file;
        const activeFileCache = activeFile
            ? this.app.metadataCache.getFileCache(activeFile)
            : undefined;

        const title = activeFile?.basename ?? tAbstractFile?.name;
        const path = activeFile?.path ?? tAbstractFile?.path;

        if (!title || !path) return;

        const tags = activeFileCache
            ? activeFileCache.tags?.map((t) => t.tag.replace("#", "")) ?? []
            : [];
        const frontmatter = activeFileCache
            ? activeFileCache.frontmatter
            : undefined;

        const el = markdownView?.contentEl
            ? [markdownView.contentEl]
            : this.app.workspace
                .getLeavesOfType("markdown")
                .map((l) =>
                    "containerEl" in l
                        ? (l.containerEl as HTMLElement)
                        : undefined
                )
                .map((el) => el?.querySelector("div.view-content"))
                .flatMap((el) => el ?? []);
        // todo: もう少し安全なアクセス方法があるはず
        // tAbstractFileを使うのはrenameのとき
        //  ファイルを直接renameするときは普通にfileがつかえる
        //  エクスプローラーから移動するときはactiveFileがないのでtAbstractFileを使わないといけない

        const isMatched = this.isPrivate({
            tags,
            path,
            title,
            frontmatter: frontmatter ?? {},
        });

        if (isMatched) {
            el.forEach((el) => el.classList.add(this.settings.className));
        } else {
            el.forEach((el) => el.classList.remove(this.settings.className));
        }
    }

    private isPrivate = ({
        tags,
        path,
        title,
        frontmatter,
    }: {
        tags: string[];
        path: string;
        title: string;
        frontmatter: FrontMatterCache;
    }): boolean => {
        const tagsSplit = splitByPosNeg(this.settings.tags);
        const pathsSplit = splitByPosNeg(this.settings.paths);
        const titleSplit = splitByPosNeg(this.settings.titles);

        const negativeMatch =
            tagsSplit.neg.some((tag) => tags.includes(tag)) ||
            pathsSplit.neg.some((p) => path.startsWith(p)) ||
            titleSplit.neg.some((t) => title.includes(t));

        if (negativeMatch) {
            logging("negative matched");
            return false;
        }

        if (tagsSplit.pos.some((tag) => tags.includes(tag))) {
            logging("tag matched");
            return true;
        }

        if (pathsSplit.pos.some((p) => path.startsWith(p))) {
            logging("path matched");
            return true;
        }

        if (titleSplit.pos.some((t) => title.includes(t))) {
            logging("title matched");
            return true;
        }

        type SingleValue = string | number | boolean;
        const isSingleValue = (v: unknown): v is SingleValue =>
            typeof v === "string" ||
            typeof v === "number" ||
            typeof v === "boolean";

        const isMatch = (v1: SingleValue, v2: SingleValue) => {
            return v1.toString() === v2.toString();
        };

        if (
            Object.entries(this.settings.frontmatter).some(([sKey, sValue]) => {
                const fValue = frontmatter[sKey];
                if (isSingleValue(sValue)) {
                    if (isSingleValue(fValue)) {
                        return isMatch(sValue, fValue);
                    } else if (Array.isArray(fValue)) {
                        return fValue.some((v) => isMatch(sValue, v));
                    }
                } else if (Array.isArray(sValue)) {
                    if (isSingleValue(fValue)) {
                        return sValue.some((v) => isMatch(v, fValue));
                    } else if (Array.isArray(fValue)) {
                        return sValue.some((v) =>
                            fValue.some((f) => isMatch(v, f))
                        );
                    }
                }
            })
        ) {
            return true;
        }

        logging("no matched", {
            title,
            f: this.settings.titles,
        });

        return false;
    };
}

const isProduction = process.env.NODE_ENV === "production";

const logging: typeof console.log = (...args) => {
    !isProduction && console.log(...args);
};

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl).infoEl.setText("");

        new Setting(containerEl).setName("tags").addTextArea((text) =>
            text
                .setValue(this.plugin.settings.tags.join("\n"))
                .onChange(async (value) => {
                    this.plugin.settings.tags = value
                        .split("\n")
                        .filter((v) => v);
                    await this.plugin.saveSettings();
                })
        );

        new Setting(containerEl)
            .setName("paths")
            .setDesc("startsWith match")
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.settings.paths.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.paths = value
                            .split("\n")
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("titles")
            .setDesc("includes match")
            .addTextArea((text) =>
                text
                    .setValue(this.plugin.settings.titles.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.titles = value
                            .split("\n")
                            .filter((v) => v);
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("frontmatter")
            .setDesc(
                String.raw`input format: Record<string,string | string[]>. 
                example:
                    {
                        "publish": 'false'
                        "tags": ['tag1', 'tag2']
                    }  
                `
            )
            .addTextArea((text) =>
                text
                    .setValue(JSON.stringify(this.plugin.settings.frontmatter))
                    .onChange(async (value) => {
                        try {
                            this.plugin.settings.frontmatter =
                                JSON.parse(value);
                            await this.plugin.saveSettings();
                        } catch (error) {
                            console.error(error);
                            new Notice(`frontmatter is Invalid JSON`);
                        }
                    })
            );

        new Setting(containerEl).setName("className").addText((text) =>
            text
                .setValue(this.plugin.settings.className)
                .onChange(async (value) => {
                    this.plugin.settings.className = value.trim();
                    await this.plugin.saveSettings();
                })
        );
    }
}

const splitByPosNeg = (arr: string[]): { pos: string[]; neg: string[] } => {
    const positive = arr.flatMap((t) => (t.startsWith("!") ? [] : [t]));
    const negative = arr.flatMap((t) =>
        t.startsWith("!") ? t.replace(/^!/, "") : []
    );

    return { pos: positive, neg: negative };
};
