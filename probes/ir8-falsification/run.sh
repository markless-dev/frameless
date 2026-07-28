#!/usr/bin/env bash
# T001 STEP 0 FALSIFICATION GATE - re-runnable driver.
#
# Three arms per lane, and all three are load-bearing:
#   control   TODAY's untyped emitted shape + a wrong-typed call site  -> expect GREEN
#   negative  IR-8 typed shape             + the SAME call site        -> expect RED
#   positive  IR-8 typed shape             + a correct call site       -> expect GREEN
#
# control is what makes the measurement causal rather than correlational: it
# reproduces the five prior "instrument GREEN on an UNTYPED prop" results, so a
# RED in negative/ is attributable to the type and not to probe scaffolding.
#
# node_modules in each lane is a symlink to the package or official demo that
# owns that instrument; nothing here is installed and nothing is a workspace
# member. Disposable evidence - delete the directory and nothing breaks.
set -u
cd "$(dirname "$0")"
ROOT=../..
TSC=$ROOT/node_modules/.bin/tsc

run() { # label expectation command...
	local label=$1 expect=$2
	shift 2
	echo "----- $label (expect $expect) -----"
	"$@" 2>&1 | sed 's/^/    /'
	local code=${PIPESTATUS[0]}
	echo "    exit=$code"
}

for lane in react solid qwik; do
	for arm in control negative positive; do
		(cd "$lane" && run "$lane/$arm" "$([ "$arm" = negative ] && echo RED || echo GREEN)" \
			../$TSC -p "tsconfig.$arm.json" --pretty false)
	done
done

for arm in control negative positive; do
	(cd vue && run "vue/$arm" "$([ "$arm" = negative ] && echo RED || echo GREEN)" \
		./node_modules/.bin/vue-tsc --noEmit -p "tsconfig.$arm.json" --pretty false)
done

for arm in control negative positive; do
	(cd svelte && run "svelte/$arm" "$([ "$arm" = negative ] && echo RED || echo GREEN)" \
		./node_modules/.bin/svelte-check --workspace . --tsconfig "./tsconfig.$arm.json" --output machine-verbose)
done

for arm in control negative positive; do
	(cd angular && run "angular/$arm" "$([ "$arm" = negative ] && echo RED || echo GREEN)" \
		./node_modules/.bin/ng build "$arm")
done

echo
echo "===== SUPPORTING PROBES (not part of the RED/GREEN matrix) ====="
(cd react && run "react/extension: typed body in a .jsx file" RED \
	../$TSC -p tsconfig.extension.json --pretty false)
(cd react && run "react/negative under strict:false" RED \
	../$TSC -p tsconfig.negative.nostrict.json --pretty false)
(cd vue && run "vue/coupling: defineProps<T>() without lang=ts" RED \
	./node_modules/.bin/vue-tsc --noEmit -p tsconfig.coupling.json --pretty false)
(cd svelte && run "svelte/coupling: \$props() annotation without lang=ts" RED \
	./node_modules/.bin/svelte-check --workspace . --tsconfig ./tsconfig.coupling.json --output machine-verbose)
(cd angular && run "angular/negative with strictTemplates:false" GREEN \
	./node_modules/.bin/ng build negative-nostrict)
