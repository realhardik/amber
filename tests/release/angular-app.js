// JIT keeps the release smoke fixture small; imports resolve from the isolated
// consumer containing installed npm tarballs, never from repository source.
import '@angular/compiler';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import Amber from 'amber-scroll';
import transform from 'amber-scroll/transform';
import { Animation, bindScroll } from 'amber-motion';
import { Animation as SvgAnimation } from 'amber-motion/svg';

class ScrollPage {
  ngAfterViewInit() {
    const wrapper = document.querySelector('#viewport');
    this.amber = new Amber({ wrapper, content: wrapper.querySelector('main'), renderer: transform,
      autoRaf: false, historyKey: 'angular-release' });
    this.animation = new Animation({ el: document.querySelector('#box'), t: { o: [0, 1] } });
    this.binding = bindScroll(this.amber, this.animation);
    this.svg = new SvgAnimation({ el: document.querySelector('#shape'),
      morph: { start: 'M0 0 L10 10', end: 'M0 0 L20 20' }, line: {} });
    this.svg.seek(.5);
    window.releaseState = { amber: this.amber, animation: this.animation, svg: this.svg };
  }
  ngOnDestroy() {
    this.amber.destroy();
    this.binding.destroy();
    this.animation.destroy();
    this.svg.destroy();
    window.destroyedReleaseState = { amber: this.amber.isDestroyed, animation: this.animation.destroyed, svg: this.svg.destroyed };
  }
}
Component({ standalone: true, selector: 'scroll-page', template: `
  <div id="viewport" style="position:relative;width:400px;height:200px;overflow:auto">
    <main style="position:relative">
      <section style="height:200px;position:relative">
        <a id="jump" href="#target" style="position:absolute;top:80px">Jump</a><div id="box">Motion binding</div>
        <svg width="30" height="30"><path id="shape" d="M0 0 L10 10" /></svg>
      </section>
      <section id="target" style="height:200px">Target</section>
      <section style="height:200px">End</section>
    </main>
  </div>` })(ScrollPage);
class OtherPage {}
Component({ standalone: true, selector: 'other-page', template: '<p id="other">Other route</p>' })(OtherPage);
class Root {}
Component({ standalone: true, selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })(Root);
bootstrapApplication(Root, { providers: [provideZonelessChangeDetection(), provideRouter([
  { path: 'tests/anchors-history', component: ScrollPage },
  { path: 'other', component: OtherPage },
])] }).then(app => { window.releaseRouter = app.injector.get(Router); }).catch(error => { throw error; });
