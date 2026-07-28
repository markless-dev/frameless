// CONTROL ARM: same wrong-typed call site, against the UNTYPED child.
import { Component } from '@angular/core';
import { RenderOnce } from './Child';

@Component({
	selector: 'frameless-parent',
	imports: [RenderOnce],
	template: ` <frameless-render-once label="s1" [multiplier]="'3'" /> `,
})
export class Parent {}
