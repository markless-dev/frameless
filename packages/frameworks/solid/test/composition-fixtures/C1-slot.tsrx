function Frame({ children }) @{
	<section data-frame>{children}</section>
}

export function SlotPage() @{
	<Frame><strong data-projected-node>Projected composition</strong></Frame>
}
