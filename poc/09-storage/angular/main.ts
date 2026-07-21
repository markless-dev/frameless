import "@angular/compiler";
import {
  Component,
  OnDestroy,
  provideZonelessChangeDetection,
  signal,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { storage } from "../core/storage.js";

export const theme = storage("theme", "light");

@Component({
  selector: "storage-theme",
  standalone: true,
  template: `
    <span id="value">{{ value() }}</span>
    <button id="toggle" (click)="toggle()">toggle</button>
  `,
})
class ThemeComponent implements OnDestroy {
  readonly value = signal(theme.get());
  private readonly unsubscribe = theme.subscribe((next) => this.value.set(next));

  toggle() {
    theme.set(this.value() === "dark" ? "light" : "dark");
  }

  ngOnDestroy() {
    this.unsubscribe();
  }
}

@Component({
  selector: "[storage-root]",
  standalone: true,
  imports: [ThemeComponent],
  template: `@if (!inert) { <storage-theme /> }`,
})
class AppComponent {
  readonly inert = new URLSearchParams(location.search).get("inert") === "1";
}

document.getElementById("app")!.setAttribute("storage-root", "");

bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).then(() => {
  (window as any).__READY__ = true;
});
