export type BrowserLayout = 'integrated' | 'floating' | 'mini' | 'expanded' | 'hidden';
export type SnapPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'left-half'
  | 'right-half'
  | 'center'
  | 'free';

export interface BrowserState {
  isOpen: boolean;
  isVisible: boolean;
  currentUrl: string;
  tabs: BrowserTab[];
  activeTabId: string | null;
  layout: BrowserLayout;
  snapPosition: SnapPosition;
  alwaysOnTop: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface BrowserTab {
  id: string;
  url: string;
}

export interface NativeBrowserState {
  url: string;
  tabs: BrowserTab[];
  active_tab_id: string | null;
}

export interface BrowserCommand {
  action:
    | 'open'
    | 'navigate'
    | 'back'
    | 'forward'
    | 'reload'
    | 'show'
    | 'hide'
    | 'minimize'
    | 'maximize'
    | 'close'
    | 'float'
    | 'snap'
    | 'always-on-top';
  url?: string;
  snapPosition?: SnapPosition;
  alwaysOnTop?: boolean;
}

export const BROWSER_LAYOUTS = {
  integrated: { width: 720, height: 800 },
  mini: { width: 480, height: 320 },
  floating: { width: 1000, height: 700 },
  expanded: { width: 1400, height: 900 },
} as const;
