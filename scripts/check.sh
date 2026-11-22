#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$project_dir"

omarchy plugin validate "$project_dir"
node --test tests/

unsupported='\.(at|flat|flatMap|findLast|findLastIndex|replaceAll|trimEnd|trimStart)\(|Object\.(fromEntries|hasOwn)\(|structuredClone\(|\?\?=|\|\|=|&&='
if grep -nE "$unsupported" logic/*.mjs; then
  echo "logic modules use JavaScript that the QML engine lacks (see docs/spikes/rendering.md)" >&2
  exit 1
fi

for module in logic/*.mjs; do
  if ! grep -q "\"../../$module\"" tests/qml/LoadModules.qml; then
    echo "tests/qml/LoadModules.qml does not import $module" >&2
    exit 1
  fi
done

qml_output=$(QT_FORCE_STDERR_LOGGING=1 QT_QPA_PLATFORM=offscreen qml6 tests/qml/LoadModules.qml 2>&1) || true
if ! grep -q "GLYPHRUN_MODULES_OK" <<<"$qml_output"; then
  echo "$qml_output" >&2
  echo "logic modules failed to load in the QML engine" >&2
  exit 1
fi

echo "Glyphrun checks passed"
