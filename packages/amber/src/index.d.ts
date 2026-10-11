export type Orientation = 'vertical' | 'horizontal' | 'both';
export interface Vector { readonly x: number; readonly y: number }
export type VectorTarget = { x: number; y?: number } | { x?: number; y: number };
export interface InfiniteAxes { readonly x: boolean; readonly y: boolean }
export type RendererName = 'native' | 'transform';
declare const rendererBrand: unique symbol;
declare const pluginBrand: unique symbol;
export interface RendererModule {
  readonly [rendererBrand]: true;
  readonly name: 'transform';
}
export interface AmberPlugin {
  readonly [pluginBrand]: true;
  readonly name: 'parallax' | 'pinning' | 'snap' | 'sections' | 'infinite';
}
export type Renderer = 'native' | RendererModule;
export type Direction = -1 | 0 | 1;
export type Unsubscribe = () => void;

export interface ScrollState {
  /** Scalar metrics use X for horizontal, Y for vertical/both. */
  readonly position: number;
  readonly target: number;
  readonly limit: number;
  /** CSS pixels per millisecond. */
  readonly velocity: number;
  readonly direction: Direction;
  readonly progress: number;
  readonly isScrolling: boolean;
  readonly isStopped: boolean;
  readonly orientation: Orientation;
  readonly isInfinite: boolean;
  readonly wrappedPosition: number;
  readonly loopLength: number;
  readonly loopLengthVector: Vector;
  readonly positionVector: Vector;
  readonly targetVector: Vector;
  readonly limitVector: Vector;
  readonly velocityVector: Vector;
  readonly directionVector: Readonly<{ x: Direction; y: Direction }>;
  readonly progressVector: Vector;
  readonly wrappedPositionVector: Vector;
  readonly infiniteAxes: InfiniteAxes;
}

export interface SectionEntry {
  readonly target: Element;
  readonly element: Element;
  readonly index: number;
  readonly type: 'sectionenter' | 'sectionleave';
  readonly isActive: boolean;
  readonly isIntersecting: boolean;
  readonly intersectionRatio: number;
  readonly visiblePixels: number;
  readonly start: number;
  readonly end: number;
  readonly viewportSize: number;
  readonly progress: number;
  readonly occurrence: number;
  readonly direction: Direction;
  readonly reason: 'intersection' | 'unobserved';
  readonly state: ScrollState;
}

export interface SectionObserverOptions {
  /** Visible fraction, from 0 to 1. */
  threshold?: number;
  targets?: readonly string[];
  onEnter?: (entry: SectionEntry) => void;
  onLeave?: (entry: SectionEntry) => void;
}

export interface PinOptions {
  target: string | Element;
  /** Start/end must resolve to direct content children. On infinite tracks they must stay on one lap and must not wrap the seam. */
  start: string | Element;
  end: string | Element;
  position?: 'top' | 'middle';
  offset?: number;
  /** CSS-pixel release adjustment, measured on resize. Negative values release earlier. */
  endOffset?: number | ((context: {
    target: Element; start: Element; end: Element; height: number; viewportSize: number;
  }) => number);
}

export interface AmberOptions {
  wrapper?: Window | HTMLElement;
  content?: HTMLElement;
  orientation?: Orientation;
  /** Defaults to native. Import the renderer from amber-scroll/transform for panels. */
  renderer?: Renderer;
  /** Explicit, instance-scoped feature modules; importing alone does not enable them. */
  plugins?: readonly AmberPlugin[];
  /** Native loops require amber-scroll/infinite in plugins; insufficient tracks fall back to finite. */
  infinite?: boolean | Partial<InfiniteAxes>;
  /** Requires the amber-scroll/snap module in plugins. */
  snap?: false | 'proximity' | 'mandatory';
  snapDistance?: number;
  anchors?: boolean;
  historyKey?: string;
  /** Requires the amber-scroll/sections module in plugins. */
  observeSections?: boolean | SectionObserverOptions;
  /** Requires the pinning module and vertical scrolling. Infinite loops are allowed when the pin range does not wrap the seam. */
  pin?: false | readonly PinOptions[];
  /** Greater than 0 and at most 1. */
  damping?: number;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  touchInertia?: number;
  touchInertiaTimeout?: number;
  lineHeight?: number;
  keyboardStep?: number;
  wheelGesture?: 'vertical' | 'horizontal' | 'both' | 'axis';
  smoothTouch?: boolean;
  /** Let outward input reach an ancestor at finite edges. Default false; looped axes never release. */
  scrollChain?: boolean;
  /** Capture wheel input before native scrolling. Amber still yields to a nested Amber instance that can consume the event. */
  managedWheel?: boolean;
  respectReducedMotion?: boolean;
  autoRaf?: boolean;
  /** Hides the browser scrollbar for the page while maintaining native scrolling. Add data-amber-hide-scrollbar to inner elements to hide theirs too. Default false. */
  hideScrollbar?: boolean;
}

export type ResolvedAmberOptions = Readonly<
  Omit<Required<AmberOptions>, 'wrapper' | 'content' | 'historyKey' | 'snapDistance' | 'observeSections' | 'pin' | 'renderer'> &
  Pick<AmberOptions, 'wrapper' | 'content' | 'historyKey' | 'snapDistance'> & {
    renderer: RendererName;
    observeSections: false | Readonly<{
      threshold: number;
      targets: readonly string[] | null;
      onEnter: ((entry: SectionEntry) => void) | null;
      onLeave: ((entry: SectionEntry) => void) | null;
    }>;
    pin: false | readonly Readonly<Required<PinOptions>>[];
  }
>;

export interface ScrollToOptions {
  immediate?: boolean;
  offset?: number | Partial<Vector>;
}

export interface AmberEventMap {
  scroll: (state: ScrollState) => void;
  scrollend: (state: ScrollState) => void;
  resize: (state: ScrollState) => void;
  sectionenter: (entry: SectionEntry) => void;
  sectionleave: (entry: SectionEntry) => void;
  destroy: () => void;
}

/** Construct after mounting in the browser; imports are safe during SSR. */
export class Amber {
  constructor(options?: AmberOptions);
  readonly options: ResolvedAmberOptions;
  readonly window: Window;
  readonly document: Document;
  readonly wrapper: Window | HTMLElement;
  readonly root: HTMLElement;
  readonly position: number;
  readonly positionVector: Vector;
  readonly targetVector: Vector;
  readonly limitVector: Vector;
  readonly velocityVector: Vector;
  readonly directionVector: Readonly<{ x: Direction; y: Direction }>;
  readonly progressVector: Vector;
  readonly wrappedPositionVector: Vector;
  readonly infiniteAxes: InfiniteAxes;
  readonly target: number;
  readonly limit: number;
  readonly velocity: number;
  readonly direction: Direction;
  readonly progress: number;
  readonly isInfinite: boolean;
  readonly wrappedPosition: number;
  readonly loopLength: number;
  readonly isScrolling: boolean;
  readonly loopLengthVector: Vector;
  readonly isStopped: boolean;
  readonly isDestroyed: boolean;
  readonly isVisible: boolean;
  readonly reducedMotion: boolean;
  readonly state: ScrollState;
  on<E extends keyof AmberEventMap>(event: E, callback: AmberEventMap[E]): Unsubscribe;
  off<E extends keyof AmberEventMap>(event: E, callback: AmberEventMap[E]): this;
  /** Number, selector, element, or the special strings 'start' and 'end'. */
  scrollTo(destination: number | string | Element | VectorTarget, options?: ScrollToOptions): this;
  /** Manual animation frame timestamp in milliseconds, with autoRaf: false. */
  raf(time: number): void;
  start(): this;
  stop(): this;
  resize(): this;
  destroy(): void;
}

export default Amber;
