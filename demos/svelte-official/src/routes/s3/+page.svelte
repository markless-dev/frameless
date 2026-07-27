<script lang="ts">
	import EventForm from '$lib/emitted/EventForm.svelte';
	import { noTrace } from '$lib/scenario-props';
</script>

<!-- S3. Same initial text as the react, solid and qwik lanes. -->
<EventForm initial="hello" onTrace={noTrace} />
