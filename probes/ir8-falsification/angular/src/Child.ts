// HAND-WRITTEN PROBE. Not emitted, not a golden, not read by any test.
//
// What @frameless/angular WOULD print if IR-8 supplied the prop types. Compare
// the real golden packages/frameworks/angular/generated/S1.ts, whose inputs are
//   @Input() label: any;
//   @Input() multiplier: any;
// The `: any` is the emitter's placeholder for the missing IR type channel, and
// it is what makes strictTemplates' checkTypeOfInputBindings vacuous today.
import { Component, Input } from '@angular/core';

@Component({
	selector: 'frameless-render-once',
	template: ` <output data-value="derived">{{ derived }}</output> `,
})
export class RenderOnce {
	@Input() label!: string;
	@Input() multiplier!: number;
	count = 1;
	get derived(): string {
		return `${this.label}:${this.count * this.multiplier}`;
	}
}
