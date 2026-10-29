#!/usr/bin/env python3
"""Generate the Gantt chart (PNG/SVG), a LaTeX pgfgantt chart and schedule tables
from tasks.csv, so the schedule has a single source of truth.
Usage: python3 docs/schedule/gantt.py   (needs matplotlib)"""
import csv, pathlib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Patch

HERE = pathlib.Path(__file__).parent
rows = list(csv.DictReader(open(HERE / "tasks.csv", newline="", encoding="utf-8")))
tasks = [r for r in rows if r["type"] == "task"]
miles = [r for r in rows if r["type"] == "milestone"]
WEEKS = 8

# ---------- PNG / SVG ----------
fig, ax = plt.subplots(figsize=(12, 7.2))
order = tasks + miles
ypos = {r["id"]: len(order) - i for i, r in enumerate(order)}
for r in tasks:
    s, e, y = int(r["start"]), int(r["end"]), ypos[r["id"]]
    ax.barh(y, e - s + 1, left=s - 1, height=0.55, color="#1F4E79", edgecolor="white")
    ax.text(s - 1 + (e - s + 1) / 2, y, f"W{s}" if s == e else f"W{s}-{e}", ha="center", va="center", color="white", fontsize=8)
for r in miles:
    w, y = int(r["end"]), ypos[r["id"]]
    ax.scatter(w, y, marker="D", s=90, color="#B7791F", zorder=3)
for r in tasks:  # finish-to-start dependency connectors (elbow lines)
    for d in filter(None, [x.strip() for x in r["depends_on"].split(",")]):
        dep = next(t for t in tasks if t["id"] == d)
        x0, x1 = int(dep["end"]) + 0.04, int(r["start"]) - 1
        y0, y1 = ypos[d] - 0.28, ypos[r["id"]]
        ax.plot([x0, x0], [y0, y1], color="#8a8a8a", lw=0.7, zorder=1)
        if x1 > x0:
            ax.annotate("", xy=(x1, y1), xytext=(x0, y1), arrowprops=dict(arrowstyle="->", color="#8a8a8a", lw=0.7))
        else:
            ax.annotate("", xy=(x0, ypos[r["id"]] + 0.28), xytext=(x0, ypos[r["id"]] + 0.5), arrowprops=dict(arrowstyle="->", color="#8a8a8a", lw=0.7))
ax.set_yticks([ypos[r["id"]] for r in order])
ax.set_yticklabels([f'{r["id"]}  {r["name"]}' if r["type"] == "task" else r["name"] for r in order], fontsize=8.5)
ax.set_xlim(0, WEEKS + 0.15)
ax.set_xticks([i + 0.5 for i in range(WEEKS)])
ax.set_xticklabels([f"Week {i + 1}" for i in range(WEEKS)], fontsize=9)
for i in range(WEEKS + 1):
    ax.axvline(i, color="#dde5ee", lw=0.8, zorder=0)
ax.xaxis.tick_top()
ax.set_ylim(0.3, len(order) + 0.8)
ax.set_title("EduConnect - 8-Week Project Schedule", pad=28, color="#1F4E79", fontsize=14)
ax.legend(handles=[Patch(color="#1F4E79", label="Task"), plt.Line2D([], [], marker="D", ls="", color="#B7791F", label="Milestone (end of week)")],
          loc="upper right", fontsize=8)
for sp in ("right", "bottom", "left"):
    ax.spines[sp].set_visible(False)
plt.tight_layout()
fig.savefig(HERE / "gantt.png", dpi=170)
fig.savefig(HERE / "gantt.svg")

# ---------- LaTeX helpers ----------
tex_esc = lambda s: s.replace("&", r"\&").replace("_", r"\_")
t = [r"\begin{longtable}{@{}p{0.6cm}p{4.6cm}c p{1.8cm} p{4.6cm}@{}}", r"\toprule",
     r"\textbf{ID} & \textbf{Task} & \textbf{Weeks} & \textbf{Depends on} & \textbf{Deliverable} \\ \midrule \endhead"]
for r in tasks:
    wk = r["start"] if r["start"] == r["end"] else f'{r["start"]}--{r["end"]}'
    t.append(f'{r["id"]} & {tex_esc(r["name"])} & {wk} & {r["depends_on"] or "--"} & {tex_esc(r["deliverable"])} \\\\')
t += [r"\bottomrule", r"\end{longtable}"]
(HERE / "schedule_table.tex").write_text("\n".join(t) + "\n", encoding="utf-8")

m = [r"\begin{tabular}{@{}p{5.4cm}c p{2cm} p{4cm}@{}}", r"\toprule",
     r"\textbf{Milestone} & \textbf{Week} & \textbf{Gate task} & \textbf{Exit criterion} \\ \midrule"]
for r in miles:
    m.append(f'{tex_esc(r["name"])} & {r["end"]} & {r["depends_on"]} & {tex_esc(r["deliverable"])} \\\\')
m += [r"\bottomrule", r"\end{tabular}"]
(HERE / "milestone_table.tex").write_text("\n".join(m) + "\n", encoding="utf-8")

g = [r"\begin{ganttchart}[hgrid, vgrid={*{8}{draw=gray!30}}, y unit title=0.55cm, y unit chart=0.5cm, x unit=0.9cm,",
     r"  title height=1, bar height=0.55, bar/.append style={fill=blue!45!black}, milestone/.append style={fill=orange!80!black},",
     r"  bar label font=\scriptsize, milestone label font=\scriptsize, title label font=\scriptsize, link/.style={->, gray}]{1}{%d}" % WEEKS,
     r"\gantttitle{Project week}{%d} \\" % WEEKS,
     r"\gantttitlelist{1,...,%d}{1} \\" % WEEKS]
for r in tasks:
    g.append(r"\ganttbar[name=%s]{%s}{%s}{%s} \\" % (r["id"], tex_esc(f'{r["id"]} {r["name"]}'), r["start"], r["end"]))
for i, r in enumerate(miles):
    g.append(r"\ganttmilestone[name=%s]{%s}{%s}%s" % (r["id"], tex_esc(r["name"]), r["end"], r" \\" if i < len(miles) - 1 else ""))
for r in tasks:
    for d in filter(None, [x.strip() for x in r["depends_on"].split(",")]):
        g.append(r"\ganttlink{%s}{%s}" % (d, r["id"]))
g.append(r"\end{ganttchart}")
(HERE / "gantt.tex").write_text("\n".join(g) + "\n", encoding="utf-8")

# ---------- Markdown tables ----------
md = ["| ID | Task | Weeks | Depends on | Deliverable |", "|---|---|---|---|---|"]
for r in tasks:
    wk = r["start"] if r["start"] == r["end"] else f'{r["start"]}-{r["end"]}'
    md.append(f'| {r["id"]} | {r["name"]} | {wk} | {r["depends_on"] or "-"} | {r["deliverable"]} |')
md += ["", "| Milestone | End of week | Gate task(s) | Exit criterion |", "|---|---|---|---|"]
for r in miles:
    md.append(f'| {r["name"]} | {r["end"]} | {r["depends_on"]} | {r["deliverable"]} |')
(HERE / "schedule_tables.md").write_text("\n".join(md) + "\n", encoding="utf-8")
print("Generated gantt.png/svg, gantt.tex, schedule_table.tex, milestone_table.tex, schedule_tables.md")

# ---------- copy generated LaTeX fragments next to the proposal (Overleaf-friendly) ----------
import shutil
out = HERE.parent / "proposal" / "generated"
out.mkdir(parents=True, exist_ok=True)
for name in ("gantt.tex", "schedule_table.tex", "milestone_table.tex"):
    shutil.copy(HERE / name, out / name)
shutil.copy(HERE / "gantt.png", HERE.parent / "proposal" / "figures" / "gantt.png")
