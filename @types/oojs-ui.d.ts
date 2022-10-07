declare namespace OO {
    export class EventEmitter {
        constructor();

        off(event: string, method?: Function | string, context?: any): OO.EventEmitter | Error;
        on(event: string, method: Function | string, args?: any[], context?: any): OO.EventEmitter | Error;
        once(event: string, listener: Function): OO.EventEmitter;
    }

    export namespace ui {
        export namespace mixin {
            export abstract class ButtonElement {
                constructor(config?: ButtonElementConfigOptions);
            }

            interface ButtonElementConfigOptions {
                $button?: JQuery;
                framed?: boolean;
            }

            export abstract class LabelElement {
                constructor(config?: LabelElementConfigOptions);

                getLabel(): jQuery | string | null;
                private setLabelContent(label: jQuery | string | null): void;
            }

            interface LabelElementConfigOptions {
                $label?: JQuery;
                invisibleLabel?: boolean;
                label?: jQuery | string | Function | OO.ui.HtmlSnippet;
            }
        }
        
        export class Element {
            static tagName: string | "div";
            $element: JQuery;

            constructor(config?: ElementConfigOptions);

            getTagName(): string;
            setData(data: any): OO.ui.Element;
            toggle(show?: boolean): OO.ui.Element;
        }

        interface ElementConfigOptions {
            $content?: JQuery;
            $element?: JQuery;
            classes?: string[];
            content?: any[];
            data?: any;
            id?: string;
            text?: string;
        }

        export class WindowManager extends Element {
            constructor(config?: WindowManagerConfigOptions);
        }

        interface WindowManagerConfigOptions extends ElementConfigOptions {}

        export class Widget implements Widget {
            constructor(config?: WidgetConfigOptions);

            isDisabled(): boolean;
            setDisabled(disabled: boolean): OO.ui.Widget;
        }

        interface Widget extends Element, OO.EventEmitter {}

        interface WidgetConfigOptions extends ElementConfigOptions {}

        export class ButtonWidget extends Widget {
            constructor(config?: ButtonWidgetConfigOptions);
        }

        interface ButtonWidgetConfigOptions extends WidgetConfigOptions, OO.ui.mixin.ButtonElementConfigOptions, OO.ui.mixin.LabelElementConfigOptions {}

        export class Layout implements Layout {
            constructor(config?: LayoutConfigOptions);

            resetScroll(): OO.ui.Layout;
        }

        interface Layout extends Element, OO.EventEmitter {}

        interface LayoutConfigOptions extends ElementConfigOptions {}

        export class HorizontalLayout extends Layout {
            constructor(config?: HorizontalLayoutConfigOptions);
        }

        interface HorizontalLayoutConfigOptions extends LayoutConfigOptions {
            items?: OO.ui.Widget[] | OO.ui.Layout[]
        }

        export class PanelLayout extends Layout {
            constructor(config?: PanelLayoutConfigOptions);
        }

        interface PanelLayoutConfigOptions extends LayoutConfigOptions {}

        export class TabPanelLayout extends PanelLayout {
            constructor(name: string, config?: TabPanelLayoutConfigOptions);

            getName(): string;
        }

        interface TabPanelLayoutConfigOptions extends PanelLayoutConfigOptions {
            label?: jQuery | string | Function | OO.ui.HtmlSnippet;
        }

        export class MenuLayout extends Layout {
            constructor(config?: MenuLayoutConfigOptions);
        }

        interface MenuLayoutConfigOptions extends LayoutConfigOptions {
            expanded?: boolean;
        }

        export class IndexLayout extends MenuLayout {
            constructor(config?: IndexLayoutConfigOptions);

            addTabPanels(tabPanels: OO.ui.TabPanelLayout[], index: number): OO.ui.IndexLayout;
            setTabPanel(name: string): void;
        }

        interface IndexLayoutConfigOptions extends MenuLayoutConfigOptions {}
    }
}