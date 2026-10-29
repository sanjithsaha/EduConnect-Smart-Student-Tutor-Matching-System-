#!/usr/bin/env bash
# Render every diagram source to PNG + SVG.
# Requires: Java, Graphviz (dot) and plantuml.jar (set PLANTUML_JAR or place it in tools/).
set -euo pipefail
cd "$(dirname "$0")/.."
JAR="${PLANTUML_JAR:-tools/plantuml.jar}"
SRC=diagrams/source
mkdir -p diagrams/png diagrams/svg
for f in "$SRC"/*.puml; do
  java -jar "$JAR" -tpng -o ../png "$f"
  java -jar "$JAR" -tsvg -o ../svg "$f"
done
for f in "$SRC"/*.dot; do
  n=$(basename "$f" .dot)
  dot -Tpng -Gdpi=170 "$f" -o "diagrams/png/$n.png"
  dot -Tsvg "$f" -o "diagrams/svg/$n.svg"
done
# self-contained copy for the LaTeX proposal / Overleaf
mkdir -p docs/proposal/figures
cp diagrams/png/*.png docs/proposal/figures/
echo "Rendered $(ls diagrams/png | wc -l) diagrams."
