// CONTROL ARM. TODAY's emitted shape, verbatim: every @Input() typed `any`.
// Compare packages/frameworks/angular/generated/S1.ts.
import { Component, Input } from '@angular/core';

@Component({
	selector: 'frameless-render-once',
	template: ` <output data-value="derived">{{ derived }}</output> `,
})
export class RenderOnce {
	@Input() label: any;
	@Input() multiplier: any;
	count: any = 1;
	get derived(): any {
		return `${this.label}:${this.count * this.multiplier}`;
	}
}
