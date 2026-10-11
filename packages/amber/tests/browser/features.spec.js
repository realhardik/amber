import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !!window.amber);
});

async function frames(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("mandatory snapping ignores distance and settles on the nearest panel edge", async ({ page }) => {
  await page.evaluate(() => {
    mount({ snap: "mandatory", snapDistance: 0, autoRaf: false });
    amber.scrollTo(250, { immediate: true });
    const viewport = document.querySelector("#viewport");
    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: 10, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    for (let frame = 0; frame < 300; frame++) amber.raf(frame * 1000 / 60);
  });
  const result = await page.evaluate(() => {
    const first = amber.driver.items[0];
    return {
      position: amber.position,
      expected: first.start + amber.driver.contentOffset + first.extent - amber.driver.viewportSize,
    };
  });
  expect(result.position).toBeCloseTo(result.expected);
});

test("transform anchors update the URL and Back restores an exact virtual position", async ({ page }) => {
  await page.evaluate(() => {
    mount({ autoRaf: false, historyKey: "feature-test" });
    amber.scrollTo(175, { immediate: true });
    document.querySelector("#last-link").click();
  });
  expect(new URL(page.url()).hash).toBe("#first");
  expect(await page.evaluate(() => amber.target)).toBe(0);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => amber.position)).toBe(175);
  expect(new URL(page.url()).hash).toBe("");
  expect(await page.evaluate(() => document.querySelector("#viewport").scrollTop)).toBe(0);
});

test("initial and externally changed hashes navigate through virtual positions", async ({ page }) => {
  await page.goto("/#third");
  await page.waitForFunction(() => !!window.amber);
  expect(await page.evaluate(() => amber.position)).toBeCloseTo(840);
  await page.evaluate(() => { window.location.hash = "#second"; });
  await expect.poll(() => page.evaluate(() => amber.position)).toBeCloseTo(420);
  expect(await page.evaluate(() => document.querySelector("#viewport").scrollTop)).toBe(0);
});

test("culled panels stop receiving transform writes and resume on re-entry", async ({ page }) => {
  const result = await page.evaluate(() => {
    mount({ autoRaf: false });
    const first = document.querySelector("#first");
    const second = document.querySelector("#second");
    const secondInitial = second.style.transform;
    amber.scrollTo(50, { immediate: true });
    const whileOutside = second.style.transform;
    const firstWhileVisible = first.style.transform;
    amber.scrollTo(150, { immediate: true });
    return {
      secondInitial,
      whileOutside,
      firstWhileVisible,
      secondOnEntry: second.style.transform,
    };
  });
  expect(result.whileOutside).toBe(result.secondInitial);
  expect(result.firstWhileVisible).toContain("-50px");
  expect(result.secondOnEntry).not.toBe(result.whileOutside);
  expect(result.secondOnEntry).toContain("-150px");
});

test("resize recalculates how many panels are actively transformed", async ({ page }) => {
  const counts = await page.evaluate(() => {
    const viewport = document.querySelector("#viewport");
    for (const section of document.querySelectorAll("#content > section")) section.style.height = "100px";
    viewport.style.height = "240px";
    mount({ autoRaf: false });
    amber.resize();
    const wide = amber.driver.items.filter(item => item.isVisible).length;
    viewport.style.height = "150px";
    amber.resize();
    const narrow = amber.driver.items.filter(item => item.isVisible).length;
    return { wide, narrow };
  });
  expect(counts).toEqual({ wide: 3, narrow: 2 });
});

for (const renderer of ["transform", "native"]) {
  test(`${renderer} section observer emits independent threshold transitions`, async ({ page }) => {
    await page.evaluate(renderer => {
      window.transitions = [];
      mount({
        renderer,
        autoRaf: false,
        observeSections: {
          threshold: 0.5,
          onEnter: entry => transitions.push({ type: entry.type, id: entry.target.id, ratio: entry.intersectionRatio }),
          onLeave: entry => transitions.push({
            type: entry.type,
            id: entry.target.id,
            intersecting: entry.isIntersecting,
            ratio: entry.intersectionRatio,
          }),
        },
      });
    }, renderer);
    await frames(page);
    expect(await page.evaluate(() => transitions[0])).toMatchObject({ type: "sectionenter", id: "first" });
    await page.evaluate(() => amber.scrollTo(220, { immediate: true }));
    expect(await page.evaluate(() => transitions.at(-1))).toMatchObject({
      type: "sectionleave",
      id: "first",
      intersecting: true,
    });
  });
}

test("selector targets filter work, tolerate missing matches, and react to late class changes", async ({ page }) => {
  await page.evaluate(() => {
    window.transitions = [];
    mount({
      autoRaf: false,
      observeSections: {
        targets: [".js-observe", "#does-not-exist", ".js-observe"],
        onEnter: entry => transitions.push(["enter", entry.target.id]),
        onLeave: entry => transitions.push(["leave", entry.target.id, entry.reason]),
      },
    });
  });
  await frames(page);
  expect(await page.evaluate(() => transitions)).toEqual([]);

  await page.evaluate(() => document.querySelector("#first").classList.add("js-observe"));
  await expect.poll(() => page.evaluate(() => transitions)).toEqual([["enter", "first"]]);

  await page.evaluate(() => document.querySelector("#first").classList.remove("js-observe"));
  await expect.poll(() => page.evaluate(() => transitions)).toEqual([
    ["enter", "first"],
    ["leave", "first", "unobserved"],
  ]);
});

test("sections inserted after construction can satisfy previously missing selectors", async ({ page }) => {
  await page.evaluate(() => {
    window.transitions = [];
    mount({
      autoRaf: false,
      observeSections: {
        targets: [".late-section"],
        onEnter: entry => transitions.push(entry.target.id),
      },
    });
    const section = document.createElement("section");
    section.id = "late";
    section.className = "late-section";
    section.style.height = "100px";
    document.querySelector("#content").prepend(section);
  });
  await expect.poll(() => page.evaluate(() => transitions)).toEqual(["late"]);
});

test("invalid target selectors fail clearly while missing valid selectors do not", async ({ page }) => {
  const result = await page.evaluate(() => {
    amber.destroy();
    let invalid = "";
    try { new Amber({ renderer: transform, plugins: amberPlugins, observeSections: { targets: ["["] } }); }
    catch (error) { invalid = `${error.name}: ${error.message}`; }
    const valid = new Amber({ renderer: transform, plugins: amberPlugins, observeSections: { targets: ["#not-created-yet"] } });
    valid.destroy();
    return invalid;
  });
  expect(result).toContain("SyntaxError: Amber: invalid section target selector");
});
