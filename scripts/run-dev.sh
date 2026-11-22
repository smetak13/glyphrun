#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
runtime_dir=$(mktemp -d /tmp/glyphrun-dev.XXXXXX)
trap 'rm -rf -- "$runtime_dir"' EXIT

cp -a /usr/share/omarchy/shell/Commons "$runtime_dir/Commons"
cp -a "$project_dir/Glyphrun.qml" "$project_dir/ui" "$project_dir/logic" "$runtime_dir/"
cp "$project_dir/dev/shell.qml" "$runtime_dir/shell.qml"

quickshell -p "$runtime_dir"
