import { Frame } from "./frame.tsrx";
import { Dashboard } from "./dashboard.tsrx";
import { Status } from "./status.tsrx";
import { Search } from "./search.tsrx";

export function Page() @{
	<Frame>
		<div data-composition-page>
			<p data-projected-copy>Projected across the Frame module boundary</p>
			<Dashboard />
			<Status />
			<Search />
		</div>
	</Frame>
}
