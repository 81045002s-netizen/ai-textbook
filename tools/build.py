#!/usr/bin/env python3
"""從 units/ 的內容檔輸出兩份靜態網站：
  dist/student/index.html  學生版（不含 teacher: 欄位、答案、規準、教師指引）
  dist/teacher/index.html  教師版（完整內容、投影模式、雙向細目表、匯入批改）
每份都是單一 HTML 檔（CSS、JS、內容全部內嵌），可放 GitHub Pages，也可直接在電腦上開啟。
用法：python3 tools/build.py   （需要 PyYAML）
"""
import base64, copy, datetime, json, pathlib, yaml

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "site-src"
DIST = ROOT / "dist"


class _Loader(yaml.SafeLoader):
    """YAML 1.2 風格：只有 true/false 是布林值（避免鍵名 no、on 被當成布林）。"""
import re as _re
_Loader.yaml_implicit_resolvers = {k: [r for r in v if r[0] != "tag:yaml.org,2002:bool"] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
_Loader.add_implicit_resolver("tag:yaml.org,2002:bool", _re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))
def yload(text):
    return yaml.load(text, Loader=_Loader)

def y(p):
    return yload(p.read_text(encoding="utf-8"))

def load_unit(d):
    u = {"meta": y(d / "unit.yaml"), "text": y(d / "text.yaml"), "plan": y(d / "lesson-plan.yaml"),
         "extension": y(d / "extension.yaml"), "assets": y(d / "assets.yaml"),
         "misconceptions": y(d / "misconceptions.yaml"), "core": y(d / "items" / "core.yaml"),
         "blueprint_notes": y(d / "items" / "blueprint-notes.yaml"), "scripts": y(d / "scripts" / "07B.yaml"),
         "worksheets": {}, "assessments": {}}
    for f in sorted((d / "worksheets").glob("lesson-*.yaml")):
        w = y(f); u["worksheets"][w["lesson"]] = w
    for f in sorted((d / "items").glob("*.yaml")):
        if f.stem in ("core", "blueprint-notes"): continue
        a = y(f); u["assessments"][a["id"]] = a
    images = {}
    for f in sorted((d / "scripts" / "img").glob("*.png")):
        images[f.name] = "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode()
    return u, images

def strip_teacher(o):
    if isinstance(o, dict):
        return {k: strip_teacher(v) for k, v in o.items() if k != "teacher"}
    if isinstance(o, list):
        return [strip_teacher(v) for v in o]
    return o

def student_view(u):
    s = copy.deepcopy(u)
    s["plan"]["design"] = [d for d in s["plan"]["design"] if d.get("student")]
    for L in s["plan"]["lessons"]:
        for st in L["steps"]:
            st["blocks"] = [b for b in st["blocks"] if not b["type"].startswith("teacher_")]
    s.pop("scripts", None)
    return strip_teacher(s)

def page(mode, units, images):
    built = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    data = {"mode": mode, "built_at": built, "units": units}
    if mode == "teacher": data["images"] = images
    js = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    css = (SRC / "style.css").read_text(encoding="utf-8")
    app = (SRC / "app.js").read_text(encoding="utf-8")
    title = "AI 教科書（教師版）" if mode == "teacher" else "AI 教科書"
    return f"""<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>{'<meta name="robots" content="noindex,nofollow">' if mode == 'teacher' else ''}
<style>{css}</style></head>
<body><div id="app"></div>
<script>window.TB={js};</script>
<script>{app}</script>
</body></html>
"""

def main():
    units_t, units_s, images = [], [], {}
    for d in sorted((ROOT / "units").iterdir()):
        if not (d / "unit.yaml").exists(): continue
        u, im = load_unit(d); images.update(im)
        units_t.append(u); units_s.append(student_view(u))
    for mode, us in (("student", units_s), ("teacher", units_t)):
        out = DIST / mode; out.mkdir(parents=True, exist_ok=True)
        (out / "index.html").write_text(page(mode, us, images), encoding="utf-8")
        print("輸出", out / "index.html", f"{(out / 'index.html').stat().st_size/1024:.0f} KB")
    # 學生版不得含教師欄位：抽查幾段教師專用原文
    s = (DIST / "student" / "index.html").read_text(encoding="utf-8")
    for probe in ["B：同相、建設性干涉", "Q1不以預測正誤評分", "能畫出或敘述兩組代表案例", "江長屹", "OpenStax University Physics Vol. 1"]:
        assert probe not in s, f"學生版含教師內容：{probe}"
    print("學生版檢查：未含教師專用內容 ✓")

if __name__ == "__main__":
    main()
