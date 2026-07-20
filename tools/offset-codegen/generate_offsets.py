#!/usr/bin/env python3
"""
Generate usermode/src/sdk/dead_offsets.hpp from a dezlock schema dump.

Inputs (under dumper/schema-dump/deadlock by default):
  - client.txt     field offsets  (Class.field = 0xNNN)
  - _globals.txt   module RVAs    (client.dll::Name / # Name @ client.dll+0xNNN)

Usage:
  python tools/offset-codegen/generate_offsets.py
  python tools/offset-codegen/generate_offsets.py --dump path/to/deadlock
  python tools/offset-codegen/generate_offsets.py --check   # verify dump only, no write
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

FIELD_LINE = re.compile(
    r"^(?P<cls>[A-Za-z0-9_]+)\.(?P<field>[A-Za-z0-9_]+)\s*=\s*(?P<off>0x[0-9A-Fa-f]+)\b"
)
MODULE_PTR = re.compile(
    r"^(?P<mod>[A-Za-z0-9_.]+)::(?P<name>[A-Za-z0-9_]+)\s*=\s*(?P<off>0x[0-9A-Fa-f]+)\s*\(pointer\)"
)
SCHEMA_SINGLETON = re.compile(
    r"^#\s+(?P<name>[A-Za-z0-9_]+)\s+@\s+(?P<mod>[A-Za-z0-9_.]+)\+(?P<off>0x[0-9A-Fa-f]+)\s*\(pointer\)"
)


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_config(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def parse_client_fields(client_txt: Path) -> dict[tuple[str, str], int]:
    """Map (Class, field) -> offset. Prefer first definition without inherited parent note."""
    preferred: dict[tuple[str, str], int] = {}
    inherited: dict[tuple[str, str], int] = {}

    with client_txt.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            match = FIELD_LINE.match(line)
            if not match:
                continue

            key = (match.group("cls"), match.group("field"))
            value = int(match.group("off"), 16)

            # Inherited expansions look like: "... (type, ParentClass)"
            is_inherited = bool(re.search(r"\([^)]*,\s*[A-Za-z0-9_]+\)\s*$", line))
            if is_inherited:
                inherited.setdefault(key, value)
            else:
                preferred.setdefault(key, value)

    preferred.update({k: v for k, v in inherited.items() if k not in preferred})
    return preferred


def parse_globals(globals_txt: Path) -> tuple[dict[tuple[str, str], int], dict[tuple[str, str], int]]:
    """Return (module_pointers, schema_singletons) keyed by (module, name)."""
    module_ptrs: dict[tuple[str, str], int] = {}
    schema_singletons: dict[tuple[str, str], int] = {}

    with globals_txt.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            stripped = line.strip()
            schema = SCHEMA_SINGLETON.match(stripped)
            if schema:
                key = (schema.group("mod").lower(), schema.group("name"))
                schema_singletons.setdefault(key, int(schema.group("off"), 16))
                continue

            mod = MODULE_PTR.match(stripped)
            if mod:
                key = (mod.group("mod").lower(), mod.group("name"))
                module_ptrs.setdefault(key, int(mod.group("off"), 16))

    return module_ptrs, schema_singletons


def resolve_fields(cfg: dict, field_map: dict[tuple[str, str], int]) -> list[tuple[dict, int, str]]:
    resolved = []
    for entry in cfg["fields"]:
        symbol = entry["symbol"]
        cls = entry.get("class")
        field = entry.get("field")
        fallback = entry.get("fallback")
        optional = entry.get("optional", False)

        value = None
        source = None
        if cls and field:
            value = field_map.get((cls, field))
            if value is not None:
                source = f"{cls}.{field}"

        if value is None and fallback is not None:
            value = int(fallback, 16) if isinstance(fallback, str) else int(fallback)
            source = "fallback"

        if value is None:
            if optional:
                continue
            raise SystemExit(f"missing required field {symbol} ({cls}.{field})")

        resolved.append((entry, value, source or "?"))
    return resolved


def resolve_globals(
    cfg: dict,
    module_ptrs: dict[tuple[str, str], int],
    schema_singletons: dict[tuple[str, str], int],
) -> list[tuple[dict, int, str]]:
    resolved = []
    for entry in cfg["globals"]:
        symbol = entry["symbol"]
        kind = entry["kind"]
        module = entry["module"].lower()
        name = entry["name"]
        key = (module, name)

        if kind == "schema_singleton":
            value = schema_singletons.get(key)
            source = f"schema {module}+{name}"
            if value is None:
                # Fall back to module pointer line if present
                value = module_ptrs.get(key)
                source = f"module {module}::{name}"
        elif kind == "module_pointer":
            value = module_ptrs.get(key)
            source = f"module {module}::{name}"
            if value is None:
                value = schema_singletons.get(key)
                source = f"schema {module}+{name}"
        else:
            raise SystemExit(f"unknown global kind: {kind}")

        if value is None:
            raise SystemExit(f"missing required global {symbol} ({module}::{name})")

        resolved.append((entry, value, source))
    return resolved


def render_header(
    fields: list[tuple[dict, int, str]],
    globals_: list[tuple[dict, int, str]],
    dump_stamp: str,
) -> str:
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    lines = [
        "#pragma once",
        "",
        "// AUTO-GENERATED by tools/offset-codegen/generate_offsets.py - DO NOT EDIT BY HAND",
        f"// Dump: {dump_stamp}",
        f"// Generated: {generated}",
        "// Re-run: python tools/offset-codegen/generate_offsets.py",
        "",
        "namespace dl_off",
        "{",
    ]

    last_comment = None
    for entry, value, source in fields:
        comment = entry.get("comment") or entry["symbol"]
        if comment != last_comment:
            lines.append(f"\t// {comment}")
            last_comment = comment
        lines.append(f"\tinline constexpr uint32_t {entry['symbol']} = 0x{value:X}; // {source}")

    lines.append("")
    lines.append("\t// Module RVAs (client.dll)")
    for entry, value, source in globals_:
        lines.append(f"\tinline constexpr uintptr_t {entry['symbol']} = 0x{value:X}; // {source}")

    lines.append("}")
    lines.append("")
    return "\n".join(lines)


def dump_stamp_from(dump_dir: Path) -> str:
    for name in ("client.txt", "_globals.txt"):
        path = dump_dir / name
        if path.exists():
            # Prefer Generated comment inside sdk header if present
            return path.name
    return dump_dir.name


def find_dump_generated_marker(dump_dir: Path) -> str:
    marker_files = [
        dump_dir / "sdk" / "client" / "_offsets.hpp",
        dump_dir / "sdk" / "client" / "structs" / "CCitadelPlayerController.hpp",
    ]
    for path in marker_files:
        if not path.exists():
            continue
        with path.open(encoding="utf-8", errors="replace") as f:
            for line in f:
                if "Generated:" in line:
                    return line.strip().lstrip("/ ").strip()
    return f"dezlock dump @ {dump_dir}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate dead_offsets.hpp from dezlock dump")
    parser.add_argument("--repo", type=Path, default=repo_root(), help="Repository root")
    parser.add_argument("--dump", type=Path, default=None, help="Path to schema-dump/deadlock")
    parser.add_argument("--config", type=Path, default=None, help="fields.json path")
    parser.add_argument("--output", type=Path, default=None, help="Output header path")
    parser.add_argument("--check", action="store_true", help="Resolve only; do not write")
    parser.add_argument(
        "--allow-missing-dump",
        action="store_true",
        help="Exit 0 without writing if dump folder is missing (for optional PreBuild)",
    )
    args = parser.parse_args()

    repo = args.repo.resolve()
    config_path = (args.config or Path(__file__).with_name("fields.json")).resolve()
    cfg = load_config(config_path)

    dump_dir = (args.dump or (repo / cfg["dump_relative"])).resolve()
    output_path = (args.output or (repo / cfg["output_relative"])).resolve()

    client_txt = dump_dir / "client.txt"
    globals_txt = dump_dir / "_globals.txt"

    if not dump_dir.is_dir() or not client_txt.is_file() or not globals_txt.is_file():
        if args.allow_missing_dump:
            print(f"[offset-codegen] dump not found at {dump_dir}; keeping existing offsets")
            return 0
        print(f"[offset-codegen] ERROR: expected dump files at {dump_dir}", file=sys.stderr)
        print("  need: client.txt and _globals.txt", file=sys.stderr)
        return 1

    field_map = parse_client_fields(client_txt)
    module_ptrs, schema_singletons = parse_globals(globals_txt)
    fields = resolve_fields(cfg, field_map)
    globals_ = resolve_globals(cfg, module_ptrs, schema_singletons)

    print(f"[offset-codegen] dump: {dump_dir}")
    print(f"[offset-codegen] fields resolved: {len(fields)}")
    print(f"[offset-codegen] globals resolved: {len(globals_)}")
    for entry, value, source in fields:
        print(f"  {entry['symbol']:28} 0x{value:X}  ({source})")
    for entry, value, source in globals_:
        print(f"  {entry['symbol']:28} 0x{value:X}  ({source})")

    if args.check:
        print("[offset-codegen] check OK (no write)")
        return 0

    header = render_header(fields, globals_, find_dump_generated_marker(dump_dir))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(header, encoding="utf-8", newline="\n")
    print(f"[offset-codegen] wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
