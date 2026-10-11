import { test, expect } from "@playwright/test";

async function mount(page, options = {}) {
  await page.evaluate(options => window.mount(options), options);
  // Let initial layout observers finish before testing input.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function wheel(page, deltaX, deltaY, selector = "#viewport", extra = {}) {
  return page.evaluate(({ deltaX, deltaY, selector, extra }) => {
    const previousTarget = window.amber.target;
    const event = new WheelEvent("wheel", { deltaX, deltaY, bubbles: true, cancelable: true, ...extra });
    document.querySelector(selector).dispatchEvent(event);
    return { prevented: event.defaultPrevented, previousTarget, ...window.amber.state };
  }, { deltaX, deltaY, selector, extra });
}

async function settle(page) {
  await expect.poll(() => page.evaluate(() => window.amber.isScrolling), { timeout: 6000 }).toBe(false);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.amber);
});

for (const orientation of ["vertical", "horizontal"]) {
  test(`explicit transform renderer/${orientation}: uses translate3d without native position changes`, async ({ page }) => {
    // This panel fixture explicitly selects transform; native defaults have separate coverage.
    expect(await page.evaluate(() => amber.options.renderer)).toBe("transform");
    await expect(page.locator("#renderer")).toHaveValue("transform");
    await mount(page, { orientation, autoRaf: false });
    await wheel(page, 0, 300);
    const state = await page.evaluate(() => {
      amber.raf(0);
      const viewport = document.querySelector("#viewport");
      const transform = new DOMMatrix(getComputedStyle(document.querySelector("#first")).transform);
      return { renderer: amber.options.renderer, position: amber.position, x: transform.m41,
        y: transform.m42, nativeX: viewport.scrollLeft, nativeY: viewport.scrollTop };
    });
    expect(state.renderer).toBe("transform");
    expect(state.position).toBeGreaterThan(0);
    expect(state.x).toBeCloseTo(orientation === "horizontal" ? -state.position : 0);
    expect(state.y).toBeCloseTo(orientation === "vertical" ? -state.position : 0);
    expect(state.nativeX).toBe(0);
    expect(state.nativeY).toBe(0);
  });
}

for (const renderer of ["transform", "native"]) {
  for (const orientation of ["vertical", "horizontal"]) {
    test(`${renderer}/${orientation}: wheel smoothing, correct bounds, and exact settlement`, async ({ page }) => {
      await mount(page, { renderer, orientation });
      const limits = await page.evaluate(() => ({
        actual: amber.limit,
        expected: amber.driver.content[amber.driver.isHorizontal ? "scrollWidth" : "scrollHeight"] - amber.driver.viewportSize,
      }));
      expect(limits.actual).toBeCloseTo(limits.expected, 2);
      const state = await wheel(page, 0, 300);
      expect(state.prevented).toBe(true);
      expect(state.target).toBeCloseTo(150);
      expect(state.position).toBeLessThan(state.target);
      await settle(page);
      const result = await page.evaluate(() => ({ ...amber.state, rendered: amber.driver.read(), frames: scrollEvents, ends: endEvents, pending: amber.frame }));
      expect(result.position).toBeCloseTo(150);
      // Native WebKit floors fractional positions; the motion state retains subpixels.
      expect(Math.abs(result.rendered - result.position)).toBeLessThan(1);
      expect(result.frames).toBeGreaterThan(2);
      expect(result.ends).toBe(1);
      expect(result.pending).toBe(null);
    });

    test(`${renderer}/${orientation}: element navigation, resize clamping, and short content`, async ({ page }) => {
      await mount(page, { renderer, orientation });
      const result = await page.evaluate(() => {
        const target = document.querySelector("#third");
        const expected = amber.driver.destination(target) - 20;
        amber.scrollTo(target, { offset: -20, immediate: true });
        return { expected, actual: amber.position };
      });
      expect(result.actual).toBeCloseTo(result.expected);
      await page.evaluate(() => {
        amber.scrollTo("end", { immediate: true });
        document.querySelectorAll("section:not(:first-child)").forEach(element => element.remove());
        const first = document.querySelector("#first");
        first.style.width = "100px";
        first.style.height = "100px";
        first.replaceChildren();
        amber.resize();
      });
      expect(await page.evaluate(() => ({ limit: amber.limit, position: amber.position, target: amber.target })))
        .toEqual({ limit: 0, position: 0, target: 0 });
      expect((await wheel(page, 0, 100)).prevented).toBe(false);
    });

    test(`${renderer}/${orientation}: axis keyboard controls and untouched Tab`, async ({ page }) => {
      await mount(page, { renderer, orientation });
      await page.locator("#viewport").focus();
      await page.keyboard.press(orientation === "horizontal" ? "ArrowRight" : "ArrowDown");
      expect(await page.evaluate(() => amber.target)).toBe(100);
      await page.keyboard.press("End");
      expect(await page.evaluate(() => amber.target === amber.limit)).toBe(true);
      await page.keyboard.press("Home");
      expect(await page.evaluate(() => amber.target)).toBe(0);
      const prevented = await page.evaluate(() => {
        const event = new KeyboardEvent("keydown", { key: "Tab", cancelable: true, bubbles: true });
        document.querySelector("#viewport").dispatchEvent(event);
        return event.defaultPrevented;
      });
      expect(prevented).toBe(false);
      await page.evaluate(() => amber.scrollTo(0, { immediate: true }));
      await page.locator("#input").focus();
      await page.keyboard.press("ArrowDown");
      expect(await page.evaluate(() => amber.target)).toBe(0);
    });

    test(`${renderer}/${orientation}: touch drag and release on a desktop viewport`, async ({ page }) => {
      await mount(page, { renderer, orientation, autoRaf: false });
      const result = await page.evaluate(async orientation => {
        const viewport = document.querySelector("#viewport");
        const dispatch = (type, x, y) => {
          // Supply the TouchEvent interface without device-specific Touch constructors.
          const event = new Event(type, { bubbles: true, cancelable: true });
          const touch = { identifier: 1, clientX: x, clientY: y, target: viewport };
          Object.defineProperties(event, {
            touches: { value: type === "touchend" ? [] : [touch] },
            changedTouches: { value: [touch] },
          });
          viewport.dispatchEvent(event);
          return event.defaultPrevented;
        };
        dispatch("touchstart", 200, 200);
        await new Promise(resolve => setTimeout(resolve, 20));
        const prevented = dispatch("touchmove", orientation === "horizontal" ? 160 : 200, orientation === "vertical" ? 160 : 200);
        const dragTarget = amber.target;
        dispatch("touchend", 160, 160);
        return { prevented, dragTarget, releaseTarget: amber.target };
      }, orientation);
      expect(result.prevented).toBe(true);
      expect(result.dragTarget).toBe(100);
      expect(result.releaseTarget).toBeGreaterThan(result.dragTarget);
    });
  }

  test(`${renderer}: focus at the far end becomes visible`, async ({ page }) => {
    await mount(page, { renderer, orientation: "horizontal" });
    await page.evaluate(() => document.querySelector("#last-link").focus());
    await expect.poll(() => page.evaluate(() => {
      const link = document.querySelector("#last-link").getBoundingClientRect();
      const bounds = amber.driver.bounds;
      return link.left >= bounds.left - 1 && link.right <= bounds.right + 1;
    })).toBe(true);
    expect(await page.evaluate(() => Number.isFinite(amber.position) && amber.position > 0)).toBe(true);
  });

  test(`${renderer}: stop/start, listener cleanup, and remount`, async ({ page }) => {
    await mount(page, { renderer });
    await page.evaluate(() => amber.stop());
    expect((await wheel(page, 0, 100)).target).toBe(0);
    await page.evaluate(() => amber.start());
    expect((await wheel(page, 0, 100)).target).toBeCloseTo(50);
    await page.evaluate(() => {
      window.oldAmber = amber;
      amber.destroy();
      amber.destroy();
    });
    expect((await wheel(page, 0, 100)).prevented).toBe(false);
    expect(await page.evaluate(() => document.querySelector("#content").style.transform)).toBe("");
    await mount(page, { renderer });
    const remounted = await wheel(page, 0, 100);
    // Native momentum may still move the viewport while Amber is destroyed.
    // A remount must apply this delta once, relative to its current native position.
    expect(remounted.target - remounted.previousTarget).toBeCloseTo(50);
    expect(await page.evaluate(() => oldAmber.target === oldAmber.position)).toBe(true);
  });
}

test("horizontal trackpad input, dominant axis, and page delta mode", async ({ page }) => {
  await mount(page, { orientation: "horizontal", autoRaf: false });
  expect((await wheel(page, 100, 30)).target).toBeCloseTo(50);
  expect((await wheel(page, -100, 0)).target).toBeCloseTo(0);
  expect((await wheel(page, 1, 0, "#viewport", { deltaMode: 2 })).target).toBeCloseTo(await page.evaluate(() => amber.driver.viewport.width * 0.5));
});

test("real wheel events animate native scroll and settle without feedback", async ({ page }) => {
  await mount(page, { renderer: "native" });
  const box = await page.locator("#viewport").boundingBox();
  await page.mouse.move(box.x + box.width - 60, box.y + 100);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => amber.target)).toBeCloseTo(150);
  await settle(page);
  expect(Math.abs(await page.locator("#viewport").evaluate(element => element.scrollTop) - 150)).toBeLessThan(1);
});

test("native nested scrolling and opt-out elements retain input", async ({ page }) => {
  await mount(page);
  expect((await wheel(page, 0, 100, "#nested-inner")).prevented).toBe(false);
  expect(await page.evaluate(() => amber.target)).toBe(0);
  const box = await page.locator("#nested").boundingBox();
  await page.mouse.move(box.x + 40, box.y + 30);
  await page.mouse.wheel(0, 80);
  await expect.poll(() => page.locator("#nested").evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => amber.target)).toBe(0);
  await page.locator("#second").evaluate(element => element.setAttribute("data-amber-prevent", ""));
  expect((await wheel(page, 0, 100, "#second")).prevented).toBe(false);
  expect((await wheel(page, 0, 100, "#viewport", { ctrlKey: true })).prevented).toBe(false);
});

test("a second Amber instance owns its nested input", async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { window.innerAmber = new Amber({ wrapper: document.querySelector("#nested") }); });
  await wheel(page, 0, 100, "#nested-inner");
  expect(await page.evaluate(() => innerAmber.target)).toBeCloseTo(50);
  expect(await page.evaluate(() => amber.target)).toBe(0);
});

test("external native scroll cancels pending inertia and synchronizes state", async ({ page }) => {
  await mount(page, { renderer: "native" });
  await wheel(page, 0, 600);
  await page.evaluate(() => document.querySelector("#viewport").scrollTo({ top: 900, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => amber.target)).toBe(900);
  expect(await page.evaluate(() => amber.position)).toBe(900);
  expect(await page.evaluate(() => amber.isScrolling)).toBe(false);
});

test("manual frames advance once, cancel on stop, and finish exactly", async ({ page }) => {
  await mount(page, { autoRaf: false });
  const result = await page.evaluate(() => {
    amber.scrollTo(1000);
    const initial = amber.position;
    amber.raf(0);
    const first = amber.position;
    for (let i = 1; i < 200; i++) amber.raf(i * 1000 / 60);
    return { initial, first, final: amber.position, target: amber.target, pending: amber.frame, ends: endEvents };
  });
  expect(result.initial).toBe(0);
  expect(result.first).toBeCloseTo(90);
  expect(result.final).toBe(1000);
  expect(result.pending).toBe(null);
  expect(result.ends).toBe(1);
});

test("reduced motion works on initialization and when the preference changes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mount(page, { renderer: "native" });
  expect((await wheel(page, 0, 100)).prevented).toBe(false);
  await page.evaluate(() => amber.scrollTo(500));
  expect(await page.evaluate(() => amber.position)).toBe(500);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => page.evaluate(() => amber.reducedMotion)).toBe(false);
  await page.evaluate(() => amber.scrollTo(900));
  expect(await page.evaluate(() => amber.isScrolling)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => amber.position)).toBe(900);
  await mount(page, { renderer: "transform", orientation: "horizontal" });
  const state = await wheel(page, 0, 100);
  expect(state.position).toBeCloseTo(50);
  expect(state.isScrolling).toBe(false);
});

test("root document scroll works without a wrapper", async ({ page }) => {
  await page.evaluate(() => {
    amber.destroy();
    document.body.style.minHeight = "2500px";
    window.amber = new Amber({ renderer: "native" });
    amber.scrollTo(600, { immediate: true });
  });
  expect(await page.evaluate(() => window.scrollY)).toBe(600);
  expect(await page.evaluate(() => amber.position)).toBe(600);
});

test("destroy restores existing inline styles and validation rejects ambiguous ownership", async ({ page }) => {
  const result = await page.evaluate(() => {
    amber.destroy();
    const wrapper = document.querySelector("#viewport");
    const content = document.querySelector("#content");
    wrapper.style.setProperty("scroll-behavior", "smooth", "important");
    wrapper.style.overflow = "auto";
    content.style.transform = "translateX(0px)";
    const before = { wrapper: wrapper.style.cssText, content: content.style.cssText };
    const instance = new Amber({ wrapper, content, renderer: transform });
    let duplicate = false;
    try { new Amber({ wrapper }); } catch { duplicate = true; }
    instance.destroy();
    return { before, after: { wrapper: wrapper.style.cssText, content: content.style.cssText }, duplicate };
  });
  // CSS declaration order can change during restoration; compare actual values below.
  expect(result.duplicate).toBe(true);
  expect(await page.locator("#viewport").evaluate(element => [element.style.scrollBehavior, element.style.getPropertyPriority("scroll-behavior"), element.style.overflow])).toEqual(["smooth", "important", "auto"]);
  expect(await page.locator("#content").evaluate(element => element.style.transform)).toBe("translateX(0px)");
});

test("nested keyboard input stays native even in a horizontal outer viewport", async ({ page }) => {
  await mount(page, { orientation: "horizontal" });
  await page.locator("#nested").focus();
  const prevented = await page.locator("#nested").evaluate(element => {
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await page.keyboard.press("ArrowDown");
  // Headless WebKit does not scroll this focused div even with Amber removed.
  // The invariant is that Amber preserves default keyboard handling and its focus.
  await expect(page.locator("#nested")).toBeFocused();
  expect(await page.evaluate(() => amber.target)).toBe(0);
});

test("content insertion updates limits automatically", async ({ page }) => {
  await mount(page, { orientation: "horizontal" });
  const before = await page.evaluate(() => amber.limit);
  await page.evaluate(() => document.querySelector("#content").append(document.querySelector("#first").cloneNode(true)));
  await expect.poll(() => page.evaluate(() => amber.limit)).toBe(before + 560);
});

for (const orientation of ["vertical", "horizontal"]) {
  test(`emulated hardware touch/${orientation}: cancellable browser gestures drive Amber`, async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "Chromium's protocol supplies real browser touch input; all engines also run the TouchEvent interface tests.");
    await mount(page, { orientation });
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const box = await page.locator("#viewport").boundingBox();
    const x = box.x + box.width - 80;
    const y = box.y + 210;
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
    for (let step = 1; step <= 4; step++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - (orientation === "horizontal" ? step * 15 : 0), y: y - (orientation === "vertical" ? step * 15 : 0), id: 1 }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => page.evaluate(() => amber.target)).toBeGreaterThan(0);
    await settle(page);
    const state = await page.evaluate(() => ({ target: amber.target, position: amber.position, events: scrollEvents, ends: endEvents }));
    expect(state.position).toBe(state.target);
    expect(state.events).toBeGreaterThan(3);
    expect(state.ends).toBeGreaterThan(0);
  });
}
