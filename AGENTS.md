# AGENT GUIDANCE

## Running the sandboxed tests

- Ensure dependencies are installed (`npm install`) so `node_modules/.bin/srt` exists.
- Each test directory under `test/` contains:
   - `command.sh`: the command to execute (should not itself invoke `srt`).
   - `srt-settings.json`: the sandbox configuration used for that test.
- Run the orchestrator from the repository root:

```bash
test/run.sh
```

- To update a test’s behavior, edit `test/<name>/command.sh` (the command) and adjust its `srt-settings.json` as needed. Make sure `network` and `filesystem` sections are present and specify explicit allows/denies as the sandbox requires.
