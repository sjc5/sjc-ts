import { useAtomRef } from "@effect/atom-react";
import { AtomRef } from "effect/unstable/reactivity";
import {
	createElement,
	useCallback,
	useMemo,
	useRef,
	type CSSProperties,
	type HTMLAttributes,
	type PointerEvent as ReactPointerEvent,
	type ReactElement,
} from "react";

export type ResizeEdge = "left" | "right" | "top" | "bottom";
export type ResizeCorner =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right";

type ResizeCursor = "ew-resize" | "ns-resize" | "nesw-resize" | "nwse-resize";

type ResizeAppearance = {
	handleSize: number;
	grabExtension: number;
	setCursorStyle: boolean;
	hoverStyle: CSSProperties;
	dragStyle: CSSProperties;
};

export type ResizeGroupOptions = {
	handleSize: number;
	grabExtension: number;
	setCursorStyle: boolean;
	hoverDelayMs: number;
	hoverStyle?: CSSProperties;
	dragStyle?: CSSProperties;
};

export type ResizableRegionOptions = {
	edge: ResizeEdge;
	initialSize: number;
	minimumSize: number;
	maximumSize: number;
	handleSize?: number;
	grabExtension?: number;
	setCursorStyle?: boolean;
	hoverStyle?: CSSProperties;
	dragStyle?: CSSProperties;
};

declare const resizableRegionDefinitionTypeId: unique symbol;

export type ResizableRegionDefinition = {
	readonly [resizableRegionDefinitionTypeId]: true;
	readonly edge: ResizeEdge;
};

export type ResizeGroup = {
	createResizableRegion(
		options: ResizableRegionOptions,
	): ResizableRegionDefinition;
};

type InteractionTarget = {
	source: object;
	regions: ReadonlyArray<ResizableRegionDefinition>;
	cursor: ResizeCursor;
	setCursorStyle: boolean;
};

type PendingHover = {
	target: InteractionTarget;
	activateAt: number;
	timeoutId: number;
};

type ResizeGroupState = {
	hoverDelayMs: number;
	activeTargetRef: AtomRef.AtomRef<InteractionTarget | null>;
	hoveredTargetRef: AtomRef.AtomRef<InteractionTarget | null>;
	currentHoverTarget: InteractionTarget | null;
	pendingHover: PendingHover | null;
};

type ResizableRegionState = ResizeAppearance & {
	group: ResizeGroup;
	sizeRef: AtomRef.AtomRef<number>;
	edge: ResizeEdge;
	minimumSize: number;
	maximumSize: number;
	cursor: "ew-resize" | "ns-resize";
};

type DragState = {
	pointerId: number;
	startCoordinate: number;
	startSize: number;
};

type IntersectionDragState = {
	pointerId: number;
	firstStartCoordinate: number;
	firstStartSize: number;
	secondStartCoordinate: number;
	secondStartSize: number;
};

type RegisteredGrabArea = {
	groupState: ResizeGroupState;
	target: InteractionTarget;
};

const resizeGroupStates = new WeakMap<ResizeGroup, ResizeGroupState>();
const resizableRegionStates = new WeakMap<
	ResizableRegionDefinition,
	ResizableRegionState
>();
const registeredGrabAreas = new WeakMap<Element, RegisteredGrabArea>();

function clamp(value: number, minimum: number, maximum: number) {
	return Math.min(Math.max(value, minimum), maximum);
}

function getResizeGroupState(group: ResizeGroup) {
	const state = resizeGroupStates.get(group);

	if (!state) {
		throw new Error("Unknown resize group");
	}

	return state;
}

function getResizableRegionState(region: ResizableRegionDefinition) {
	const state = resizableRegionStates.get(region);

	if (!state) {
		throw new Error("Unknown resizable region");
	}

	return state;
}

function checkEdgeIsHorizontal(edge: ResizeEdge) {
	return edge === "left" || edge === "right";
}

function toResizeDirection(edge: ResizeEdge) {
	return edge === "right" || edge === "bottom" ? 1 : -1;
}

function toPointerCoordinate(edge: ResizeEdge, event: ReactPointerEvent) {
	return checkEdgeIsHorizontal(edge) ? event.clientX : event.clientY;
}

function toResizeCursor(corner: ResizeCorner): ResizeCursor {
	return corner === "top-left" || corner === "bottom-right"
		? "nwse-resize"
		: "nesw-resize";
}

function validateAppearance(appearance: {
	handleSize: number;
	grabExtension: number;
}) {
	if (appearance.handleSize <= 0) {
		throw new Error("handleSize must be greater than zero");
	}

	if (appearance.grabExtension < 0) {
		throw new Error("grabExtension cannot be negative");
	}
}

export function createResizeGroup(options: ResizeGroupOptions): ResizeGroup {
	validateAppearance(options);

	if (options.hoverDelayMs < 0) {
		throw new Error("hoverDelayMs cannot be negative");
	}

	const groupState: ResizeGroupState = {
		hoverDelayMs: options.hoverDelayMs,
		activeTargetRef: AtomRef.make<InteractionTarget | null>(null),
		hoveredTargetRef: AtomRef.make<InteractionTarget | null>(null),
		currentHoverTarget: null,
		pendingHover: null,
	};

	const group: ResizeGroup = {
		createResizableRegion(regionOptions) {
			if (regionOptions.minimumSize > regionOptions.maximumSize) {
				throw new Error(
					"minimumSize cannot be greater than maximumSize",
				);
			}

			const appearance: ResizeAppearance = {
				handleSize: regionOptions.handleSize ?? options.handleSize,
				grabExtension:
					regionOptions.grabExtension ?? options.grabExtension,
				setCursorStyle:
					regionOptions.setCursorStyle ?? options.setCursorStyle,
				hoverStyle: {
					...options.hoverStyle,
					...regionOptions.hoverStyle,
				},
				dragStyle: { ...options.dragStyle, ...regionOptions.dragStyle },
			};

			validateAppearance(appearance);

			const region = Object.freeze({
				edge: regionOptions.edge,
			}) as ResizableRegionDefinition;

			resizableRegionStates.set(region, {
				group,
				sizeRef: AtomRef.make(
					clamp(
						regionOptions.initialSize,
						regionOptions.minimumSize,
						regionOptions.maximumSize,
					),
				),
				edge: regionOptions.edge,
				minimumSize: regionOptions.minimumSize,
				maximumSize: regionOptions.maximumSize,
				cursor: checkEdgeIsHorizontal(regionOptions.edge)
					? "ew-resize"
					: "ns-resize",
				...appearance,
			});

			return region;
		},
	};

	resizeGroupStates.set(group, groupState);

	return group;
}

function checkTargetsShareRegion(
	first: InteractionTarget,
	second: InteractionTarget,
) {
	return first.regions.some((region) => second.regions.includes(region));
}

function cancelPendingHover(groupState: ResizeGroupState) {
	if (!groupState.pendingHover) {
		return;
	}

	window.clearTimeout(groupState.pendingHover.timeoutId);
	groupState.pendingHover = null;
}

function commitHover(
	groupState: ResizeGroupState,
	target: InteractionTarget | null,
) {
	cancelPendingHover(groupState);
	groupState.currentHoverTarget = target;
	groupState.hoveredTargetRef.set(target);
}

function scheduleHover(
	groupState: ResizeGroupState,
	target: InteractionTarget,
	activateAt: number,
) {
	const remainingDelay = Math.max(0, activateAt - Date.now());

	if (remainingDelay === 0) {
		commitHover(groupState, target);
		return;
	}

	const timeoutId = window.setTimeout(() => {
		if (groupState.pendingHover?.target.source !== target.source) {
			return;
		}

		groupState.pendingHover = null;
		groupState.currentHoverTarget = target;
		groupState.hoveredTargetRef.set(target);
	}, remainingDelay);

	groupState.pendingHover = { target, activateAt, timeoutId };
}

function requestHover(groupState: ResizeGroupState, target: InteractionTarget) {
	const currentTarget = groupState.currentHoverTarget;

	if (currentTarget?.source === target.source) {
		return;
	}

	if (currentTarget && checkTargetsShareRegion(currentTarget, target)) {
		commitHover(groupState, target);
		return;
	}

	const pendingHover = groupState.pendingHover;

	if (pendingHover && checkTargetsShareRegion(pendingHover.target, target)) {
		const activateAt = pendingHover.activateAt;
		cancelPendingHover(groupState);
		scheduleHover(groupState, target, activateAt);
		return;
	}

	cancelPendingHover(groupState);
	scheduleHover(groupState, target, Date.now() + groupState.hoverDelayMs);
}

function findRegisteredGrabArea(target: EventTarget | null) {
	let element = target instanceof Element ? target : null;

	while (element) {
		const registered = registeredGrabAreas.get(element);

		if (registered) {
			return registered;
		}

		element = element.parentElement;
	}

	return undefined;
}

function leaveGrabArea(
	groupState: ResizeGroupState,
	target: InteractionTarget,
	relatedTarget: EventTarget | null,
) {
	const nextGrabArea = findRegisteredGrabArea(relatedTarget);
	const currentOrPendingTarget =
		groupState.currentHoverTarget ??
		groupState.pendingHover?.target ??
		target;

	if (
		nextGrabArea?.groupState === groupState &&
		checkTargetsShareRegion(currentOrPendingTarget, nextGrabArea.target)
	) {
		return;
	}

	commitHover(groupState, null);
}

function useGrabAreaRegistration(
	groupState: ResizeGroupState,
	target: InteractionTarget,
) {
	const currentElement = useRef<HTMLDivElement | null>(null);

	return useCallback(
		(element: HTMLDivElement | null) => {
			if (currentElement.current) {
				registeredGrabAreas.delete(currentElement.current);
			}

			currentElement.current = element;

			if (element) {
				registeredGrabAreas.set(element, { groupState, target });
				return;
			}

			if (groupState.pendingHover?.target.source === target.source) {
				cancelPendingHover(groupState);
			}

			if (groupState.currentHoverTarget?.source === target.source) {
				groupState.currentHoverTarget = null;
				groupState.hoveredTargetRef.update((current) =>
					current?.source === target.source ? null : current,
				);
			}

			groupState.activeTargetRef.update((current) =>
				current?.source === target.source ? null : current,
			);
		},
		[groupState, target],
	);
}

function deriveRegionStyle(edge: ResizeEdge, size: number): CSSProperties {
	if (checkEdgeIsHorizontal(edge)) {
		return { position: "relative", width: size };
	}

	return { position: "relative", height: size };
}

function deriveGrabAreaStyle({
	state,
	isActive,
	isHovered,
}: {
	state: ResizableRegionState;
	isActive: boolean;
	isHovered: boolean;
}): CSSProperties {
	const grabSize = state.handleSize + state.grabExtension * 2;
	const shared: CSSProperties = {
		position: "absolute",
		zIndex: 1,
		touchAction: "none",
	};

	if (state.setCursorStyle && (isActive || isHovered)) {
		shared.cursor = state.cursor;
	}

	switch (state.edge) {
		case "left":
			return {
				...shared,
				left: 0,
				top: 0,
				width: grabSize,
				height: "100%",
				transform: "translateX(-50%)",
			};
		case "right":
			return {
				...shared,
				right: 0,
				top: 0,
				width: grabSize,
				height: "100%",
				transform: "translateX(50%)",
			};
		case "top":
			return {
				...shared,
				left: 0,
				top: 0,
				width: "100%",
				height: grabSize,
				transform: "translateY(-50%)",
			};
		case "bottom":
			return {
				...shared,
				left: 0,
				bottom: 0,
				width: "100%",
				height: grabSize,
				transform: "translateY(50%)",
			};
	}
}

function mergeVisibleHandleStyles({
	state,
	style,
	isHovering,
	isDragging,
}: {
	state: ResizableRegionState;
	style: CSSProperties | undefined;
	isHovering: boolean;
	isDragging: boolean;
}): CSSProperties {
	const shared: CSSProperties = {
		position: "absolute",
		pointerEvents: "none",
		...style,
		...(isHovering ? state.hoverStyle : undefined),
		...(isDragging ? state.dragStyle : undefined),
	};

	if (checkEdgeIsHorizontal(state.edge)) {
		return {
			...shared,
			left: "50%",
			top: 0,
			width: state.handleSize,
			height: "100%",
			transform: "translateX(-50%)",
		};
	}

	return {
		...shared,
		left: 0,
		top: "50%",
		width: "100%",
		height: state.handleSize,
		transform: "translateY(-50%)",
	};
}

function deriveIntersectionGrabAreaStyle({
	corner,
	width,
	height,
	setCursorStyle,
	isDragging,
	isHovering,
	cursor,
}: {
	corner: ResizeCorner;
	width: number;
	height: number;
	setCursorStyle: boolean;
	isDragging: boolean;
	isHovering: boolean;
	cursor: ResizeCursor;
}): CSSProperties {
	const shared: CSSProperties = {
		position: "absolute",
		zIndex: 2,
		width,
		height,
		touchAction: "none",
	};

	if (setCursorStyle && (isDragging || isHovering)) {
		shared.cursor = cursor;
	}

	switch (corner) {
		case "top-left":
			return {
				...shared,
				left: 0,
				top: 0,
				transform: "translate(-50%, -50%)",
			};
		case "top-right":
			return {
				...shared,
				right: 0,
				top: 0,
				transform: "translate(50%, -50%)",
			};
		case "bottom-left":
			return {
				...shared,
				left: 0,
				bottom: 0,
				transform: "translate(-50%, 50%)",
			};
		case "bottom-right":
			return {
				...shared,
				right: 0,
				bottom: 0,
				transform: "translate(50%, 50%)",
			};
	}
}

export function useIsResizeGroupActive(group: ResizeGroup) {
	const { activeTargetRef } = getResizeGroupState(group);
	return useAtomRef(activeTargetRef) !== null;
}

export function useResizableRegionSize(region: ResizableRegionDefinition) {
	const state = getResizableRegionState(region);
	const size = useAtomRef(state.sizeRef);
	const setSize = useCallback(
		(nextSize: number) => {
			state.sizeRef.set(
				clamp(nextSize, state.minimumSize, state.maximumSize),
			);
		},
		[state.maximumSize, state.minimumSize, state.sizeRef],
	);

	return [size, setSize] as const;
}

export type ResizeGroupRootProps = HTMLAttributes<HTMLDivElement> & {
	group: ResizeGroup;
};

export function ResizeGroupRoot({
	group,
	style,
	children,
	...props
}: ResizeGroupRootProps): ReactElement {
	const state = getResizeGroupState(group);
	const activeTarget = useAtomRef(state.activeTargetRef);
	const hoveredTarget = useAtomRef(state.hoveredTargetRef);
	const currentTarget = activeTarget ?? hoveredTarget;
	const cursor = currentTarget?.setCursorStyle
		? currentTarget.cursor
		: undefined;

	return createElement(
		"div",
		{ ...props, style: cursor ? { ...style, cursor } : style },
		children,
	);
}

export type ResizableRegionProps = HTMLAttributes<HTMLDivElement> & {
	region: ResizableRegionDefinition;
};

export function ResizableRegion({
	region,
	style,
	children,
	...props
}: ResizableRegionProps): ReactElement {
	const state = getResizableRegionState(region);
	const size = useAtomRef(state.sizeRef);

	return createElement(
		"div",
		{
			...props,
			style: { ...style, ...deriveRegionStyle(state.edge, size) },
		},
		children,
	);
}

export type ResizeHandleProps = {
	region: ResizableRegionDefinition;
	className?: string;
	style?: CSSProperties;
};

export function ResizeHandle({
	region,
	className,
	style,
}: ResizeHandleProps): ReactElement {
	const state = getResizableRegionState(region);
	const groupState = getResizeGroupState(state.group);
	const size = useAtomRef(state.sizeRef);
	const activeTarget = useAtomRef(groupState.activeTargetRef);
	const hoveredTarget = useAtomRef(groupState.hoveredTargetRef);
	const drag = useRef<DragState | null>(null);
	const target = useMemo<InteractionTarget>(() => {
		return {
			source: region,
			regions: [region],
			cursor: state.cursor,
			setCursorStyle: state.setCursorStyle,
		};
	}, [region, state.cursor, state.setCursorStyle]);
	const registerGrabArea = useGrabAreaRegistration(groupState, target);
	const isDragging = activeTarget?.regions.includes(region) ?? false;
	const isHovering = hoveredTarget?.regions.includes(region) ?? false;
	const isThisTargetActive = activeTarget?.source === region;
	const isThisTargetHovered = hoveredTarget?.source === region;

	const finishDragging = useCallback(
		(pointerId: number) => {
			if (drag.current?.pointerId !== pointerId) {
				return;
			}

			drag.current = null;
			groupState.activeTargetRef.update((current) =>
				current?.source === region ? null : current,
			);
		},
		[groupState.activeTargetRef, region],
	);

	const outerStyle = deriveGrabAreaStyle({
		state,
		isActive: isThisTargetActive,
		isHovered: isThisTargetHovered,
	});
	const innerStyle = mergeVisibleHandleStyles({
		state,
		style,
		isHovering,
		isDragging,
	});

	return createElement(
		"div",
		{
			ref: registerGrabArea,
			inert: activeTarget !== null && !isDragging,
			style: outerStyle,
			onPointerEnter: () => {
				if (!activeTarget) {
					requestHover(groupState, target);
				}
			},
			onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => {
				leaveGrabArea(groupState, target, event.relatedTarget);
			},
			onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
				if (
					!event.isPrimary ||
					event.button !== 0 ||
					activeTarget !== null
				) {
					return;
				}

				commitHover(groupState, target);
				event.currentTarget.setPointerCapture(event.pointerId);
				drag.current = {
					pointerId: event.pointerId,
					startCoordinate: toPointerCoordinate(state.edge, event),
					startSize: size,
				};
				groupState.activeTargetRef.set(target);
			},
			onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
				const currentDrag = drag.current;

				if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
					return;
				}

				const pointerDelta =
					toPointerCoordinate(state.edge, event) -
					currentDrag.startCoordinate;

				state.sizeRef.set(
					clamp(
						currentDrag.startSize +
							pointerDelta * toResizeDirection(state.edge),
						state.minimumSize,
						state.maximumSize,
					),
				);
			},
			onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) =>
				finishDragging(event.pointerId),
			onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) =>
				finishDragging(event.pointerId),
			onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) =>
				finishDragging(event.pointerId),
		},
		createElement("div", { className, style: innerStyle }),
	);
}

export type ResizeIntersectionHandleProps = {
	regions: readonly [ResizableRegionDefinition, ResizableRegionDefinition];
	corner: ResizeCorner;
};

export function ResizeIntersectionHandle({
	regions,
	corner,
}: ResizeIntersectionHandleProps): ReactElement {
	const [firstRegion, secondRegion] = regions;
	const first = getResizableRegionState(firstRegion);
	const second = getResizableRegionState(secondRegion);

	if (first.group !== second.group) {
		throw new Error("Intersecting regions must belong to the same group");
	}

	if (
		checkEdgeIsHorizontal(first.edge) === checkEdgeIsHorizontal(second.edge)
	) {
		throw new Error("Intersecting regions must use different axes");
	}

	const groupState = getResizeGroupState(first.group);
	const firstSize = useAtomRef(first.sizeRef);
	const secondSize = useAtomRef(second.sizeRef);
	const activeTarget = useAtomRef(groupState.activeTargetRef);
	const hoveredTarget = useAtomRef(groupState.hoveredTargetRef);
	const drag = useRef<IntersectionDragState | null>(null);
	const source = useRef<object>({}).current;
	const cursor = toResizeCursor(corner);
	const setCursorStyle = first.setCursorStyle && second.setCursorStyle;
	const target = useMemo<InteractionTarget>(() => {
		return {
			source,
			regions: [firstRegion, secondRegion],
			cursor,
			setCursorStyle,
		};
	}, [cursor, firstRegion, secondRegion, setCursorStyle, source]);
	const registerGrabArea = useGrabAreaRegistration(groupState, target);
	const isDragging = activeTarget?.source === source;
	const isHovering = hoveredTarget?.source === source;
	const horizontal = checkEdgeIsHorizontal(first.edge) ? first : second;
	const vertical = checkEdgeIsHorizontal(first.edge) ? second : first;
	const width = horizontal.handleSize + horizontal.grabExtension * 2;
	const height = vertical.handleSize + vertical.grabExtension * 2;

	const finishDragging = useCallback(
		(pointerId: number) => {
			if (drag.current?.pointerId !== pointerId) {
				return;
			}

			drag.current = null;
			groupState.activeTargetRef.update((current) =>
				current?.source === source ? null : current,
			);
		},
		[groupState.activeTargetRef, source],
	);

	return createElement("div", {
		ref: registerGrabArea,
		inert: activeTarget !== null && !isDragging,
		style: deriveIntersectionGrabAreaStyle({
			corner,
			width,
			height,
			setCursorStyle,
			isDragging,
			isHovering,
			cursor,
		}),
		onPointerEnter: () => {
			if (!activeTarget) {
				requestHover(groupState, target);
			}
		},
		onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => {
			leaveGrabArea(groupState, target, event.relatedTarget);
		},
		onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
			if (
				!event.isPrimary ||
				event.button !== 0 ||
				activeTarget !== null
			) {
				return;
			}

			commitHover(groupState, target);
			event.currentTarget.setPointerCapture(event.pointerId);
			drag.current = {
				pointerId: event.pointerId,
				firstStartCoordinate: toPointerCoordinate(first.edge, event),
				firstStartSize: firstSize,
				secondStartCoordinate: toPointerCoordinate(second.edge, event),
				secondStartSize: secondSize,
			};
			groupState.activeTargetRef.set(target);
		},
		onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
			const currentDrag = drag.current;

			if (!currentDrag || currentDrag.pointerId !== event.pointerId) {
				return;
			}

			const firstDelta =
				toPointerCoordinate(first.edge, event) -
				currentDrag.firstStartCoordinate;
			const secondDelta =
				toPointerCoordinate(second.edge, event) -
				currentDrag.secondStartCoordinate;

			first.sizeRef.set(
				clamp(
					currentDrag.firstStartSize +
						firstDelta * toResizeDirection(first.edge),
					first.minimumSize,
					first.maximumSize,
				),
			);
			second.sizeRef.set(
				clamp(
					currentDrag.secondStartSize +
						secondDelta * toResizeDirection(second.edge),
					second.minimumSize,
					second.maximumSize,
				),
			);
		},
		onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) =>
			finishDragging(event.pointerId),
		onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) =>
			finishDragging(event.pointerId),
		onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) =>
			finishDragging(event.pointerId),
	});
}
