/** @vitest-environment happy-dom */

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
	createResizeGroup,
	ResizableRegion,
	ResizeGroupRoot,
	ResizeHandle,
	ResizeIntersectionHandle,
	type ResizeCorner,
	type ResizeEdge,
} from "./index.ts";

const mountedRoots: Array<{ container: HTMLElement; root: Root }> = [];

afterEach(() => {
	for (const { container, root } of mountedRoots) {
		act(() => root.unmount());
		container.remove();
	}

	mountedRoots.length = 0;
});

function renderElement(element: ReactElement): HTMLElement {
	const container = document.createElement("div");
	const root = createRoot(container);
	document.body.append(container);
	act(() => root.render(element));
	mountedRoots.push({ container, root });
	return container;
}

function getElement(container: ParentNode, selector: string): HTMLElement {
	const element = container.querySelector(selector);

	if (!(element instanceof HTMLElement)) {
		throw new Error(`Missing test element: ${selector}`);
	}

	return element;
}

function getIntersectionElement(region: HTMLElement): HTMLElement {
	const element = region.lastElementChild;

	if (!(element instanceof HTMLElement)) {
		throw new Error("Missing intersection handle");
	}

	return element;
}

function hoverElement(element: HTMLElement) {
	dispatchPointerEvent({ element, type: "pointerover" });
}

function dispatchPointerEvent({
	element,
	type,
	clientX = 0,
	clientY = 0,
}: {
	element: HTMLElement;
	type: string;
	clientX?: number;
	clientY?: number;
}) {
	act(() => {
		element.dispatchEvent(
			new PointerEvent(type, {
				bubbles: true,
				button: 0,
				clientX,
				clientY,
				isPrimary: true,
				pointerId: 1,
			}),
		);
	});
}

type IntersectionCase = {
	corner: ResizeCorner;
	horizontalEdge: ResizeEdge;
	verticalEdge: ResizeEdge;
	expectedCursor: string;
};

function renderIntersection({
	corner,
	horizontalEdge,
	verticalEdge,
}: IntersectionCase) {
	const group = createResizeGroup({
		handleSize: 5,
		grabExtension: 3,
		setCursorStyle: false,
		hoverDelayMs: 0,
		hoverStyle: { opacity: 0.5 },
	});
	const horizontalRegion = group.createResizableRegion({
		edge: horizontalEdge,
		initialSize: 200,
		minimumSize: 100,
		maximumSize: 300,
		setCursorStyle: true,
	});
	const verticalRegion = group.createResizableRegion({
		edge: verticalEdge,
		initialSize: 200,
		minimumSize: 100,
		maximumSize: 300,
		setCursorStyle: true,
	});
	const container = renderElement(
		createElement(
			ResizeGroupRoot,
			{ group, id: "resize-root" },
			createElement(
				ResizableRegion,
				{ region: horizontalRegion, id: "horizontal-region" },
				createElement(ResizeHandle, {
					region: horizontalRegion,
					className: "horizontal-handle",
				}),
			),
			createElement(
				ResizableRegion,
				{ region: verticalRegion, id: "vertical-region" },
				createElement(ResizeHandle, {
					region: verticalRegion,
					className: "vertical-handle",
				}),
				createElement(ResizeIntersectionHandle, {
					regions: [horizontalRegion, verticalRegion],
					corner,
				}),
			),
		),
	);

	return {
		container,
		intersection: getIntersectionElement(
			getElement(container, "#vertical-region"),
		),
	};
}

describe("resizer", () => {
	it.each<IntersectionCase>([
		{
			corner: "top-left",
			horizontalEdge: "right",
			verticalEdge: "top",
			expectedCursor: "move",
		},
		{
			corner: "top-right",
			horizontalEdge: "left",
			verticalEdge: "top",
			expectedCursor: "move",
		},
		{
			corner: "bottom-left",
			horizontalEdge: "right",
			verticalEdge: "bottom",
			expectedCursor: "move",
		},
		{
			corner: "bottom-right",
			horizontalEdge: "left",
			verticalEdge: "bottom",
			expectedCursor: "move",
		},
	])("uses the expected cursor and styles for $corner", (testCase) => {
		const { container, intersection } = renderIntersection(testCase);
		hoverElement(intersection);

		expect(getElement(container, "#resize-root").style.cursor).toBe(
			testCase.expectedCursor,
		);
		expect(intersection.style.cursor).toBe(testCase.expectedCursor);
		expect(getElement(container, ".horizontal-handle").style.opacity).toBe(
			"0.5",
		);
		expect(getElement(container, ".vertical-handle").style.opacity).toBe(
			"0.5",
		);
	});

	it("drags and clamps an edge", () => {
		const group = createResizeGroup({
			handleSize: 5,
			grabExtension: 3,
			setCursorStyle: true,
			hoverDelayMs: 0,
		});
		const region = group.createResizableRegion({
			edge: "right",
			initialSize: 200,
			minimumSize: 150,
			maximumSize: 250,
		});
		const container = renderElement(
			createElement(
				ResizeGroupRoot,
				{ group },
				createElement(
					ResizableRegion,
					{ region, id: "resize-region" },
					createElement(ResizeHandle, {
						region,
						className: "resize-handle",
					}),
				),
			),
		);
		const regionElement = getElement(container, "#resize-region");
		const handleElement = getElement(
			container,
			".resize-handle",
		).parentElement;

		if (!handleElement) {
			throw new Error("Missing resize handle grab area");
		}

		dispatchPointerEvent({
			element: handleElement,
			type: "pointerdown",
			clientX: 100,
		});
		dispatchPointerEvent({
			element: handleElement,
			type: "pointermove",
			clientX: 200,
		});
		expect(regionElement.style.width).toBe("250px");

		dispatchPointerEvent({
			element: handleElement,
			type: "pointermove",
			clientX: 0,
		});
		expect(regionElement.style.width).toBe("150px");
	});

	it("drags both intersecting regions", () => {
		const { container, intersection } = renderIntersection({
			corner: "top-left",
			horizontalEdge: "right",
			verticalEdge: "top",
			expectedCursor: "move",
		});

		dispatchPointerEvent({
			element: intersection,
			type: "pointerdown",
			clientX: 100,
			clientY: 100,
		});
		dispatchPointerEvent({
			element: intersection,
			type: "pointermove",
			clientX: 150,
			clientY: 150,
		});

		expect(getElement(container, "#horizontal-region").style.width).toBe(
			"250px",
		);
		expect(getElement(container, "#vertical-region").style.height).toBe(
			"150px",
		);
	});
});
