"""Cross-checks that the class diagram, ERD, SQL schema and prototype code agree.
Run: python3 tests/check_consistency.py"""
import pathlib, re, sys

root = pathlib.Path(__file__).parent.parent
read = lambda p: (root / p).read_text(encoding="utf-8")
ok = True

def check(name, cond, detail=""):
    global ok
    ok &= bool(cond)
    print(("PASS  " if cond else "FAIL  ") + name + (f"  {detail}" if detail and not cond else ""))

# 1. Class diagram <-> JavaScript classes
puml = read("diagrams/source/class.puml")
uml_classes = set(re.findall(r"^(?:abstract class|class|enum)\s+(\w+)", puml, re.M))
js = "".join(read(f"prototype/js/{f}") for f in ("models.js", "matcher.js", "bookingManager.js"))
js_classes = set(re.findall(r"^class\s+(\w+)", js, re.M))
js_classes.add("BookingStatus") if re.search(r"^const BookingStatus", js, re.M) else None
check("class diagram classes == prototype classes", uml_classes == js_classes, f"uml-only={uml_classes - js_classes} js-only={js_classes - uml_classes}")
check("at least five required classes present", {"Student", "Tutor", "Subject", "Booking", "AvailabilitySlot", "TutorMatcher"} <= js_classes)

# 2. ERD entities <-> SQL tables
erd = set(re.findall(r'entity "(\w+)"', read("diagrams/source/erd.puml")))
sql = set(re.findall(r"CREATE TABLE (\w+)", read("database/schema.sql")))
check("ERD entities == SQL tables", erd == sql, f"erd-only={erd - sql} sql-only={sql - erd}")

# 3. Six required diagrams exist with sources and renders
required = {"dfd_level1": "dot", "usecase": "puml", "activity": "puml", "erd": "puml", "class": "puml", "object": "puml"}
for name, ext in required.items():
    check(f"diagram '{name}' has source and PNG/SVG",
          all((root / p).exists() for p in (f"diagrams/source/{name}.{ext}", f"diagrams/png/{name}.png", f"diagrams/svg/{name}.svg")))

# 4. Object diagram instances reference real sample data
data = read("prototype/js/data.js")
obj = read("diagrams/source/object.puml")
for token in ("S001", "T001", "SUB02"):
    check(f"object diagram value {token} exists in sample data", token in data and token in obj)

# 5. Proposal references existing figures and bibliography keys
tex = read("docs/proposal/main.tex")
figs = set(re.findall(r"\{(\w+\.png)\}", tex))
check("all figures used by main.tex exist", all((root / "docs/proposal/figures" / f).exists() for f in figs), str(figs))
cited = set(k.strip() for c in re.findall(r"\\cite\{([^}]+)\}", tex) for k in c.split(","))
bib = set(re.findall(r"@\w+\{(\w+),", read("docs/proposal/references.bib")))
check("every \\cite key exists in references.bib", cited <= bib, str(cited - bib))
check("bibliography has no unused entries", bib <= cited, str(bib - cited))
sys.exit(0 if ok else 1)
