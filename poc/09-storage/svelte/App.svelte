<script>
  import { onMount } from "svelte";

  let { cell } = $props();
  let value = $state(read());

  function read() {
    return cell.get();
  }

  onMount(() => cell.subscribe((next) => (value = next)));

  function toggle() {
    cell.set(value === "dark" ? "light" : "dark");
  }
</script>

<span id="value">{value}</span>
<button id="toggle" onclick={toggle}>toggle</button>
