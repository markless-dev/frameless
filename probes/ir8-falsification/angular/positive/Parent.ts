// POSITIVE TWIN: same call site, correctly typed. This MUST go GREEN.
import { Component } from '@angular/core';
import { RenderOnce } from '../src/Child';

@Component({
	selector: 'frameless-parent',
	imports: [RenderOnce],
	template: ` <frameless-render-once label="s1" [multiplier]="3" /> `,
})
export class Parent {}
