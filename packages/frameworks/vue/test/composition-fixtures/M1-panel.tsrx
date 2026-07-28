export function Panel({ label, children }) @{
	<section data-panel>
		<h2 data-panel-label>{label}</h2>
		<div data-panel-body>{children}</div>
	</section>
}
