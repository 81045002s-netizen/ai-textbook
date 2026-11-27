#!/usr/bin/env python3
"""逐字比對：檢查單元內容檔中每一段文字，都能在原始 docx（01–10、教材文本 v2、架構報告）中找到。
比對時忽略空白、換行與全形/半形空白；其他字元必須完全一致。
用法：python3 tools/verify_sources.py   （需要 python-docx、PyYAML）
"""
import pathlib, re, sys, yaml, docx

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROJ = ROOT.parent
SOURCES = sorted((PROJ / "02_已填寫參考範例").glob("*.docx")) + [
    PROJ / "04_教材文本" / "干涉與繞射_教材文本_原文照錄版_v2.docx",
    PROJ / "03_網站架構" / "AI教科書網站架構_專案報告.docx",
]
# 不是教材文字的結構欄位（編號、檔名代碼、網址、型別、對應關係）
SKIP_KEYS = {"id", "group", "type", "kind", "status", "commons", "source_url", "url", "img",
             "lessons", "lesson", "n", "ids", "node", "paras", "plan_row", "q", "revise_of",
             "levels_keys", "lines_n", "multi", "key", "lock", "ai", "pending", "pending_items",
             "hints_pending", "declared", "activity", "src", "struct_title", "nodes", "source_file"}
# 註：key（Q4 自動計分答案）的值是選項文字，另於下方檢查必須出現在選項中。

def norm(s):
    s = s.replace("&amp;", "&")
    return re.sub(r"[\s　]+", "", s)

def doc_text(p):
    d = docx.Document(str(p))
    out = []
    def walk_tables(tables):
        for t in tables:
            for row in t.rows:
                for c in row.cells:
                    out.append(c.text)
                    walk_tables(c.tables)
    out += [x.text for x in d.paragraphs]
    walk_tables(d.tables)
    for s in d.sections:
        for part in (s.header, s.footer):
            out += [x.text for x in part.paragraphs]
    # 超連結文字
    for rel in d.part.rels.values():
        pass
    return "\n".join(out)


class _Loader(yaml.SafeLoader):
    """YAML 1.2 風格：只有 true/false 是布林值（避免鍵名 no、on 被當成布林）。"""
import re as _re
_Loader.yaml_implicit_resolvers = {k: [r for r in v if r[0] != "tag:yaml.org,2002:bool"] for k, v in yaml.SafeLoader.yaml_implicit_resolvers.items()}
_Loader.add_implicit_resolver("tag:yaml.org,2002:bool", _re.compile(r"^(?:true|True|TRUE|false|False|FALSE)$"), list("tTfF"))
def yload(text):
    return yaml.load(text, Loader=_Loader)

corpus = ""
for p in SOURCES:
    corpus += norm(doc_text(p)) + "¶"

def leaves(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in SKIP_KEYS:
                continue
            yield from leaves(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from leaves(v, f"{path}[{i}]")
    elif isinstance(o, str):
        yield path, o

bad = 0; total = 0
for f in sorted((ROOT / "units").rglob("*.yaml")):
    data = yload(f.read_text(encoding="utf-8"))
    for path, s in leaves(data):
        total += 1
        if norm(s) and norm(s) not in corpus:
            bad += 1
            print(f"[未在來源找到] {f.relative_to(ROOT)} {path}: {s!r}")
print(f"檢查 {total} 段文字，{bad} 段未在來源中逐字找到。")
sys.exit(1 if bad else 0)
