import esbuildSvelte from "esbuild-svelte";

export default {
  entryPoint: "svelte/main.js",
  esbuild: {
    plugins: [esbuildSvelte()],
  },
};
