#!/usr/bin/env bash
set -euo pipefail

# outfile="project-context.txt"
# rm -f "$outfile"

{
  echo "Project Context Snapshot - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo

  # Start with fixed files if they exist
  for f in package.json index.html; do
    if [[ -f "$f" ]]; then
      echo "===================="
      echo "FILE: $f"
      echo "===================="
      echo
      cat "$f"
      echo -e "\n\n"
    fi
  done

  # Then all files under src/, sorted safely
  find src -type f -print0 \
    | LANG=C sort -z \
    | xargs -0 -I{} sh -c '
      f="{}"
      echo "===================="
      echo "FILE: $f"
      echo "===================="
      echo
      cat "$f"
      echo
      echo
    '

} > "$outfile"

echo "Wrote $outfile"
ls -lah "$outfile"
wc -l "$outfile"
