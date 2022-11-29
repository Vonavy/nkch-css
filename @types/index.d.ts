declare interface Window {
    nkch: nkch;
}

declare interface nkch {
    css4: nkchCSS;
}

declare namespace nkch {
    export namespace css {
        export interface Options {}

        export interface Checks {
            editor: {
                isInitialized: boolean;
                isEnabled: boolean;
                isOpen: boolean;
                isMarkersPanelOpen: boolean;
            },
            state: {
                drag: {
                    isHolding: boolean;
                    isDragging: boolean;
                },
                resize: {
                    isHolding: boolean;
                    isResizing: boolean;
                }
            },
            code: {
                isInvalid: boolean;
            }
        }

        export interface Env {
            skin: string;
            theme: Themes;
        }

        export type LocalStorageObject = {
            lang: SupportedLanguages;
            value: string;
        }

        export type SupportedLanguages = "css" | "less";
        export type Themes = "light" | "dark";

        export type Coordinates = { x: number, y: number }
        export type Size = { width: number, height: number }
    }
}