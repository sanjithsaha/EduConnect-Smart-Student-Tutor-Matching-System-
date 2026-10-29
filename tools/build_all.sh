#!/usr/bin/env bash
# Rebuild every generated artefact and run all checks.
# Needs: Java + Graphviz + plantuml.jar (https://github.com/plantuml/plantuml/releases -> tools/plantuml.jar),
#        Python 3 with matplotlib, Node.js 18+, and a TeX Live with pdflatex/bibtex/pgfgantt (or use Overleaf).
set -euo pipefail
cd "$(dirname "$0")/.."
python3 docs/schedule/gantt.py
./tools/render_diagrams.sh
node tests/run-tests.js
python3 tests/test_schema.py
python3 tests/check_consistency.py
if command -v pdflatex >/dev/null; then
  (cd docs/proposal && pdflatex -interaction=nonstopmode main.tex && bibtex main && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex)
  cp docs/proposal/main.pdf docs/proposal/EduConnect_Proposal.pdf
fi
echo "Build complete."
