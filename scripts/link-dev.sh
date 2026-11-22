#!/bin/bash

set -euo pipefail

project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
plugin_id=$(jq -r '.id' "$project_dir/manifest.json")
plugins_dir="${XDG_CONFIG_HOME:-$HOME/.config}/omarchy/plugins"
link="$plugins_dir/$plugin_id"

if [ -e "$link" ] && [ ! -L "$link" ]; then
  echo "$link exists and is not a symlink; remove it first" >&2
  exit 1
fi

mkdir -p "$plugins_dir"
ln -sfn "$project_dir" "$link"
echo "Linked $link -> $project_dir"
echo "Enable it with: omarchy plugin enable $plugin_id"
