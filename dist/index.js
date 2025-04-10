"use strict";
// Hello from TypeScript
/// <reference types="../node_modules/monaco-editor/monaco" />
/// <reference types="../node_modules/types-mediawiki" />
class nkchCSS {
    editor;
    options;
    checks;
    elements;
    env;
    versions;
    constructor(options) {
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
                drag: {
                    isHolding: false,
                    isDragging: false,
                },
                resize: {
                    isHolding: false,
                    isResizing: false
                }
            },
            code: {
                isInvalid: false
            }
        };
        this.elements = {};
        this.env = {
            skin: mw.config.get("skin"),
            lang: mw.config.get("wgScriptPath").replace("/", ""),
            theme: mw.config.get("isDarkTheme") ? "dark" : "light"
        };
        this.versions = new Map([
            ["monaco-editor", "0.52.2"],
            ["less", "4.2.1"]
        ]);
        this.initialize();
    }
    open(event) {
        event?.preventDefault();
        if (!this.checks.editor.isInitialized)
            return this.initializeEditor();
        else if (this.checks.editor.isOpen)
            return;
        this.elements.main.classList.remove("nkch-css--is-closed");
        const showAnimation = this.elements.main.animate([{
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
    close(event) {
        event?.preventDefault();
        if (!this.checks.editor.isInitialized)
            return this.initializeEditor();
        else if (!this.checks.editor.isOpen)
            return;
        const hideAnimation = this.elements.main.animate([{
                opacity: 1,
                transform: "translateY(0)"
            }, {
                opacity: 0,
                transform: "translateY(10px)"
            }], {
            duration: 300,
            easing: "ease"
        });
        hideAnimation.onfinish = () => this.elements.main.classList.add("nkch-css--is-closed");
        this.elements.main.dispatchEvent(new CustomEvent("nkch-css-close", {
            cancelable: true,
            detail: this
        }));
        this.checks.editor.isOpen = false;
    }
    toggle(state) {
        switch (state) {
            case true:
                this.elements.main_headerButton__toggle.classList.add("is-enabled");
                this.elements.main_headerButton__toggle.classList.remove("is-disabled");
                this.checks.editor.isEnabled = true;
                this.updateCode(this.editor.getValue(), this.getLanguage());
                break;
            case false:
                this.elements.main_headerButton__toggle.classList.add("is-disabled");
                this.elements.main_headerButton__toggle.classList.remove("is-enabled");
                this.checks.editor.isEnabled = false;
                this.elements.style.innerHTML = "";
                break;
        }
    }
    updateCode(code, language, saveToStorage = true) {
        if (!this.checks.editor.isEnabled)
            return;
        if (saveToStorage) {
            localStorage.setItem("mw-nkch-css", JSON.stringify({ lang: language, value: code }));
        }
        switch (language) {
            default:
            case "css":
                this.checks.code.isInvalid = false;
                this.elements.style.innerHTML = code;
                break;
            case "less":
                less.render(code)
                    .then(output => {
                    this.checks.code.isInvalid = false;
                    this.elements.main_action__compileLess.classList.toggle("nkch-css__action--is-disabled", false);
                    this.updateCode(output.css, "css", false);
                })
                    .catch(() => {
                    this.checks.code.isInvalid = true;
                    this.elements.main_action__compileLess.classList.toggle("nkch-css__action--is-disabled", true);
                });
                break;
        }
        this.elements.main.dispatchEvent(new CustomEvent("nkch-css-update", {
            cancelable: true,
            detail: this
        }));
    }
    setValue(text) {
        let model = this.editor.getModel();
        if (model) {
            this.editor.pushUndoStop();
            this.editor.executeEdits("", [{
                    range: model.getFullModelRange(),
                    text: text
                }]);
            this.updateCode(this.editor.getValue(), this.getLanguage());
        }
    }
    getLanguage() {
        let model = this.editor.getModel();
        return model.getLanguageId();
    }
    setLanguage(lang, changeTab = true) {
        let model = this.editor.getModel();
        if (model)
            monaco.editor.setModelLanguage(model, lang);
        if (changeTab) {
            switch (lang) {
                case "css":
                    this.elements.main_tab__css.classList.toggle("nkch-css__tab--is-selected", true);
                    this.elements.main_tab__less.classList.toggle("nkch-css__tab--is-selected", false);
                    break;
                case "less":
                    this.elements.main_tab__less.classList.toggle("nkch-css__tab--is-selected", true);
                    this.elements.main_tab__css.classList.toggle("nkch-css__tab--is-selected", false);
                    break;
            }
        }
    }
    compileLess(code) {
        if (this.getLanguage() !== "less")
            return;
        less.render(code)
            .then(output => {
            if (!this.checks.code.isInvalid) {
                this.setValue(output.css);
                this.setLanguage("css");
                this.updateCode(output.css, "css");
            }
        });
    }
    enablePicker() {
        document.querySelector("html").classList.add("nkch-css-html-picker-enabled");
        this.elements.main.classList.add("nkch-css--is-picker-enabled");
        this.checks.editor.isPickerEnabled = true;
    }
    disablePicker() {
        document.querySelector("html").classList.remove("nkch-css-html-picker-enabled");
        this.elements.main.classList.remove("nkch-css--is-picker-enabled");
        this.checks.editor.isPickerEnabled = false;
        this.removePickerSelector();
    }
    removePickerSelector() {
        document.querySelectorAll(".nkch-css-picker-element")
            .forEach(el => el.classList.remove("nkch-css-picker-element"));
    }
    getParents(element) {
        let parents = [], currentElement = element, reachedEnd = false;
        while (reachedEnd != true) {
            let parent = currentElement.parentElement;
            if (parent) {
                parents.push(parent);
                currentElement = parent;
            }
            else {
                reachedEnd = true;
            }
        }
        return parents;
    }
    getSelector(element) {
        if (element.id)
            return '#' + element.id;
        if (element.tagName.toLowerCase() === "body")
            return "body";
        if (element.classList) {
            let classList = new Set(Array.from(element.classList));
            classList.delete("nkch-css-picker-element");
            if (classList.size > 0)
                return "." + Array.from(classList).join(".");
        }
        if (element.parentElement)
            return `${this.getSelector(element.parentElement)} > ${element.tagName.toLowerCase()}`;
        else
            return element.tagName.toLowerCase();
    }
    initialize() {
        switch (this.env.skin) {
            case "fandomdesktop":
                /* ~ quickbar item ~ */
                const quickbarItem = document.createElement("li");
                quickbarItem.classList.add("nkch-css__quickbar-button");
                this.elements.quickbarItem = quickbarItem;
                /* ~ quickbar item : spinner ~ */
                const quickbarItem_spinner = document.createElement("span");
                quickbarItem_spinner.classList.add("nkch-css__quickbar-button-spinner", "is-hidden");
                this.elements.quickbarItem_spinner = quickbarItem_spinner;
                quickbarItem.append(quickbarItem_spinner);
                /* ~ quickbar item : link ~ */
                const quickbarItem_link = document.createElement("a");
                quickbarItem_link.classList.add("nkch-css__quickbar-button-link");
                quickbarItem_link.setAttribute("href", "#");
                quickbarItem_link.innerHTML = "nkchCSS";
                this.elements.quickbarItem_link = quickbarItem_link;
                quickbarItem.append(quickbarItem_link);
                quickbarItem_link.addEventListener("click", () => this.open(), false);
                document.querySelector("#WikiaBar .toolbar .tools").append(quickbarItem);
                break;
            default:
            case "vector":
            case "vector-2022":
                /* ~ sidebar item ~ */
                const sidebarItem = document.createElement("li");
                sidebarItem.classList.add("nkch-css__sidebar-button", "mw-list-item");
                sidebarItem.id = "n-nkchcss";
                this.elements.sidebarItem = sidebarItem;
                document.querySelector("#mw-panel .vector-menu-content-list").append(sidebarItem);
                /* ~ sidebar item : spinner ~ */
                const sidebarItem_spinner = document.createElement("span");
                sidebarItem_spinner.classList.add("nkch-css__sidebar-button-spinner", "is-hidden");
                this.elements.sidebarItem_spinner = sidebarItem_spinner;
                sidebarItem.append(sidebarItem_spinner);
                /* ~ sidebar item : link ~ */
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
    async initializeEditor() {
        let targetSpinner;
        switch (this.env.skin) {
            case "fandomdesktop":
                targetSpinner = this.elements.quickbarItem_spinner;
                break;
            default:
            case "vector":
            case "vector-2022":
                targetSpinner = this.elements.sidebarItem_spinner;
                break;
        }
        targetSpinner.classList.remove("is-hidden");
        mw.loader.load([
            `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs/editor/editor.main.min.css`,
        ], "text/css");
        await mw.loader.getScript("https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.js");
        await mw.loader.getScript(`https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs/loader.min.js`);
        this.onModuleLoad();
    }
    onModuleLoad() {
        function getPreferredLanguage() {
            const supportedLanguages = ["en", "de", "es", "fr", "it", "ja", "ko", "ru", "zh-cn", "zh-tw"];
            for (const lang of navigator.languages) {
                const normalizedLang = lang.toLowerCase();
                if (supportedLanguages.includes(normalizedLang)) {
                    return normalizedLang;
                }
            }
            return "en";
        }
        require.config({
            paths: {
                "less": `https://cdnjs.cloudflare.com/ajax/libs/less.js/${this.versions.get("less")}/less.min`,
                "vs": `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${this.versions.get("monaco-editor")}/min/vs`,
            },
            // @ts-ignore
            "vs/nls": {
                availableLanguages: {
                    "*": getPreferredLanguage()
                }
            },
            waitSeconds: 100
        });
        require(["less", "vs/editor/editor.main"], () => {
            /* ~ style ~ */
            const style = document.createElement("style");
            style.classList.add("nkch-css-style");
            this.elements.style = style;
            document.head.append(style);
            /* ~ main ~ */
            const main = document.createElement("div");
            main.classList.add("nkch-css");
            this.elements.main = main;
            document.body.after(main);
            let main_position = {
                x: 0,
                y: 0
            };
            main.style.position = "fixed";
            main.addEventListener("mousedown", e => {
                if (e.button !== 0)
                    return;
                let cancelElements = [main_splitView, main_statusbar, main_headerButtonGroup, main_actions, main_tabs, main_statusbar], parents = this.getParents(e.target);
                for (let element of cancelElements) {
                    if (parents.includes(element))
                        return;
                }
                this.checks.state.drag.isHolding = true;
                main_position.x = e.clientX;
                main_position.y = e.clientY;
                this.elements.main.dispatchEvent(new CustomEvent("nkch-css-drag:hold", {
                    cancelable: true,
                    detail: this
                }));
            }, false);
            main.addEventListener("mouseup", () => {
                this.checks.state.drag.isHolding = false;
                this.checks.state.drag.isDragging = false;
                main.classList.remove("nkch-css--is-dragging");
                this.elements.main.dispatchEvent(new CustomEvent("nkch-css-drag:release", {
                    cancelable: true,
                    detail: this
                }));
            }, false);
            window.addEventListener("mousemove", e => {
                if (this.checks.state.drag.isHolding) {
                    this.checks.state.drag.isDragging = true;
                    main.style.top = main.offsetTop - (main_position.y - e.clientY) + "px";
                    main.style.left = main.offsetLeft - (main_position.x - e.clientX) + "px";
                    main.style.bottom = "auto";
                    main.style.right = "auto";
                    main_position.x = e.clientX;
                    main_position.y = e.clientY;
                    main.classList.add("nkch-css--is-dragging");
                    this.elements.main.dispatchEvent(new CustomEvent("nkch-css-drag", {
                        cancelable: true,
                        detail: this
                    }));
                }
            }, false);
            /* ~ main : container ~ */
            const main_container = document.createElement("div");
            main_container.classList.add("nkch-css__container");
            this.elements.main_container = main_container;
            main.append(main_container);
            /* ~ main : header ~ */
            const main_header = document.createElement("div");
            main_header.classList.add("nkch-css__header");
            this.elements.main_header = main_header;
            main_container.append(main_header);
            /* ~ main : header left ~ */
            const main_headerLeft = document.createElement("div");
            main_headerLeft.classList.add("nkch-css__header-left");
            this.elements.main_headerLeft = main_headerLeft;
            main_header.append(main_headerLeft);
            /* ~ main : header title ~ */
            const main_headerTitle = document.createElement("div");
            main_headerTitle.classList.add("nkch-css__header-title");
            main_headerTitle.innerHTML = "nkchCSS";
            this.elements.main_headerTitle = main_headerTitle;
            main_headerLeft.append(main_headerTitle);
            /* ~ main : header right ~ */
            const main_headerRight = document.createElement("div");
            main_headerRight.classList.add("nkch-css__header-right");
            this.elements.main_headerRight = main_headerRight;
            main_header.append(main_headerRight);
            /* ~ main : header button group ~ */
            const main_headerButtonGroup = document.createElement("div");
            main_headerButtonGroup.classList.add("nkch-css__header-button-group");
            this.elements.main_headerButtonGroup = main_headerButtonGroup;
            main_headerRight.append(main_headerButtonGroup);
            /* ~ main : header button (beautify) ~ */
            const main_headerButton__beautify = document.createElement("button");
            main_headerButton__beautify.classList.add("nkch-css__header-button", "nkch-css__header-button--beautify");
            main_headerButton__beautify.setAttribute("type", "button");
            this.elements.main_headerButton__beautify = main_headerButton__beautify;
            main_headerButtonGroup.append(main_headerButton__beautify);
            main_headerButton__beautify.addEventListener("click", () => this.editor.getAction("editor.action.formatDocument")?.run(), false);
            /* ~ [svg] main : header button icon (beautify) ~ */
            //@ts-ignore
            main_headerButton__beautify.append(lucide.createElement(lucide.Sparkles, { height: 18, width: 18 }));
            /* ~ main : header button (toggle) ~ */
            const main_headerButton__toggle = document.createElement("button");
            main_headerButton__toggle.classList.add("nkch-css__header-button", "nkch-css__header-button--toggle", this.checks.editor.isEnabled ? "is-enabled" : "is-disabled");
            main_headerButton__toggle.setAttribute("type", "button");
            this.elements.main_headerButton__toggle = main_headerButton__toggle;
            main_headerButtonGroup.append(main_headerButton__toggle);
            main_headerButton__toggle.addEventListener("click", () => this.toggle(!this.checks.editor.isEnabled), false);
            /* ~ [svg] main : header button icon (toggle) ~ */
            //@ts-ignore
            main_headerButton__toggle.append(lucide.createElement(lucide.Eye, { height: 18, width: 18 }));
            /* ~ main : header button (close) ~ */
            const main_headerButton__close = document.createElement("button");
            main_headerButton__close.classList.add("nkch-css__header-button", "nkch-css__header-button--close");
            main_headerButton__close.setAttribute("type", "button");
            this.elements.main_headerButton__close = main_headerButton__close;
            main_headerButtonGroup.append(main_headerButton__close);
            main_headerButton__close.addEventListener("click", () => this.close(), false);
            /* ~ [svg] main : header button icon (close) ~ */
            //@ts-ignore
            main_headerButton__close.append(lucide.createElement(lucide.X, { height: 18, width: 18 }));
            /* ~ main : content ~ */
            const main_content = document.createElement("div");
            main_content.classList.add("nkch-css__content");
            this.elements.main_content = main_content;
            main_container.append(main_content);
            /* ~ main : actions header ~ */
            const main_actionsHeader = document.createElement("div");
            main_actionsHeader.classList.add("nkch-css__actions-header");
            this.elements.main_actionsHeader = main_actionsHeader;
            main_content.append(main_actionsHeader);
            /* ~ main : tabs ~ */
            const main_tabs = document.createElement("div");
            main_tabs.classList.add("nkch-css__tabs");
            this.elements.main_tabs = main_tabs;
            main_actionsHeader.append(main_tabs);
            /* ~ main : tab (css) ~ */
            const main_tab__css = document.createElement("div");
            main_tab__css.classList.add("nkch-css__tab", "nkch-css__tab--css");
            main_tab__css.innerText = "CSS";
            this.elements.main_tab__css = main_tab__css;
            main_tabs.append(main_tab__css);
            main_tab__css.addEventListener("click", () => this.setLanguage("css", true), false);
            /* ~ main : tab (less) ~ */
            const main_tab__less = document.createElement("div");
            main_tab__less.classList.add("nkch-css__tab", "nkch-css__tab--less");
            main_tab__less.innerText = "Less";
            this.elements.main_tab__less = main_tab__less;
            main_tabs.append(main_tab__less);
            main_tab__less.addEventListener("click", () => this.setLanguage("less", true), false);
            /* ~ main : actions ~ */
            const main_actions = document.createElement("div");
            main_actions.classList.add("nkch-css__actions");
            this.elements.actions = main_actions;
            main_actionsHeader.append(main_actions);
            /* ~ main : action (compile less) ~ */
            const main_action__compileLess = document.createElement("button");
            main_action__compileLess.classList.add("nkch-css__action", "nkch-css__action--compile-less");
            main_action__compileLess.setAttribute("type", "button");
            main_action__compileLess.innerText = "Less → CSS";
            this.elements.main_action__compileLess = main_action__compileLess;
            main_actions.append(main_action__compileLess);
            main_action__compileLess.addEventListener("click", () => {
                this.compileLess(this.editor.getValue());
            });
            /* ~ main : action (picker) ~ */
            const main_action__picker = document.createElement("button");
            main_action__picker.classList.add("nkch-css__action", "nkch-css__action--pointer");
            main_action__picker.setAttribute("type", "button");
            //@ts-ignore
            main_action__picker.append(lucide.createElement(lucide.SquareDashedMousePointer, { height: 18, width: 18 }));
            this.elements.main_action__picker = main_action__picker;
            main_actions.append(main_action__picker);
            main_action__picker.addEventListener("click", () => {
                this.enablePicker();
            });
            let pickerTarget;
            document.addEventListener("mousemove", e => {
                if (!this.checks.editor.isPickerEnabled)
                    return;
                if (pickerTarget && pickerTarget !== e.target)
                    this.removePickerSelector();
                pickerTarget = e.target;
                pickerTarget.classList.add("nkch-css-picker-element");
            }, false);
            document.addEventListener("mousedown", e => {
                if (!this.checks.editor.isPickerEnabled)
                    return;
                let element = e.target;
                let pickerBlocker = document.createElement("div");
                pickerBlocker.classList.add("nkch-css-picker-blocker");
                document.body.append(pickerBlocker);
                pickerBlocker.addEventListener("mouseup", () => {
                    pickerBlocker.remove();
                    this.disablePicker();
                    let selections = this.editor.getSelections();
                    if (selections) {
                        let edits = [], text = this.getSelector(element);
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
            document.addEventListener("keydown", e => {
                if (e.key === "Escape" && this.checks.editor.isPickerEnabled)
                    this.disablePicker();
            }, false);
            const pickerTooltip = document.createElement("div");
            pickerTooltip.classList.add("nkch-css-picker-tooltip");
            document.body.append(pickerTooltip);
            document.addEventListener("mousemove", e => {
                let target = e.target;
                let leftPosition = e.pageX + 10;
                if (leftPosition + pickerTooltip.offsetWidth > window.innerWidth)
                    leftPosition = e.pageX - pickerTooltip.offsetWidth - 10;
                let topPosition = e.pageY + 10;
                if (topPosition + pickerTooltip.offsetHeight > window.innerHeight)
                    topPosition = e.pageY - pickerTooltip.offsetHeight - 10;
                pickerTooltip.style.left = leftPosition + "px";
                pickerTooltip.style.top = topPosition + "px";
                pickerTooltip.textContent = this.getSelector(target);
            }, false);
            /* ~ main : split view ~ */
            const main_splitView = document.createElement("div");
            main_splitView.classList.add("nkch-css__split-view");
            this.elements.main_codearea = main_splitView;
            main_content.append(main_splitView);
            let splitViewRect = main_splitView.getBoundingClientRect();
            main_splitView.style.width = `${splitViewRect.width}px`;
            main_splitView.style.height = `${splitViewRect.height}px`;
            /* ~ main : codearea ~ */
            const main_codearea = document.createElement("div");
            main_codearea.classList.add("nkch-css__codearea");
            this.elements.main_codearea = main_codearea;
            main_splitView.append(main_codearea);
            let editorThemes = new Map([
                ["light", "vs"],
                ["dark", "vs-dark"]
            ]);
            this.editor = monaco.editor.create(main_codearea, {
                language: "css",
                theme: editorThemes.get(this.env.theme),
                fontSize: 13,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                scrollbar: {
                    useShadows: false
                },
                minimap: {
                    enabled: false
                },
                stickyScroll: {
                    enabled: true
                }
            });
            setInterval(() => {
                let targetTheme = mw.config.get("isDarkTheme") ? "dark" : "light";
                if (this.env.theme !== targetTheme) {
                    monaco.editor.setTheme(editorThemes.get(targetTheme));
                    this.env.theme = targetTheme;
                }
            }, 100);
            this.editor.onDidChangeModelContent(() => {
                this.updateCode(this.editor.getValue(), this.getLanguage());
            });
            let completionItemProviders = [{
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
                        else
                            return { suggestions: [] };
                    },
                }, {
                    triggerCharacters: ["--"],
                    provideCompletionItems: (model, position) => {
                        const word = model.getWordUntilPosition(position);
                        let editorProperties = getEditorCustomProperties(), filteredProperties = getAllCustomProperties().filter(item => !editorProperties.includes(item));
                        const suggestions = filteredProperties.map(property => {
                            return {
                                label: property,
                                kind: monaco.languages.CompletionItemKind.Property,
                                insertText: property,
                                range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)
                            };
                        });
                        return { suggestions: suggestions };
                        function getAllCustomProperties() {
                            const customProperties = new Set();
                            const styleSheets = Array.from(document.styleSheets).filter(sheet => !sheet.href || sheet.href.startsWith(window.location.origin));
                            styleSheets.forEach(sheet => {
                                const cssRules = sheet.cssRules;
                                for (let i = 0; i < cssRules.length; i++) {
                                    const cssRule = cssRules[i];
                                    if (cssRule instanceof CSSStyleRule) {
                                        const declarations = cssRule.style;
                                        Array.from(declarations).forEach(property => {
                                            if (property.startsWith("--") && !property.startsWith("--vscode"))
                                                customProperties.add(property);
                                        });
                                    }
                                }
                            });
                            return Array.from(customProperties);
                        }
                        function getEditorCustomProperties() {
                            let existingProperties = [], content = model.getValue(), propertyRegex = /--([^:;]+)\s*:\s*([^;]+);/g, match;
                            while ((match = propertyRegex.exec(content)) !== null) {
                                existingProperties.push(`--${match[1].trim()}`);
                            }
                            return existingProperties;
                        }
                    }
                }];
            completionItemProviders.forEach(itemProvider => monaco.languages.registerCompletionItemProvider(["css", "less"], itemProvider));
            let storageValue = localStorage.getItem("mw-nkch-css");
            if (storageValue != null) {
                let storageObject = JSON.parse(storageValue);
                this.setValue(storageObject.value);
                this.setLanguage(storageObject.lang);
            }
            else
                this.setLanguage("css");
            /* ~ main : markers panel ~ */
            const main_markersPanel = document.createElement("div");
            main_markersPanel.classList.add("nkch-css__markers-panel", "nkch-css__markers-panel--is-hidden");
            this.elements.main_markersPanel = main_markersPanel;
            main_splitView.append(main_markersPanel);
            /* ~ main : markers panel header ~ */
            const main_markersPanelHeader = document.createElement("div");
            main_markersPanelHeader.classList.add("nkch-css__markers-panel-header");
            this.elements.main_markersPanelHeader = main_markersPanelHeader;
            main_markersPanel.append(main_markersPanelHeader);
            /* ~ main : markers panel close button ~ */
            const main_markersPanelCloseButton = document.createElement("button");
            main_markersPanelCloseButton.classList.add("nkch-css__markers-panel-close-button");
            this.elements.main_markersPanelCloseButton = main_markersPanelCloseButton;
            main_markersPanelHeader.append(main_markersPanelCloseButton);
            /* ~ [svg] main : markers panel close button icon ~ */
            //@ts-ignore
            main_markersPanelCloseButton.append(lucide.createElement(lucide.X, { width: 18, height: 18 }));
            /* ~ main : markers list ~ */
            const main_markersList = document.createElement("div");
            main_markersList.classList.add("nkch-css__markers-list");
            this.elements.main_markersList = main_markersList;
            main_markersPanel.append(main_markersList);
            monaco.editor.onDidChangeMarkers(([uri]) => {
                const markers = monaco.editor.getModelMarkers({ resource: uri });
                let markersError = markers.filter(element => element.severity === monaco.MarkerSeverity.Error);
                let markersWarning = markers.filter(element => element.severity === monaco.MarkerSeverity.Warning);
                main_statusbarItemValue__markers__error.innerText = markersError.length.toString();
                main_statusbarItemValue__markers__warning.innerText = markersWarning.length.toString();
                main_markersList.innerHTML = "";
                for (let marker of markers) {
                    addMarkerItem(marker);
                }
            });
            let addMarkerItem = (markerData) => {
                /* ~ marker item ~ */
                let markerItem = document.createElement("div");
                markerItem.classList.add("nkch-css__marker-item", "nkch-css-marker-item");
                markerItem.title = markerData.message;
                main_markersList.append(markerItem);
                /* ~ marker item : icon ~ */
                let markerItem_icon = document.createElement("span");
                markerItem_icon.classList.add("nkch-css-marker-item__icon");
                markerItem.append(markerItem_icon);
                switch (markerData.severity) {
                    case monaco.MarkerSeverity.Error:
                        markerItem_icon.classList.add("nkch-css-marker-item__icon--error");
                        break;
                    case monaco.MarkerSeverity.Warning:
                        markerItem_icon.classList.add("nkch-css-marker-item__icon--warning");
                        break;
                    case monaco.MarkerSeverity.Info:
                        markerItem_icon.classList.add("nkch-css-marker-item__icon--info");
                        break;
                    case monaco.MarkerSeverity.Hint:
                        markerItem_icon.classList.add("nkch-css-marker-item__icon--hint");
                        break;
                }
                /* ~ marker item : label ~ */
                let markerItem_label = document.createElement("span");
                markerItem_label.classList.add("nkch-css-marker-item__label");
                markerItem_label.innerText = markerData.message;
                markerItem.append(markerItem_label);
                if ("string" === typeof markerData.source) {
                    let markerItem_source = document.createElement("span");
                    markerItem_source.classList.add("nkch-css-marker-item__source");
                    markerItem_source.innerText = markerData.source;
                    markerItem.append(markerItem_source);
                }
                if ("string" === typeof markerData.code) {
                    let markerItem_code = document.createElement("span");
                    markerItem_code.classList.add("nkch-css-marker-item__code");
                    markerItem_code.innerText = markerData.code;
                    markerItem.append(markerItem_code);
                }
                /* ~ marker item : position ~ */
                let markerItem_position = document.createElement("span");
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
            };
            /* ~ main : resizer ~ */
            const main_resizer = document.createElement("div");
            main_resizer.classList.add("nkch-css__resizer");
            this.elements.main_resizer = main_resizer;
            main_splitView.append(main_resizer);
            let mouse_position = { x: 0, y: 0 }, codearea_size = { width: 0, height: 0 }, codearea_clientRect;
            main_resizer.addEventListener("mousedown", e => {
                this.checks.state.resize.isHolding = true;
                codearea_clientRect = main_splitView.getBoundingClientRect();
                mouse_position = { x: e.clientX, y: e.clientY };
                codearea_size = { width: codearea_clientRect.width, height: codearea_clientRect.height };
                this.elements.main.dispatchEvent(new CustomEvent("nkch-css-resize:hold", {
                    cancelable: true,
                    detail: this
                }));
            }, false);
            window.addEventListener("mouseup", () => {
                this.checks.state.resize.isHolding = false;
                this.checks.state.resize.isResizing = false;
                this.elements.main.dispatchEvent(new CustomEvent("nkch-css-resize:release", {
                    cancelable: true,
                    detail: this
                }));
            }, false);
            window.addEventListener("mousemove", e => {
                if (this.checks.state.resize.isHolding) {
                    this.checks.state.resize.isResizing = true;
                    let calculatedWidth = codearea_size.width + e.clientX - mouse_position.x, calculatedHeight = codearea_size.height + e.clientY - mouse_position.y;
                    if (calculatedWidth >= 450)
                        main_splitView.style.width = calculatedWidth + "px";
                    if (calculatedHeight >= 280)
                        main_splitView.style.height = calculatedHeight + "px";
                    this.elements.main.dispatchEvent(new CustomEvent("nkch-css-resize", {
                        cancelable: true,
                        detail: this
                    }));
                }
            }, false);
            /* ~ main : statusbar ~ */
            const main_statusbar = document.createElement("div");
            main_statusbar.classList.add("nkch-css__statusbar");
            this.elements.main_statusbar = main_statusbar;
            main_content.append(main_statusbar);
            /* ~ main : statusbar container (left) ~ */
            const main_statusbarContainer__left = document.createElement("div");
            main_statusbarContainer__left.classList.add("nkch-css__statusbar-container", "nkch-css__statusbar-container--left");
            this.elements.main_statusbarContainer__left = main_statusbarContainer__left;
            main_statusbar.append(main_statusbarContainer__left);
            /* ~ main : statusbar item (file download) ~ */
            const main_statusbarItem__fileDownload = document.createElement("a");
            main_statusbarItem__fileDownload.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--file-download");
            main_statusbarItem__fileDownload.setAttribute("role", "button");
            this.elements.main_statusbarItem__fileDownload = main_statusbarItem__fileDownload;
            main_statusbarContainer__left.append(main_statusbarItem__fileDownload);
            let downloadFile = () => {
                if (this.editor.getValue().replaceAll(" ", "").replaceAll("\n", "").length < 1) {
                    main_statusbarItem__fileDownload.removeAttribute("download");
                    main_statusbarItem__fileDownload.removeAttribute("href");
                    return;
                }
                let fileTypes = new Map([
                    ["css", "text/css"],
                    ["less", "text/x-less"]
                ]);
                let now = new Date(), date = {
                    year: now.getFullYear(),
                    month: (now.getMonth() + 1).toString().padStart(2, "0"),
                    day: now.getDate().toString().padStart(2, "0"),
                    hours: now.getHours().toString().padStart(2, "0"),
                    minutes: now.getMinutes().toString().padStart(2, "0"),
                    seconds: now.getSeconds().toString().padStart(2, "0"),
                };
                let modelLanguage = this.getLanguage();
                let fileName = `${window.location.host} ${date.year}-${date.month}-${date.day} ${date.hours}-${date.minutes}-${date.seconds}.${modelLanguage ?? "css"}`, fileType = modelLanguage ? fileTypes.get(modelLanguage) : "text/css";
                main_statusbarItem__fileDownload.setAttribute("download", fileName);
                main_statusbarItem__fileDownload.setAttribute("href", URL.createObjectURL(new Blob([this.editor.getValue()], { type: fileType })));
            };
            main_statusbarItem__fileDownload.addEventListener("click", downloadFile, false);
            /* ~ [svg] main : statusbar item icon (file download) ~ */
            //@ts-ignore
            main_statusbarItem__fileDownload.append(lucide.createElement(lucide.Download, { height: 12, width: 12 }));
            /* ~ main : statusbar item input (file upload) ~ */
            const main_statusbarItemInput__fileUpload = document.createElement("input");
            main_statusbarItemInput__fileUpload.classList.add("nkch-css__statusbar-item-input", "nkch-css__statusbar-item-input--file-upload");
            main_statusbarItemInput__fileUpload.setAttribute("type", "file");
            main_statusbarItemInput__fileUpload.setAttribute("accept", "text/css,.less");
            main_statusbarItemInput__fileUpload.setAttribute("name", "nkch-css__statusbar-item-input--file-upload");
            main_statusbarItemInput__fileUpload.style.display = "none";
            this.elements.main_statusbarItemInput__fileUpload = main_statusbarItemInput__fileUpload;
            main_statusbarContainer__left.append(main_statusbarItemInput__fileUpload);
            let uploadFile = () => {
                if (!main_statusbarItemInput__fileUpload.files || main_statusbarItemInput__fileUpload.files.length < 1)
                    return;
                let file = main_statusbarItemInput__fileUpload.files[0];
                file.text().then(text => {
                    if (file.name.endsWith(".css"))
                        this.setLanguage("css", true);
                    else if (file.name.endsWith(".less"))
                        this.setLanguage("less", true);
                    this.setValue(text);
                    this.updateCode(this.editor.getValue(), this.getLanguage());
                });
                main_statusbarItemInput__fileUpload.value = "";
            };
            main_statusbarItemInput__fileUpload.addEventListener("change", uploadFile, false);
            /* ~ main : statusbar item (file upload) ~ */
            const main_statusbarItem__fileUpload = document.createElement("a");
            main_statusbarItem__fileUpload.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--file-upload");
            main_statusbarItem__fileUpload.setAttribute("role", "button");
            this.elements.main_statusbarItem__fileUpload = main_statusbarItem__fileUpload;
            main_statusbarContainer__left.append(main_statusbarItem__fileUpload);
            main_statusbarItem__fileUpload.addEventListener("click", () => main_statusbarItemInput__fileUpload.click(), false);
            /* ~ [svg] main : statusbar item icon (file upload) ~ */
            //@ts-ignore
            main_statusbarItem__fileUpload.append(lucide.createElement(lucide.Upload, { height: 12, width: 12 }));
            /* ~ main : statusbar item (markers) ~ */
            const main_statusbarItem__markers = document.createElement("a");
            main_statusbarItem__markers.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--markers");
            this.elements.main_statusbarItem__markers = main_statusbarItem__markers;
            main_statusbarContainer__left.append(main_statusbarItem__markers);
            let toggleMarkersPanel = () => {
                if (this.checks.editor.isMarkersPanelOpen) {
                    this.elements.main_markersPanel.classList.add("nkch-css__markers-panel--is-hidden");
                    this.checks.editor.isMarkersPanelOpen = false;
                }
                else {
                    this.elements.main_markersPanel.classList.remove("nkch-css__markers-panel--is-hidden");
                    this.checks.editor.isMarkersPanelOpen = true;
                }
            };
            main_markersPanelCloseButton.addEventListener("click", toggleMarkersPanel, false);
            main_statusbarItem__markers.addEventListener("click", toggleMarkersPanel, false);
            /* ~ main : statusbar item icon (markers) (error) ~ */
            const main_statusbarItemIcon__markers__error = document.createElement("span");
            main_statusbarItemIcon__markers__error.classList.add("nkch-css__statusbar-item-icon", "nkch-css__statusbar-item-icon--marker", "nkch-css__statusbar-item-icon--marker-error");
            this.elements.main_statusbarItemIcon__markers__error = main_statusbarItemIcon__markers__error;
            main_statusbarItem__markers.append(main_statusbarItemIcon__markers__error);
            /* ~ main : statusbar item value (markers) (error) ~ */
            const main_statusbarItemValue__markers__error = document.createElement("span");
            main_statusbarItemValue__markers__error.innerText = "0";
            this.elements.main_statusbarItemValue__markers__error = main_statusbarItemValue__markers__error;
            main_statusbarItem__markers.append(main_statusbarItemValue__markers__error);
            /* ~ main : statusbar item icon (markers) (warning) ~ */
            const main_statusbarItemIcon__markers__warning = document.createElement("span");
            main_statusbarItemIcon__markers__warning.classList.add("nkch-css__statusbar-item-icon", "nkch-css__statusbar-item-icon--marker", "nkch-css__statusbar-item-icon--marker-warning");
            this.elements.main_statusbarItemIcon__markers__warning = main_statusbarItemIcon__markers__warning;
            main_statusbarItem__markers.append(main_statusbarItemIcon__markers__warning);
            /* ~ main : statusbar item value (markers) (warning) ~ */
            const main_statusbarItemValue__markers__warning = document.createElement("span");
            main_statusbarItemValue__markers__warning.innerText = "0";
            this.elements.main_statusbarItemValue__markers__warning = main_statusbarItemValue__markers__warning;
            main_statusbarItem__markers.append(main_statusbarItemValue__markers__warning);
            /* ~ main : statusbar container (right) ~ */
            const main_statusbarContainer__right = document.createElement("div");
            main_statusbarContainer__right.classList.add("nkch-css__statusbar-container", "nkch-css__statusbar-container--right");
            this.elements.main_statusbarContainer__right = main_statusbarContainer__right;
            main_statusbar.append(main_statusbarContainer__right);
            /* ~ main : statusbar item (selection) ~ */
            const main_statusbarItem__selection = document.createElement("a");
            main_statusbarItem__selection.classList.add("nkch-css__statusbar-item", "nkch-css__statusbar-item--file-upload");
            main_statusbarItem__selection.setAttribute("role", "button");
            main_statusbarItem__selection.innerText = "L: 1 • C: 1";
            this.elements.main_statusbarItem__selection = main_statusbarItem__selection;
            main_statusbarContainer__right.append(main_statusbarItem__selection);
            this.editor.onDidChangeCursorPosition((event) => {
                main_statusbarItem__selection.innerText = `L: ${event.position.lineNumber} • C: ${event.position.column}`;
                let selection = this.editor.getSelection(), model = this.editor.getModel();
                if (!selection?.isEmpty() && model)
                    main_statusbarItem__selection.innerText += ` • S: ${model.getValueInRange(selection.toJSON()).length}`;
            });
            main_statusbarItem__selection.addEventListener("click", () => {
                this.editor.focus();
                this.editor.getAction("editor.action.gotoLine")?.run();
            }, false);
            switch (this.env.skin) {
                case "fandomdesktop":
                    this.elements.quickbarItem_spinner.classList.add("is-hidden");
                    break;
                case "vector":
                case "vector-2022":
                    this.elements.sidebarItem_spinner.classList.add("is-hidden");
                    break;
            }
            this.checks.editor.isInitialized = true;
            this.open();
        });
    }
}
function onPageLoad() {
    let options = {};
    mw.loader.load("https://raw.githack.com/Vonavy/nkch-css/main/css/index.css", "text/css");
    if (window.nkch) {
        if (window.nkch.css4)
            return;
        else
            window.nkch.css4 = new nkchCSS(options);
    }
    else
        window.nkch = { css4: new nkchCSS(options) };
}
;
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
