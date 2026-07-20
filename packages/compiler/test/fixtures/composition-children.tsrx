export function Frame({ children }) @{
	<section>{children}</section>
}

export function Page() @{
	<Frame><p>projected</p></Frame>
}
