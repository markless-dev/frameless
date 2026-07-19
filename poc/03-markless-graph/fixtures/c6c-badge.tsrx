// Props destructuring child, imported by c6c-props.tsrx. (No destructuring
// default: markless 0.1.1 rejects graph destructuring defaults with
// MARKLESS_STATE_DESTRUCTURE_DEFAULT_UNSUPPORTED — recorded as a finding.)
export function Badge({ label, tone }: { label: string; tone: string }) @{
	<em data-badge data-tone={tone}>{label}</em>
}
