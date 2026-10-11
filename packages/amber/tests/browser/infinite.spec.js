import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.amber);
  await page.evaluate(() => mount({ orientation: "horizontal", infinite: true, autoRaf: false }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
});

async function move(page, position) {
  return page.evaluate(position => {
    amber.scrollTo(position, { immediate: true });
    const bounds = amber.driver.bounds;
    return { ...amber.state, panels: Array.from(document.querySelector("#content").children).map(element => {
      const rect = element.getBoundingClientRect();
      return { id: element.id, left: rect.left - bounds.left, right: rect.right - bounds.left };
    }) };
  }, position);
}

test("last and first are adjacent across the seam, in both directions", async ({ page }) => {
  const length = await page.evaluate(() => amber.loopLength);
  expect(length).toBe(2240);
  for (const position of [length - 100, -100, length * 5 - 100, -length * 4 - 100]) {
    const state = await move(page, position);
    const first = state.panels.find(panel => panel.id === "first");
    const last = state.panels.find(panel => panel.id === "fourth");
    expect(first.left).toBeCloseTo(100);
    expect(last.right).toBeCloseTo(first.left);
    expect(state.position).toBe((position % length + length) % length);
    expect(state.wrappedPosition).toBe(length - 100);
    expect(state.isInfinite).toBe(true);
  }
});

test("one-pixel movement over the seam stays one pixel on screen", async ({ page }) => {
  const length = await page.evaluate(() => amber.loopLength);
  const before = await move(page, length - 0.5);
  const after = await move(page, length + 0.5);
  expect(before.panels[0].left - after.panels[0].left).toBeCloseTo(1);
  const reverseBefore = await move(page, 0.5);
  const reverseAfter = await move(page, -0.5);
  expect(reverseAfter.panels[0].left - reverseBefore.panels[0].left).toBeCloseTo(1);
});

test("visible panels cover the viewport throughout multiple laps", async ({ page }) => {
  const result = await page.evaluate(() => {
    const errors = [];
    const viewport = amber.driver.viewportSize;
    for (let position = -amber.loopLength * 2; position < amber.loopLength * 3; position += 91.25) {
      amber.scrollTo(position, { immediate: true });
      const left = amber.driver.bounds.left;
      const intervals = Array.from(document.querySelector("#content").children).map(element => {
        const rect = element.getBoundingClientRect();
        return [rect.left - left, rect.right - left];
      }).filter(([start, end]) => end > 0 && start < viewport).sort((a, b) => a[0] - b[0]);
      let covered = 0;
      for (const [start, end] of intervals) {
        if (start > covered + 0.1) errors.push({ position, gap: start - covered });
        covered = Math.max(covered, end);
      }
      if (covered < viewport - 0.1) errors.push({ position, uncovered: viewport - covered });
    }
    return errors;
  });
  expect(result).toEqual([]);
});

test("animated seam crossing preserves both visual displacement and damping", async ({ page }) => {
  const result = await page.evaluate(() => {
    const errors = [];
    const first = document.querySelector("#first");
    amber.scrollTo(amber.loopLength - 50, { immediate: true });
    amber.scrollTo(amber.loopLength + 200);
    let previousPosition = amber.position;
    let previousLeft = first.getBoundingClientRect().left;
    for (let frame = 0; frame < 150; frame++) {
      amber.raf(frame * 1000 / 60);
      const left = first.getBoundingClientRect().left;
      if (Math.abs(previousLeft - left - (((amber.position - previousPosition + amber.loopLength) % amber.loopLength))) > 0.05) errors.push(frame);
      previousLeft = left;
      previousPosition = amber.position;
    }
    return { errors, position: amber.position, target: amber.target, scrolling: amber.isScrolling };
  });
  expect(result.errors).toEqual([]);
  expect(result.position).toBe(result.target);
  expect(result.scrolling).toBe(false);
});

test("wheel, keyboard, and touch targets cross seams and retain momentum", async ({ page }) => {
  const result = await page.evaluate(() => {
    const viewport = document.querySelector("#viewport");
    amber.scrollTo(amber.loopLength - 10, { immediate: true });
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }));
    const wheel = amber.target;
    amber.scrollTo(-10, { immediate: true });
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    const keyboard = amber.target;
    const touchEvent = (type, x) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 1, clientX: x, clientY: 100 };
      Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [touch] }, changedTouches: { value: [touch] } });
      viewport.dispatchEvent(event);
    };
    amber.scrollTo(amber.loopLength - 10, { immediate: true });
    touchEvent("touchstart", 200);
    touchEvent("touchmove", 180);
    const drag = amber.target;
    touchEvent("touchend", 180);
    return { wheel, keyboard, drag, release: amber.target, length: amber.loopLength };
  });
  expect(result.wheel).toBeCloseTo(result.length + 45.6);
  expect(result.keyboard).toBe(result.length - 110);
  expect(result.drag).toBe(result.length + 40);
  expect(result.release).toBeGreaterThan(result.drag);
});

test("recycling preserves original elements, their values, and listeners", async ({ page }) => {
  const result = await page.evaluate(() => {
    const first = document.querySelector("#first");
    const input = document.querySelector("#input");
    input.value = "Keep me";
    let clicks = 0;
    first.addEventListener("click", () => clicks++);
    amber.scrollTo(amber.loopLength * 100 + 100, { immediate: true });
    first.click();
    return { same: document.querySelector("#first") === first, value: input.value, clicks,
      count: document.querySelectorAll("#first").length, children: document.querySelector("#content").children.length };
  });
  expect(result).toEqual({ same: true, value: "Keep me", clicks: 1, count: 1, children: 4 });
});

test("element navigation selects the nearest occurrence and Home/End stay finite", async ({ page }) => {
  await page.evaluate(() => amber.scrollTo(amber.loopLength * 3 - 50, { immediate: true }));
  const result = await page.evaluate(() => {
    amber.scrollTo("#first", { immediate: true });
    const nearest = amber.position;
    amber.scrollTo("end", { immediate: true });
    const end = amber.position;
    const viewport = document.querySelector("#viewport");
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
    const home = amber.target;
    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
    return { nearest, end, home, endTarget: amber.target, length: amber.loopLength, size: amber.driver.viewportSize };
  });
  expect(result.nearest).toBe(0);
  expect(result.home).toBe(0);
  expect(result.end).toBe(result.length - result.size);
  expect(result.endTarget).toBe(result.end);
});

test("varying panel widths and gaps repeat with the same gap at the seam", async ({ page }) => {
  const result = await page.evaluate(() => {
    document.querySelector("#content").style.gap = "24px";
    const panels = [...document.querySelector("#content").children];
    panels.forEach((panel, i) => { panel.style.width = [400, 500, 450, 350][i] + "px"; });
    amber.resize();
    amber.scrollTo(amber.loopLength - 100, { immediate: true });
    return { length: amber.loopLength,
      gap: panels[0].getBoundingClientRect().left - panels[3].getBoundingClientRect().right };
  });
  expect(result.length).toBe(1796);
  expect(result.gap).toBeCloseTo(24);
});

test("fractional panel widths and gaps do not add rounding gaps at the seam", async ({ page }) => {
  const result = await page.evaluate(() => {
    const content = document.querySelector("#content");
    content.style.gap = "13.25px";
    const panels = [...content.children];
    panels.forEach(panel => { panel.style.width = "400.125px"; });
    // Firefox lays out CSS lengths on a different subpixel grid than Chromium/WebKit.
    const expectedLength = panels.reduce((sum, panel) => sum + panel.getBoundingClientRect().width + 13.25, 0);
    amber.resize();
    const length = amber.loopLength;
    amber.scrollTo(length - 100, { immediate: true });
    return { length, expectedLength, gap: panels[0].getBoundingClientRect().left - panels[3].getBoundingClientRect().right };
  });
  expect(result.length).toBeCloseTo(result.expectedLength);
  expect(Math.abs(result.gap - 13.25)).toBeLessThan(0.02);
});

test("resize and added/removed panels recalculate the period without accumulating offsets", async ({ page }) => {
  await move(page, 2100);
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => amber.resize());
    expect(await page.evaluate(() => amber.loopLength)).toBe(2240);
  }
  await page.evaluate(() => {
    const section = document.createElement("section");
    section.textContent = "Fifth";
    document.querySelector("#content").append(section);
  });
  await expect.poll(() => page.evaluate(() => amber.loopLength)).toBe(2800);
  await page.evaluate(() => {
    document.querySelector("#content").lastElementChild.remove();
    document.querySelector("#viewport").style.width = "500px";
  });
  await expect.poll(() => page.evaluate(() => amber.loopLength)).toBe(2240);
  expect((await move(page, 2140)).panels[0].left).toBeCloseTo(100);
});

test("short or empty tracks fall back to bounded scrolling and recover on growth", async ({ page }) => {
  await page.evaluate(() => {
    window.savedPanels = [...document.querySelector("#content").children].slice(1);
    savedPanels.forEach(panel => panel.remove());
    amber.resize();
  });
  expect(await page.evaluate(() => ({ active: amber.isInfinite, limit: amber.limit }))).toEqual({ active: false, limit: 0 });
  await page.evaluate(() => {
    document.querySelector("#content").append(...savedPanels);
    amber.resize();
  });
  expect(await page.evaluate(() => amber.isInfinite)).toBe(true);
  await page.evaluate(() => { document.querySelector("#content").replaceChildren(); amber.resize(); });
  expect(await page.evaluate(() => ({ active: amber.isInfinite, position: amber.position, progress: amber.progress })))
    .toEqual({ active: false, position: 0, progress: 0 });
});

test("destroy restores panel styles and the demo toggle restores bounded mode", async ({ page }) => {
  await move(page, 2200);
  await page.locator("#infinite").uncheck();
  expect(await page.evaluate(() => amber.options.infinite)).toBe(false);
  expect(await page.locator("#content > section").evaluateAll(elements => elements.every(element => element.style.transform.includes("translate3d")))).toBe(true);
  await page.locator("#infinite").check();
  expect(await page.evaluate(() => amber.isInfinite)).toBe(true);
  await page.locator("#axis").selectOption("vertical");
  await expect(page.locator("#infinite")).toBeEnabled();
  expect(await page.evaluate(() => amber.options.infinite)).toBe(true);
});

test("reduced motion wraps immediately without blanking the seam", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => amber.reducedMotion)).toBe(true);
  const state = await page.evaluate(() => { amber.scrollTo(amber.loopLength + 25); return amber.state; });
  expect(state.isScrolling).toBe(false);
  expect(state.wrappedPosition).toBe(25);
});
