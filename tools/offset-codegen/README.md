# Offset codegen

Generates `usermode/src/sdk/dead_offsets.hpp` from a dezlock dump.

## After a game patch

1. Run `dumper/dezlock-dump.exe`
2. Replace `dumper/schema-dump/deadlock/` with the new dump
3. Run:

```powershell
.\tools\generate_offsets.ps1
```

4. Rebuild `usermode` (Release | x64)

Building in Visual Studio also runs this automatically when the dump folder is present.

## Files

| File | Purpose |
|------|---------|
| `generate_offsets.py` | Parser + header writer |
| `fields.json` | Allowlist of radar fields and globals |
| `../generate_offsets.ps1` | PowerShell entry point |

See [docs/sdk-and-offsets.md](../../docs/sdk-and-offsets.md) for the full workflow.
