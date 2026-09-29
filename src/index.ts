// Hello from TypeScript
/// <reference types="../node_modules/monaco-editor/monaco" />
/// <reference types="../node_modules/types-mediawiki" />

declare const lucide: any;
declare const require: any;
declare const less: {
    render(code: string): Promise<{ css: string }>;
};

class nkchCSS {
    editor!: monaco.editor.IStandaloneCodeEditor;

    options: nkch.css.Options;
    checks: nkch.css.Checks;
    elements: { [x: string]: any };

    readonly env: nkch.css.Env;
    readonly versions: Map<string, string>;

    private loading?: Promise<void>;
    private closeAnimation?: Animation;
    private lessTimer?: number;
    private lessRun = 0;
    private customPropertiesCache?: { at: number; list: string[] };

    constructor(options: nkch.css.Options) {
        this.options = options;

        this.checks = {
            editor: {
                isInitialized: false,
                isEnabled: true,
                isOpen: false,
                isMarkersPanelOpen: false,
                isPickerEnabled: false
            },
            state: {
                drag: { isHolding: false, isDragging: false },
                resize: { isHolding: false, isResizing: false }
            },
            code: { isInvalid: false }
        };

        this.elements = {};

        this.env = {
            skin: mw.config.get("skin"),
            lang: mw.config.get("wgScriptPath").replace("/", ""),
            theme: mw.config.get("isDarkTheme") ? "dark" : "light"
        };

        this.versions = new Map([
            ["monaco-editor", "0.57.0"],
            ["less", "4.9.1"],
            ["lucide", "1.48.0"]
        ]);

        this.initialize();
    }

    public open(event?: Event): Promise<void> | void {
        event?.preventDefault();

        if (!this.checks.editor.isInitialized) return (this.loading ??= this.initializeEditor());
        if (this.checks.editor.isOpen) return;

        this.closeAnimation?.cancel();
        this.elements.main.classList.remove("nkch-css--is-closed");

        this.elements.main.animate([{
            opacity: 0,
            transform: "translateY(10px)"
        }, {
            opacity: 1,
            transform: "translateY(0)"
        }], {
            duration: 300,
            easing: "ease"
        });

        this.elements.main.dispatchEvent(new CustomEvent("nkch-css-open", {
            cancelable: true,
            detail: this
        }));

        this.checks.editor.isOpen = true;
    }

    public close(event?: Event): Promise<void> | void {
        event?.preventDefault();

        if (!this.checks.editor.isInitialized || !this.checks.editor.isOpen) return;

        const hideAnimation = this.elements.main.animate([{
            opacity: 1,
            transform: "translateY(0)"
        }, {
            opacity: 0,
            transform: "translateY(10px)"
        }], {
            duration: 300,
            easing: "ease",
            fill: "forwards"
        });

        this.closeAnimation = hideAnimation;
        hideAnimation.onfinish = () => this.elements.main.classList.add("nkch-css--is-closed");

        this.elements.main.dispatchEvent(new CustomEvent("nkch-css-close", {
            cancelable: true,
            detail: this
        }));

        this.checks.editor.isOpen = false;
    }

    public toggle(state: boolean): void {
        if (state) {
            this.elements.main_headerButton__toggle.classList.add("is-enabled");
            this.elements.main_headerButton__toggle.classList.remove("is-disabled");
            this.checks.editor.isEnabled = true;
            this.updateCode(this.editor.getValue(), this.getLanguage());
        } else {
            this.elements.main_headerButton__toggle.classList.add("is-disabled");
            this.elements.main_headerButton__toggle.classList.remove("is-enabled");
            this.checks.editor.isEnabled = false;
            this.elements.style.textContent = "";
        }
    }

    public updateCode(code: string, language: nkch.css.SupportedLanguages, saveToStorage: boolean = true): void {
        if (saveToStorage) {
            try {
                localStorage.setItem("mw-nkch-css", JSON.stringify({ lang: language, value: code }));
            } catch { /* storage full or blocked */ }
        }

        if (!this.checks.editor.isEnabled) return;

        clearTimeout(this.lessTimer);
        const run = ++this.lessRun;

        switch (language) {
            default:
            case "css":
                this.checks.code.isInvalid = false;
                this.elements.style.textContent = code;
                break;

            case "less":
                this.lessTimer = window.setTimeout(() => {
                    less.render(code)
                        .then(output => {
                            if (run !== this.lessRun) return;
                            this.checks.code.isInvalid = false;
                            this.elements.main_action__compileLess.classList.toggle("nkch-css__action--is-disabled", false);
                            this.updateCode(output.css, "css", false);
                        })
                        .catch(() => {
                            if (run !== this.lessRun) return;
                            this.checks.code.isInvalid = true;
                            this.elements.main_action__compileLess.classList.toggle("nkch-css__action--is-disabled", true);
                        });
                }, 150);
                break;
        }

        this.elements.main.dispatchEvent(new CustomEvent("nkch-css-update", {
            cancelable: true,
            detail: this
        }));
    }

    public setValue(text: string): void {
        const model: monaco.editor.ITextModel | null = this.editor.getModel();
        if (model) {
            this.editor.pushUndoStop();
            this.editor.executeEdits("", [{
                range: model.getFullModelRange(),
                text: text
            }]);
            this.updateCode(this.editor.getValue(), this.getLanguage());
        }
    }

    public getLanguage(): nkch.css.SupportedLanguages {
        const model: monaco.editor.ITextModel = this.editor.getModel()!;
        return model.getLanguageId() as nkch.css.SupportedLanguages;
    }

    public setLanguage(lang: nkch.css.SupportedLanguages, changeTab: boolean = true): void {
        const model: monaco.editor.ITextModel | null = this.editor.getModel();
        if (model) monaco.editor.setModelLanguage(model, lang);

        if (changeTab) {
            const isCss = lang === "css";
            this.elements.main_tab__css.classList.toggle("nkch-css__tab--is-selected", isCss);
            this.elements.main_tab__less.classList.toggle("nkch-css__tab--is-selected", !isCss);
        }
    }

    public compileLess(code: string): void {
        if (this.getLanguage() !== "less") return;

        less.render(code)
            .then(output => {
                if (!this.checks.code.isInvalid) {
                    this.setLanguage("css");
                    this.setValue(output.css);
                    this.updateCode(output.css, "css");
                }
            })
            .catch(() => { /* invalid Less: already flagged by updateCode */ });
    }

    public enablePicker(): void {
        document.documentElement.classList.add("nkch-css-html-picker-enabled");
        this.elements.main.classList.add("nkch-css--is-picker-enabled");
        this.checks.editor.isPickerEnabled = true;
    }

    public disablePicker(): void {
        document.documentElement.classList.remove("nkch-css-html-picker-enabled");
        this.elements.main.classList.remove("nkch-css--is-picker-enabled");
        this.checks.editor.isPickerEnabled = false;
        document.querySelector(".nkch-css-picker-blocker")?.remove();
        this.removePickerSelector();
    }

    private removePickerSelector(): void {
        document.querySelectorAll(".nkch-css-picker-element")
            .forEach(el => el.classList.remove("nkch-css-picker-element"));
    }

    public getParents(element: Element): Element[] {
        const parents: Element[] = [];
        let currentElement: Element | null = element;

        while (currentElement && currentElement.parentElement) {
            parents.push(currentElement.parentElement);
            currentElement = currentElement.parentElement;
        }
        return parents;
    }

    public getSelector(element: Element): string {
        if (element.id) return '#' + CSS.escape(element.id);
        if (element.tagName.toLowerCase() === "body") return "body";

        if (element.classList) {
            const classList: Set<string> = new Set(Array.from(element.classList));
            classList.delete("nkch-css-picker-element");
            if (classList.size > 0) return "." + Array.from(classList, c => CSS.escape(c)).join(".");
        }

        if (element.parentElement) {
            return `${this.getSelector(element.parentElement)} > ${element.tagName.toLowerCase()}`;
        }
        return element.tagName.toLowerCase();
    }

    private initialize(): void {
        switch (this.env.skin) {
            case "fandomdesktop": {
                const quickbarItem = document.createElement("li");
                quickbarItem.classList.add("nkch-css__quickbar-button");
                this.elements.quickbarItem = quickbarItem;

                const quickbarItem_spinner = document.createElement("span");
                quickbarItem_spinner.classList.add("nkch-css__quickbar-button-spinner", "is-hidden");
                this.elements.quickbarItem_spinner = quickbarItem_spinner;
                quickbarItem.append(quickbarItem_spinner);

                const quickbarItem_link = document.createElement("a");
                quickbarItem_link.classList.add("nkch-css__quickbar-button-link");
                quickbarItem_link.setAttribute("href", "#");
                quickbarItem_link.innerHTML = "nkchCSS";
                this.elements.quickbarItem_link = quickbarItem_link;
                quickbarItem.append(quickbarItem_link);

                quickbarItem_link.addEventListener("click", () => this.open(), false);
                document.querySelector("#WikiaBar .toolbar .tools")?.append(quickbarItem);
                break;
            }

            default:
            case "citizen":
            case "vector":
            case "vector-2022": {
                const sidebarItem = document.createElement("li");
                sidebarItem.classList.add("nkch-css__sidebar-button", "mw-list-item");
                sidebarItem.id = "n-nkchcss";
                this.elements.sidebarItem = sidebarItem;

                if (this.env.skin === "citizen")
                    sidebarItem.classList.add("nkch-css__sidebar-button--citizen");

                const menuTarget = document.querySelector("#mw-panel .vector-menu-content-list, #p-tb ul, .page-tools ul") || document.body;
                menuTarget.append(sidebarItem);

                const sidebarItem_spinner = document.createElement("span");
                sidebarItem_spinner.classList.add("nkch-css__sidebar-button-spinner", "is-hidden");
                this.elements.sidebarItem_spinner = sidebarItem_spinner;
                sidebarItem.append(sidebarItem_spinner);

                const sidebarItem_link = document.createElement("a");
                sidebarItem_link.classList.add("nkch-css__sidebar-button-link");
                sidebarItem_link.setAttribute("href", "#");
                sidebarItem_link.innerText = "nkchCSS";
                this.elements.sidebarItem_link = sidebarItem_link;
                sidebarItem.append(sidebarItem_link);

                sidebarItem_link.addEventListener("click", () => this.open(), false);
                break;
            }
        }
    }

    private setSpinner(hidden: boolean): void {
        const spinner = this.env.skin === "fandomdesktop"
            ? this.elements.quickbarItem_spinner
            : this.elements.sidebarItem_spinner;
        spinner?.classList.toggle("is-hidden", hidden);
    }

    private async initializeEditor(): Promise<void> {
        this.setSpinner(false);

        try {
            mw.loader.load(`https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs/editor/editor.main.min.css`, "text/css");

            // Order matters: monaco's loader defines a global AMD `define`, which would hijack lucide's UMD wrapper.
            await mw.loader.getScript(`https://cdn.jsdelivr.net/npm/lucide@${this.versions.get("lucide")}/dist/umd/lucide.js`);
            await mw.loader.getScript(`https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs/loader.min.js`);
        } catch {
            this.loadFailed();
            return;
        }

        this.onModuleLoad();
    }

    private loadFailed(): void {
        this.loading = undefined; // allow a retry on next click
        this.setSpinner(true);
    }

    private onModuleLoad(): void {
        // const getPreferredLanguage = (): string => {
        //     const supportedLanguages = ["en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-cn", "zh-tw"];
        //     for (const lang of navigator.languages) {
        //         const normalizedLang = lang.toLowerCase();
        //         const match = [normalizedLang, normalizedLang.split("-")[0]].find(l => supportedLanguages.includes(l));

        //         console.log(match);
        //         if (match) return match;
        //     }
        //     return "en";
        // };

        require.config({
            paths: {
                "less": `https://cdnjs.cloudflare.com/ajax/libs/less.js/${this.versions.get("less")}/less.min`,
                "vs": `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs`,
            },
            // "vs/nls": { availableLanguages: { "*": getPreferredLanguage() } },
            waitSeconds: 100
        });

        require(["less", "vs/editor/editor.main"], () => {
            this.buildCoreDOM();
            this.setupWindowInteractions();
            this.setupElementPicker();
            this.setupMonacoConfig();
            this.setupStatusbar();
            this.loadInitialData();

            this.setSpinner(true);
            this.checks.editor.isInitialized = true;
            this.open();
        }, () => this.loadFailed());
    }

    private buildCoreDOM(): void {
        const style = document.createElement("style");
        style.classList.add("nkch-css-style");
        this.elements.style = style;
        document.head.append(style);

        const main = document.createElement("div");
        main.classList.add("nkch-css");
        main.style.position = "fixed";
        this.elements.main = main;
        document.body.appendChild(main);

        const main_container = document.createElement("div");
        main_container.classList.add("nkch-css__container");
        this.elements.main_container = main_container;
        main.append(main_container);

        // Header Section
        const main_header = document.createElement("div");
        main_header.classList.add("nkch-css__header");
        this.elements.main_header = main_header;
        main_container.append(main_header);

        const main_headerLeft = document.createElement("div");
        main_headerLeft.classList.add("nkch-css__header-left");
        main_header.append(main_headerLeft);

        const main_headerTitle = document.createElement("div");
        main_headerTitle.classList.add("nkch-css__header-title");
        main_headerTitle.innerHTML = "nkchCSS";
        main_headerLeft.append(main_headerTitle);

        const main_headerRight = document.createElement("div");
        main_headerRight.classList.add("nkch-css__header-right");
        main_header.append(main_headerRight);

        const main_headerButtonGroup = document.createElement("div");
        main_headerButtonGroup.classList.add("nkch-css__header-button-group");
        this.elements.main_headerButtonGroup = main_headerButtonGroup;
        main_headerRight.append(main_headerButtonGroup);

        // Beautify button
        const main_headerButton__beautify = document.createElement("button");
        main_headerButton__beautify.classList.add("nkch-css__header-button", "nkch-css__header-button--beautify");
        main_headerButton__beautify.setAttribute("type", "button");
        main_headerButtonGroup.append(main_headerButton__beautify);
        main_headerButton__beautify.addEventListener("click", () => this.editor.getAction("editor.action.formatDocument")?.run(), false);
        main_headerButton__beautify.append(lucide.createElement(lucide.Sparkles, { height: 18, width: 18 }));

        // Toggle button
        const main_headerButton__toggle = document.createElement("button");
        main_headerButton__toggle.classList.add("nkch-css__header-button", "nkch-css__header-button--toggle", this.checks.editor.isEnabled ? "is-enabled" : "is-disabled");
        main_headerButton__toggle.setAttribute("type", "button");
        this.elements.main_headerButton__toggle = main_headerButton__toggle;
        main_headerButtonGroup.append(main_headerButton__toggle);
        main_headerButton__toggle.addEventListener("click", () => this.toggle(!this.checks.editor.isEnabled), false);
        main_headerButton__toggle.append(lucide.createElement(lucide.Eye, { height: 18, width: 18 }));

        // Close button
        const main_headerButton__close = document.createElement("button");
        main_headerButton__close.classList.add("nkch-css__header-button", "nkch-css__header-button--close");
        main_headerButton__close.setAttribute("type", "button");
        main_headerButtonGroup.append(main_headerButton__close);
        main_headerButton__close.addEventListener("click", () => this.close(), false);
        main_headerButton__close.append(lucide.createElement(lucide.X, { height: 18, width: 18 }));

        // Content Frame
        const main_content = document.createElement("div");
        main_content.classList.add("nkch-css__content");
        this.elements.main_content = main_content;
        main_container.append(main_content);

        const main_actionsHeader = document.createElement("div");
        main_actionsHeader.classList.add("nkch-css__actions-header");
        main_content.append(main_actionsHeader);

        // Navigation Tabs
        const main_tabs = document.createElement("div");
        main_tabs.classList.add("nkch-css__tabs");
        this.elements.main_tabs = main_tabs;
        main_actionsHeader.append(main_tabs);

        const main_tab__css = document.createElement("div");
        main_tab__css.classList.add("nkch-css__tab", "nkch-css__tab--css");
        main_tab__css.innerText = "CSS";
        this.elements.main_tab__css = main_tab__css;
        main_tabs.append(main_tab__css);
        main_tab__css.addEventListener("click", () => this.setLanguage("css", true), false);

        const main_tab__less = document.createElement("div");
        main_tab__less.classList.add("nkch-css__tab", "nkch-css__tab--less");
        main_tab__less.innerText = "Less";
        this.elements.main_tab__less = main_tab__less;
        main_tabs.append(main_tab__less);
        main_tab__less.addEventListener("click", () => this.setLanguage("less", true), false);

        const main_actions = document.createElement("div");
        main_actions.classList.add("nkch-css__actions");
        this.elements.main_actions = main_actions;
        main_actionsHeader.append(main_actions);

        const main_action__compileLess = document.createElement("button");
        main_action__compileLess.classList.add("nkch-css__action", "nkch-css__action--compile-less");
        main_action__compileLess.setAttribute("type", "button");
        main_action__compileLess.innerText = "Less → CSS";
        this.elements.main_action__compileLess = main_action__compileLess;
        main_actions.append(main_action__compileLess);
        main_action__compileLess.addEventListener("click", () => this.compileLess(this.editor.getValue()));

        const main_action__picker = document.createElement("button");
        main_action__picker.classList.add("nkch-css__action", "nkch-css__action--pointer");
        main_action__picker.setAttribute("type", "button");
        main_action__picker.append(lucide.createElement(lucide.SquareDashedMousePointer, { height: 18, width: 18 }));
        this.elements.main_action__picker = main_action__picker;
        main_actions.append(main_action__picker);
        main_action__picker.addEventListener("click", () => this.enablePicker());

        // Code Window Split Frame
        const main_splitView = document.createElement("div");
        main_splitView.classList.add("nkch-css__split-view");
        this.elements.main_splitView = main_splitView;
        main_content.append(main_splitView);

        const splitViewRect = main_splitView.getBoundingClientRect();
        main_splitView.style.width = `${splitViewRect.width || 500}px`;
        main_splitView.style.height = `${splitViewRect.height || 350}px`;

        const main_codearea = document.createElement("div");
        main_codearea.classList.add("nkch-css__codearea");
        this.elements.main_codearea = main_codearea;
        main_splitView.append(main_codearea);

        // Validation Overlay UI
        const main_markersPanel = document.createElement("div");
        main_markersPanel.classList.add("nkch-css__markers-panel", "nkch-css__markers-panel--is-hidden");
        this.elements.main_markersPanel = main_markersPanel;
        main_splitView.append(main_markersPanel);

        const main_markersPanelHeader = document.createElement("div");
        main_markersPanelHeader.classList.add("nkch-css__markers-panel-header");
        main_markersPanel.append(main_markersPanelHeader);

        const main_markersPanelCloseButton = document.createElement("button");
        main_markersPanelCloseButton.classList.add("nkch-css__markers-panel-close-button");
        this.elements.main_markersPanelCloseButton = main_markersPanelCloseButton;
        main_markersPanelHeader.append(main_markersPanelCloseButton);
        main_markersPanelCloseButton.append(lucide.createElement(lucide.X, { width: 18, height: 18 }));

        const main_markersList = document.createElement("div");
        main_markersList.classList.add("nkch-css__markers-list");
        this.elements.main_markersList = main_markersList;
        main_markersPanel.append(main_markersList);

        const main_resizer = document.createElement("div");
        main_resizer.classList.add("nkch-css__resizer");
        this.elements.main_resizer = main_resizer;
        main_splitView.append(main_resizer);
    }

    private setupWindowInteractions(): void {
        const main = this.elements.main;
        const main_splitView = this.elements.main_splitView;
        const main_resizer = this.elements.main_resizer;
        const dragPosition: nkch.css.Coordinates = { x: 0, y: 0 };

        for (const type of ["keydown", "keypress", "keyup"])
            main.addEventListener(type, (e: Event) => e.stopPropagation(), false);

        main.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.button !== 0) return;

            const cancelElements = [
                this.elements.main_splitView, 
                this.elements.main_statusbar, 
                this.elements.main_headerButtonGroup, 
                this.elements.main_actions, 
                this.elements.main_tabs
            ];
            if (cancelElements.some(el => el?.contains(e.target as Node))) return;

            this.checks.state.drag.isHolding = true;
            dragPosition.x = e.clientX;
            dragPosition.y = e.clientY;

            main.dispatchEvent(new CustomEvent("nkch-css-drag:hold", { cancelable: true, detail: this }));
        }, false);

        window.addEventListener("mouseup", () => {
            if (this.checks.state.drag.isHolding) {
                this.checks.state.drag.isHolding = false;
                this.checks.state.drag.isDragging = false;
                main.classList.remove("nkch-css--is-dragging");
                main.dispatchEvent(new CustomEvent("nkch-css-drag:release", { cancelable: true, detail: this }));
            }

            if (this.checks.state.resize.isHolding) {
                this.checks.state.resize.isHolding = false;
                this.checks.state.resize.isResizing = false;
                main.dispatchEvent(new CustomEvent("nkch-css-resize:release", { cancelable: true, detail: this }));
            }
        }, false);

        // Window Resizer Logic
        let resizeMousePos: nkch.css.Coordinates = { x: 0, y: 0 };
        let resizeStartSize: nkch.css.Size = { width: 0, height: 0 };

        main_resizer.addEventListener("mousedown", (e: MouseEvent) => {
            this.checks.state.resize.isHolding = true;
            const rect = main_splitView.getBoundingClientRect();
            resizeMousePos = { x: e.clientX, y: e.clientY };
            resizeStartSize = { width: rect.width, height: rect.height };

            main.dispatchEvent(new CustomEvent("nkch-css-resize:hold", { cancelable: true, detail: this }));
        }, false);

        window.addEventListener("mousemove", (e: MouseEvent) => {
            if (this.checks.state.drag.isHolding) {
                this.checks.state.drag.isDragging = true;
                main.style.top = main.offsetTop - (dragPosition.y - e.clientY) + "px";
                main.style.left = main.offsetLeft - (dragPosition.x - e.clientX) + "px";
                main.style.bottom = "auto";
                main.style.right = "auto";

                dragPosition.x = e.clientX;
                dragPosition.y = e.clientY;
                main.classList.add("nkch-css--is-dragging");
                main.dispatchEvent(new CustomEvent("nkch-css-drag", { cancelable: true, detail: this }));
            }

            if (this.checks.state.resize.isHolding) {
                this.checks.state.resize.isResizing = true;
                const calculatedWidth = resizeStartSize.width + e.clientX - resizeMousePos.x;
                const calculatedHeight = resizeStartSize.height + e.clientY - resizeMousePos.y;

                if (calculatedWidth >= 450) main_splitView.style.width = calculatedWidth + "px";
                if (calculatedHeight >= 280) main_splitView.style.height = calculatedHeight + "px";

                main.dispatchEvent(new CustomEvent("nkch-css-resize", { cancelable: true, detail: this }));
            }
        }, false);
    }

    private setupElementPicker(): void {
        let pickerTarget: Element | null = null;
        const pickerTooltip = document.createElement("div");
        pickerTooltip.classList.add("nkch-css-picker-tooltip");
        document.body.append(pickerTooltip);

        document.addEventListener("mousemove", (e: MouseEvent) => {
            if (!this.checks.editor.isPickerEnabled) return;

            const target = e.target as Element;
            if (pickerTarget && pickerTarget !== target) pickerTarget.classList.remove("nkch-css-picker-element");

            pickerTarget = target;
            pickerTarget.classList.add("nkch-css-picker-element");

            pickerTooltip.textContent = this.getSelector(target);

            let leftPosition = e.pageX + 10;
            if (e.clientX + 10 + pickerTooltip.offsetWidth > window.innerWidth) {
                leftPosition = e.pageX - pickerTooltip.offsetWidth - 10;
            }

            let topPosition = e.pageY + 10;
            if (e.clientY + 10 + pickerTooltip.offsetHeight > window.innerHeight) {
                topPosition = e.pageY - pickerTooltip.offsetHeight - 10;
            }

            pickerTooltip.style.left = leftPosition + "px";
            pickerTooltip.style.top = topPosition + "px";
        }, false);

        document.addEventListener("mousedown", (e: MouseEvent) => {
            if (!this.checks.editor.isPickerEnabled) return;

            const element = e.target as Element;
            const pickerBlocker = document.createElement("div");
            pickerBlocker.classList.add("nkch-css-picker-blocker");
            document.body.append(pickerBlocker);

            pickerBlocker.addEventListener("mouseup", () => {
                pickerBlocker.remove();
                this.disablePicker();

                const selections = this.editor.getSelections();
                if (selections) {
                    const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];
                    const text = this.getSelector(element);

                    selections.forEach(selection => {
                        edits.push({
                            range: selection,
                            text: text,
                            forceMoveMarkers: true
                        });
                    });
                    this.editor.executeEdits("nkch-css-picker", edits);
                }
            }, false);
        }, false);

        document.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Escape" && this.checks.editor.isPickerEnabled) this.disablePicker();
        }, false);
    }

    private setupMonacoConfig(): void {
        const editorThemes = new Map<string, string>([
            ["light", "vs"],
            ["dark", "vs-dark"]
        ]);

        this.editor = monaco.editor.create(this.elements.main_codearea, {
            language: "css",
            theme: editorThemes.get(this.env.theme),
            fontSize: 13,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            scrollbar: { useShadows: false },
            minimap: { enabled: false },
            stickyScroll: { enabled: true }
        });

        // Theme sync listener instead of explicit heavy polling loops
        setInterval(() => {
            if (!this.checks.editor.isOpen) return;
            const targetTheme: nkch.css.Themes = mw.config.get("isDarkTheme") ? "dark" : "light";
            if (this.env.theme !== targetTheme) {
                monaco.editor.setTheme(editorThemes.get(targetTheme)!);
                this.env.theme = targetTheme;
            }
        }, 200);

        this.editor.onDidChangeModelContent(() => {
            this.updateCode(this.editor.getValue(), this.getLanguage());
        });

        this.registerCustomCompletionProviders();
    }

    private registerCustomCompletionProviders(): void {
        const completionItemProviders: monaco.languages.CompletionItemProvider[] = [{
            triggerCharacters: ["!"],
            provideCompletionItems: (model, position) => {
                const propertyCheck = /[^;{}]+\s*:\s*[^;{}]+\s*;?$/;
                const textValue = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                if (propertyCheck.test(textValue)) {
                    const word = model.getWordUntilPosition(position);
                    return {
                        suggestions: [{
                            label: '!important',
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: "!important",
                            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
                        }]
                    };
                }
                return { suggestions: [] };
            },
        }, {
            triggerCharacters: ["--"],
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const editorProperties = getEditorCustomProperties();
                const now = Date.now();
                if (!this.customPropertiesCache || now - this.customPropertiesCache.at > 5000) {
                    this.customPropertiesCache = { at: now, list: getAllCustomProperties() }; // full stylesheet scan is expensive
                }
                const filteredProperties = this.customPropertiesCache.list.filter(item => !editorProperties.includes(item));

                const suggestions = filteredProperties.map(property => ({
                    label: property,
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertText: property,
                    range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
                }));

                return { suggestions };

                function getAllCustomProperties(): string[] {
                    const customProperties = new Set<string>();
                    const styleSheets = Array.from(document.styleSheets).filter(sheet =>
                        !sheet.href || sheet.href.startsWith(window.location.origin)
                    );

                    styleSheets.forEach(sheet => {
                        try {
                            const cssRules = sheet.cssRules;
                            for (let i = 0; i < cssRules.length; i++) {
                                const cssRule = cssRules[i];
                                if (cssRule instanceof CSSStyleRule) {
                                    Array.from(cssRule.style).forEach(property => {
                                        if (property.startsWith("--") && !property.startsWith("--vscode")) {
                                            customProperties.add(property);
                                        }
                                    });
                                }
                            }
                        } catch { /* Avoid cross-origin block extensions exceptions */ }
                    });

                    return Array.from(customProperties);
                }

                function getEditorCustomProperties(): string[] {
                    const existingProperties: string[] = [];
                    const content = model.getValue();
                    const propertyRegex = /--([^:;]+)\s*:\s*([^;]+);/g;
                    let match: RegExpExecArray | null;

                    while ((match = propertyRegex.exec(content)) !== null) {
                        existingProperties.push(`--${match[1].trim()}`);
                    }
                    return existingProperties;
                }
            }
        }];

        completionItemProviders.forEach(provider => 
            monaco.languages.registerCompletionItemProvider(["css", "less"], provider)
        );
    }

    private setupStatusbar(): void {
        const main_content = this.elements.main_content;

        const main_statusbar = document.createElement("div");
        main_statusbar.classList.add("nkch-css__statusbar");
        this.elements.main_statusbar = main_statusbar;
        main_content.append(main_statusbar);

        const main_statusbarContainer__left = document.createElement("div");
        main_statusbarContainer__left.classList.add("nkch-css__statusbar-container", "nkch-css__statusbar-container--left");
        main_statusbar.append(main_statusbarContainer__left);

        // Download Action
        const main_statusbarItem__fileDownload = document.createElement("a");
        main_statusbarItem__fileDownload.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--file-download");
        main_statusbarItem__fileDownload.setAttribute("role", "button");
        this.elements.main_statusbarItem__fileDownload = main_statusbarItem__fileDownload;
        main_statusbarContainer__left.append(main_statusbarItem__fileDownload);

        main_statusbarItem__fileDownload.addEventListener("click", () => {
            if (this.editor.getValue().replace(/\s/g, "").length < 1) {
                main_statusbarItem__fileDownload.removeAttribute("download");
                main_statusbarItem__fileDownload.removeAttribute("href");
                return;
            }

            const fileTypes = new Map<nkch.css.SupportedLanguages, string>([
                ["css", "text/css"],
                ["less", "text/x-less"]
            ]);

            const now = new Date();
            const date = {
                year: now.getFullYear(),
                month: (now.getMonth() + 1).toString().padStart(2, "0"),
                day: now.getDate().toString().padStart(2, "0"),
                hours: now.getHours().toString().padStart(2, "0"),
                minutes: now.getMinutes().toString().padStart(2, "0"),
                seconds: now.getSeconds().toString().padStart(2, "0"),
            };

            const modelLanguage = this.getLanguage();
            const fileName = `${window.location.host} ${date.year}-${date.month}-${date.day} ${date.hours}-${date.minutes}-${date.seconds}.${modelLanguage || "css"}`;
            const fileType = fileTypes.get(modelLanguage) || "text/css";

            main_statusbarItem__fileDownload.setAttribute("download", fileName);
            const url = URL.createObjectURL(new Blob([this.editor.getValue()], { type: fileType }));
            main_statusbarItem__fileDownload.setAttribute("href", url);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, false);
        main_statusbarItem__fileDownload.append(lucide.createElement(lucide.Download, { height: 12, width: 12 }));

        // Upload Action File System hooks
        const main_statusbarItemInput__fileUpload = document.createElement("input");
        main_statusbarItemInput__fileUpload.classList.add("nkch-css__statusbar-item-input", "nkch-css__statusbar-item-input--file-upload");
        main_statusbarItemInput__fileUpload.setAttribute("type", "file");
        main_statusbarItemInput__fileUpload.setAttribute("accept", "text/css,.less");
        main_statusbarItemInput__fileUpload.style.display = "none";
        this.elements.main_statusbarItemInput__fileUpload = main_statusbarItemInput__fileUpload;
        main_statusbarContainer__left.append(main_statusbarItemInput__fileUpload);

        main_statusbarItemInput__fileUpload.addEventListener("change", () => {
            if (!main_statusbarItemInput__fileUpload.files || main_statusbarItemInput__fileUpload.files.length < 1) return;
            const file = main_statusbarItemInput__fileUpload.files[0];

            file.text().then(text => {
                this.setLanguage(file.name.endsWith(".less") ? "less" : "css", true);
                this.setValue(text);
                this.updateCode(text, this.getLanguage());
            });
            main_statusbarItemInput__fileUpload.value = "";
        }, false);

        const main_statusbarItem__fileUpload = document.createElement("a");
        main_statusbarItem__fileUpload.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--file-upload");
        main_statusbarItem__fileUpload.setAttribute("role", "button");
        main_statusbarContainer__left.append(main_statusbarItem__fileUpload);
        main_statusbarItem__fileUpload.addEventListener("click", () => main_statusbarItemInput__fileUpload.click(), false);
        main_statusbarItem__fileUpload.append(lucide.createElement(lucide.Upload, { height: 12, width: 12 }));

        // Markers & Validation Indicators Panel
        const main_statusbarItem__markers = document.createElement("a");
        main_statusbarItem__markers.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--markers");
        main_statusbarContainer__left.append(main_statusbarItem__markers);

        const toggleMarkersPanel = (): void => {
            const isCurrentlyOpen = this.checks.editor.isMarkersPanelOpen;
            this.elements.main_markersPanel.classList.toggle("nkch-css__markers-panel--is-hidden", isCurrentlyOpen);
            this.checks.editor.isMarkersPanelOpen = !isCurrentlyOpen;
        };

        this.elements.main_markersPanelCloseButton.addEventListener("click", toggleMarkersPanel, false);
        main_statusbarItem__markers.addEventListener("click", toggleMarkersPanel, false);

        const main_statusbarItemIcon__markers__error = document.createElement("span");
        main_statusbarItemIcon__markers__error.classList.add("nkch-css__statusbar-item-icon", "nkch-css__statusbar-item-icon--marker", "nkch-css__statusbar-item-icon--marker-error");
        main_statusbarItem__markers.append(main_statusbarItemIcon__markers__error);

        const main_statusbarItemValue__markers__error = document.createElement("span");
        main_statusbarItemValue__markers__error.innerText = "0";
        main_statusbarItem__markers.append(main_statusbarItemValue__markers__error);

        const main_statusbarItemIcon__markers__warning = document.createElement("span");
        main_statusbarItemIcon__markers__warning.classList.add("nkch-css__statusbar-item-icon", "nkch-css__statusbar-item-icon--marker", "nkch-css__statusbar-item-icon--marker-warning");
        main_statusbarItem__markers.append(main_statusbarItemIcon__markers__warning);

        const main_statusbarItemValue__markers__warning = document.createElement("span");
        main_statusbarItemValue__markers__warning.innerText = "0";
        main_statusbarItem__markers.append(main_statusbarItemValue__markers__warning);

        // Right Selection Indicators
        const main_statusbarContainer__right = document.createElement("div");
        main_statusbarContainer__right.classList.add("nkch-css__statusbar-container", "nkch-css__statusbar-container--right");
        main_statusbar.append(main_statusbarContainer__right);

        const main_statusbarItem__selection = document.createElement("a");
        main_statusbarItem__selection.classList.add("nkch-css__statusbar-item");
        main_statusbarItem__selection.setAttribute("role", "button");
        main_statusbarItem__selection.innerText = "L: 1 • C: 1";
        main_statusbarContainer__right.append(main_statusbarItem__selection);

        this.editor.onDidChangeCursorPosition((event) => {
            const selection = this.editor.getSelection();
            const model = this.editor.getModel();
            let text = `L: ${event.position.lineNumber} • C: ${event.position.column}`;

            if (selection && !selection.isEmpty() && model) {
                text += ` • S: ${model.getValueLengthInRange(selection)}`;
            }
            main_statusbarItem__selection.textContent = text;
        });

        main_statusbarItem__selection.addEventListener("click", () => {
            this.editor.focus();
            this.editor.getAction("editor.action.gotoLine")?.run();
        }, false);

        // Real-Time Diagnostic Engine Link
        monaco.editor.onDidChangeMarkers(([uri]) => {
            const markers = monaco.editor.getModelMarkers({ resource: uri });
            const errors = markers.filter(m => m.severity === monaco.MarkerSeverity.Error);
            const warnings = markers.filter(m => m.severity === monaco.MarkerSeverity.Warning);

            main_statusbarItemValue__markers__error.textContent = errors.length.toString();
            main_statusbarItemValue__markers__warning.textContent = warnings.length.toString();

            this.elements.main_markersList.replaceChildren();
            markers.forEach(marker => this.addMarkerItem(marker));
        });
    }

    private addMarkerItem(markerData: monaco.editor.IMarker): void {
        const markerItem = document.createElement("div");
        markerItem.classList.add("nkch-css__marker-item", "nkch-css-marker-item");
        markerItem.title = markerData.message;
        this.elements.main_markersList.append(markerItem);

        const markerItem_icon = document.createElement("span");
        markerItem_icon.classList.add("nkch-css-marker-item__icon");
        markerItem.append(markerItem_icon);

        switch (markerData.severity) {
            case monaco.MarkerSeverity.Error: markerItem_icon.classList.add("nkch-css-marker-item__icon--error"); break;
            case monaco.MarkerSeverity.Warning: markerItem_icon.classList.add("nkch-css-marker-item__icon--warning"); break;
            case monaco.MarkerSeverity.Info: markerItem_icon.classList.add("nkch-css-marker-item__icon--info"); break;
            case monaco.MarkerSeverity.Hint: markerItem_icon.classList.add("nkch-css-marker-item__icon--hint"); break;
        }

        const markerItem_label = document.createElement("span");
        markerItem_label.classList.add("nkch-css-marker-item__label");
        markerItem_label.innerText = markerData.message;
        markerItem.append(markerItem_label);

        if (typeof markerData.source === "string") {
            const markerItem_source = document.createElement("span");
            markerItem_source.classList.add("nkch-css-marker-item__source");
            markerItem_source.innerText = markerData.source;
            markerItem.append(markerItem_source);
        }

        if (typeof markerData.code === "string") {
            const markerItem_code = document.createElement("span");
            markerItem_code.classList.add("nkch-css-marker-item__code");
            markerItem_code.innerText = markerData.code;
            markerItem.append(markerItem_code);
        }

        const markerItem_position = document.createElement("span");
        markerItem_position.classList.add("nkch-css-marker-item__position");
        markerItem_position.innerText = `${markerData.startLineNumber}:${markerData.startColumn}`;
        markerItem.append(markerItem_position);

        markerItem.addEventListener("click", () => {
            this.editor.setSelection({
                startLineNumber: markerData.startLineNumber,
                startColumn: markerData.startColumn,
                endLineNumber: markerData.endLineNumber,
                endColumn: markerData.endColumn
            });
            this.editor.revealLineInCenter(markerData.startLineNumber, monaco.editor.ScrollType.Smooth);
        }, false);
    }

    private loadInitialData(): void {
        let saved: Partial<nkch.css.LocalStorageObject> | null = null;
        try {
            saved = JSON.parse(localStorage.getItem("mw-nkch-css") ?? "null");
        } catch { /* corrupted or blocked storage: start empty */ }

        this.setLanguage(saved?.lang === "less" ? "less" : "css");
        if (typeof saved?.value === "string") this.setValue(saved.value);
    }
}

function onPageLoad() {
    const globalContext = window as any;
    if (globalContext.nkch?.css4) return;

    const isMiraheze = window.location.hostname.includes("miraheze.org");
    const stylesheetUrl = isMiraheze
        ? "https://cdn.jsdelivr.net/gh/Vonavy/nkch-css@main/css/index.css"
        : "https://raw.githack.com/Vonavy/nkch-css/main/css/index.css";

    mw.loader.load(stylesheetUrl, "text/css");

    const options: nkch.css.Options = {};
    (globalContext.nkch ??= {}).css4 = new nkchCSS(options);
}

(() => {
    switch (document.readyState) {
        case "complete":
        case "interactive":
            onPageLoad();
            return;
        case "loading":
            window.addEventListener("load", onPageLoad, false);
            return;
    }
})();