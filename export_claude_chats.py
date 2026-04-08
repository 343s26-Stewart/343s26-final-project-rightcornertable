"""
Export Claude Code chat sessions from ~/.claude/projects/ into
well-formatted Markdown files.

Each JSONL session file contains alternating user/assistant entries.
Assistant entries may include thinking blocks, text responses, and tool calls.
User entries may include the human's text or tool results fed back to the model.

Run from the workspace root:
    python export_claude_chats.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

WS_ROOT  = Path.cwd()     # The script is run from the workspace root
DST_DIR  = "chat_claude"  # Directory to save exported Markdown files
MAX_LEN  = 60             # Max length for title previews and slugs

# Tags injected by the harness that should be stripped from user text
_STRIP_TAGS = re.compile(
    r"<(?:ide_opened_file|ide_selection|system-reminder|user-prompt-submit-hook)"
    r"[^>]*>.*?</[^>]+>",
    re.DOTALL,
)

# ------------------------------------------------
# Storage Resolution
# ------------------------------------------------

def get_claude_dir() -> Path:
    """Return the ~/.claude directory."""
    return Path.home() / ".claude"


def get_project_slug() -> str:
    """Convert the current working directory to a Claude project slug.

    Claude names project directories by replacing every path separator and
    colon with a hyphen, then lowercasing the drive letter, so:
        C:\\Users\\foo\\bar  →  c--Users-foo-bar
    """
    cwd = str(WS_ROOT.resolve())
    # Lowercase the drive letter only
    slug = re.sub(r"^([A-Z]):", lambda m: m.group(1).lower() + ":", cwd)
    # Replace every separator/colon with a hyphen (no deduplication — double
    # hyphens are intentional: drive letter colon + path separator → --)
    slug = slug.replace("\\", "-").replace("/", "-").replace(":", "-")
    return slug


def find_project_dir(claude_dir: Path) -> Path:
    """Return the Claude projects directory for the current workspace."""
    slug = get_project_slug()
    project_dir = claude_dir / "projects" / slug
    if not project_dir.exists():
        raise RuntimeError(
            f"Claude project directory not found: {project_dir}\n"
            f"Make sure you have opened this workspace in Claude Code at least once."
        )
    return project_dir


def find_jsonl_files(project_dir: Path) -> list[Path]:
    """Return all JSONL session files in the project directory."""
    return sorted(project_dir.glob("*.jsonl"))


# ------------------------------------------------
# Utility Functions
# ------------------------------------------------

def ts_from_iso(iso: object) -> datetime | None:
    """Parse an ISO-8601 timestamp string into a local datetime."""
    if not isinstance(iso, str):
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.astimezone().replace(tzinfo=None)  # convert to local, strip tz
    except ValueError:
        return None


def format_ts(dt: datetime | None) -> str:
    """Format datetime for display."""
    return dt.strftime("%Y-%m-%d %H:%M:%S") if dt else "unknown"


def slugify(text: str) -> str:
    """Create a filesystem-safe slug from text."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    return text[:MAX_LEN].strip("-") or "chat"


def strip_harness_tags(text: str) -> str:
    """Remove system tags injected by the Claude Code harness."""
    return _STRIP_TAGS.sub("", text).strip()


def tool_label(name: str) -> str:
    """Return an emoji label for a tool call."""
    labels = {
        "Read":       "📖 Read",
        "Write":      "✍️ Write",
        "Edit":       "📝 Edit",
        "Bash":       "💻 Bash",
        "Glob":       "🔍 Glob",
        "Grep":       "🔎 Grep",
        "Agent":      "🤖 Agent",
        "TodoWrite":  "📋 TodoWrite",
        "WebFetch":   "🌐 WebFetch",
        "WebSearch":  "🌐 WebSearch",
    }
    return labels.get(name, f"🔧 {name}")


def format_tool_input(name: str, inp: dict) -> str:
    """Format tool input as a short, readable string."""
    if name == "Bash":
        cmd = inp.get("command", "")
        if len(cmd) > 120:
            cmd = cmd[:120] + "…"
        return f"`{cmd}`"
    if name in ("Read", "Write", "Edit"):
        path = inp.get("file_path", inp.get("path", ""))
        return f"`{path}`"
    if name in ("Glob",):
        return f"`{inp.get('pattern', '')}`"
    if name in ("Grep",):
        return f"`{inp.get('pattern', '')}` in `{inp.get('path', '.')}`"
    # Generic: dump compact JSON, truncated
    s = json.dumps(inp, ensure_ascii=False)
    if len(s) > 200:
        s = s[:200] + "…"
    return s


# ------------------------------------------------
# Parsing JSONL
# ------------------------------------------------

def parse_session(file_path: Path) -> tuple[list[dict], dict]:
    """Parse a JSONL Claude session file into structured turns.

    Returns:
        - turns: list of dicts with keys:
            role       "user" | "assistant"
            timestamp  datetime | None
            text       str  (human-readable content)
            tools      list[str]  (formatted tool call lines, assistant only)
            thinking   str | None  (extended thinking, assistant only)
        - metadata: session-level info
    """
    print(f"Parsing: {file_path.name}")

    with open(file_path, "r", encoding="utf-8") as f:
        entries = [json.loads(line) for line in f if line.strip()]

    metadata: dict[str, Any] = {
        "sessionId": file_path.stem,
        "aiTitle":   None,
        "model":     None,
        "cwd":       None,
        "version":   None,
        "entrypoint": None,
    }

    raw_turns: list[dict] = []

    for entry in entries:
        etype = entry.get("type")

        # ── session-level metadata ──
        if etype == "ai-title":
            metadata["aiTitle"] = entry.get("aiTitle")
            continue

        if etype not in ("user", "assistant"):
            continue

        # Fill metadata from first substantive entry
        if not metadata["cwd"]:
            metadata["cwd"]        = entry.get("cwd")
            metadata["version"]    = entry.get("version")
            metadata["entrypoint"] = entry.get("entrypoint")

        msg      = entry.get("message", {})
        content  = msg.get("content", [])
        ts       = ts_from_iso(entry.get("timestamp"))

        if etype == "assistant":
            if not metadata["model"]:
                metadata["model"] = msg.get("model")
            raw_turns.append({
                "role":      "assistant",
                "timestamp": ts,
                "content":   content,
            })

        elif etype == "user":
            raw_turns.append({
                "role":      "user",
                "timestamp": ts,
                "content":   content,
            })

    # ── post-process raw turns into display turns ──
    turns: list[dict] = []
    seen_tool_ids: set[str] = set()

    for raw in raw_turns:
        role    = raw["role"]
        content = raw["content"]
        ts      = raw["timestamp"]

        if role == "user":
            text_parts = []
            has_only_tool_results = True

            for item in content:
                if not isinstance(item, dict):
                    continue
                itype = item.get("type")
                if itype == "text":
                    cleaned = strip_harness_tags(item.get("text", ""))
                    if cleaned:
                        text_parts.append(cleaned)
                        has_only_tool_results = False
                elif itype == "tool_result":
                    # Tool results are fed back silently; skip for display
                    pass

            # Skip turns that are purely tool-result echo-backs
            if has_only_tool_results and not text_parts:
                continue

            if text_parts:
                turns.append({
                    "role":      "user",
                    "timestamp": ts,
                    "text":      "\n\n".join(text_parts),
                    "tools":     [],
                    "thinking":  None,
                })

        elif role == "assistant":
            text_parts: list[str] = []
            tool_lines: list[str] = []
            thinking_parts: list[str] = []

            for item in content:
                if not isinstance(item, dict):
                    continue
                itype = item.get("type")

                if itype == "text":
                    t = item.get("text", "").strip()
                    if t:
                        text_parts.append(t)

                elif itype == "thinking":
                    t = item.get("thinking", "").strip()
                    if t:
                        thinking_parts.append(t)

                elif itype == "tool_use":
                    tid  = item.get("id", "")
                    name = item.get("name", "unknown")
                    inp  = item.get("input", {})
                    if tid not in seen_tool_ids:
                        seen_tool_ids.add(tid)
                        tool_lines.append(
                            f"{tool_label(name)}: {format_tool_input(name, inp)}"
                        )

            # Merge into any existing assistant turn (streaming chunks)
            if turns and turns[-1]["role"] == "assistant":
                prev = turns[-1]
                if text_parts:
                    prev["text"] = (prev["text"] + "\n\n" + "\n\n".join(text_parts)).strip()
                prev["tools"].extend(tool_lines)
                if thinking_parts and not prev["thinking"]:
                    prev["thinking"] = "\n\n".join(thinking_parts)
            else:
                turns.append({
                    "role":      "assistant",
                    "timestamp": ts,
                    "text":      "\n\n".join(text_parts),
                    "tools":     tool_lines,
                    "thinking":  "\n\n".join(thinking_parts) or None,
                })

    return turns, metadata


# ------------------------------------------------
# Markdown Rendering
# ------------------------------------------------

def escape_html(text: str) -> str:
    """Escape < and > outside of code spans and fenced blocks."""
    result = []
    i = 0
    in_inline = False
    in_fenced = False

    while i < len(text):
        if text.startswith("```", i):
            in_fenced = not in_fenced
            result.append("```")
            i += 3
            continue
        if not in_fenced and text[i] == "`":
            in_inline = not in_inline
            result.append("`")
            i += 1
            continue
        if text.startswith("<br>", i):
            result.append("<br>")
            i += 4
            continue
        c = text[i]
        if not in_inline and not in_fenced:
            if c == "<":
                result.append("&lt;")
            elif c == ">" and not (i == 0 or text[i - 1] == "\n"):
                result.append("&gt;")
            else:
                result.append(c)
        else:
            result.append(c)
        i += 1

    return "".join(result)


def render_session(turns: list[dict], metadata: dict) -> tuple[str, str]:
    """Convert parsed turns into a Markdown document.

    Returns:
        (filename, markdown_content)
    """
    if not turns:
        raise ValueError("No turns to render")

    # Determine title + filename
    first_user = next((t for t in turns if t["role"] == "user"), None)
    title = (
        metadata.get("aiTitle")
        or (first_user["text"][:MAX_LEN] if first_user else "session")
    )
    slug      = slugify(title)
    creation  = (first_user or turns[0])["timestamp"]
    date_str  = creation.strftime("%Y-%m-%d_%H-%M") if creation else "unknown"
    filename  = f"{date_str}_{slug}.md"

    user_turns = [t for t in turns if t["role"] == "user"]

    lines: list[str] = []

    # ── Title ──
    lines.append(f"# {title}\n\n")

    # ── Metadata table ──
    lines.append("<table>\n")
    lines.append(f"<tr><td>📅 Date</td><td>{format_ts(creation)}</td></tr>\n")
    lines.append(f"<tr><td>🆔 Session ID</td><td>{metadata['sessionId']}</td></tr>\n")
    lines.append(f"<tr><td>🤖 Model</td><td>{metadata.get('model') or 'unknown'}</td></tr>\n")
    lines.append(f"<tr><td>🖥️ Entrypoint</td><td>{metadata.get('entrypoint') or 'unknown'}</td></tr>\n")
    lines.append(f"<tr><td>📁 Workspace</td><td>{metadata.get('cwd') or WS_ROOT}</td></tr>\n")
    lines.append(f"<tr><td>⚙️ Version</td><td>{metadata.get('version') or 'unknown'}</td></tr>\n")
    lines.append("</table>\n\n")

    # ── Table of Contents ──
    lines.append("## Table of Contents\n\n")
    for i, t in enumerate(user_turns, 1):
        preview = t["text"].replace("\n", " ")
        if len(preview) > MAX_LEN:
            preview = preview[: MAX_LEN - 3] + "..."
        lines.append(f"{i}. [{escape_html(preview)}](#prompt-{i})\n")
    lines.append("\n")

    # ── Body ──
    prompt_idx = 0
    for turn in turns:
        role = turn["role"]

        if role == "user":
            prompt_idx += 1
            lines.append(f'## <a name="prompt-{prompt_idx}"></a> 💬 Prompt {prompt_idx}\n\n')
            lines.append(f"🕒 {format_ts(turn['timestamp'])}\n\n")
            lines.append("### 👤 User\n\n")
            lines.append(escape_html(turn["text"]) + "\n\n")

        elif role == "assistant":
            lines.append("### 🤖 Assistant\n\n")

            # Thinking block (collapsed)
            if turn.get("thinking"):
                lines.append("<details>\n<summary>🧠 Thinking</summary>\n\n")
                lines.append(escape_html(turn["thinking"]) + "\n\n")
                lines.append("</details>\n\n")

            # Tool calls
            if turn["tools"]:
                lines.append("<details>\n<summary>🔧 Tool calls</summary>\n\n")
                for tl in turn["tools"]:
                    lines.append(f"- {escape_html(tl)}\n")
                lines.append("\n</details>\n\n")

            # Main response text
            if turn["text"]:
                lines.append(escape_html(turn["text"]) + "\n\n")

    return filename, "".join(lines)


# ------------------------------------------------
# Main
# ------------------------------------------------

def main() -> None:
    claude_dir   = get_claude_dir()
    project_dir  = find_project_dir(claude_dir)
    jsonl_files  = find_jsonl_files(project_dir)

    if not jsonl_files:
        print("No session files found.")
        return

    out_dir = WS_ROOT / DST_DIR
    out_dir.mkdir(exist_ok=True)

    exported = 0
    for file in jsonl_files:
        try:
            turns, metadata = parse_session(file)
        except Exception as e:
            print(f"  Skipped {file.name}: {e}")
            continue

        if not turns:
            print(f"  Skipped {file.name}: no turns")
            continue

        try:
            filename, content = render_session(turns, metadata)
        except Exception as e:
            print(f"  Skipped {file.name}: render error: {e}")
            continue

        out_path = out_dir / filename
        out_path.write_text(content, encoding="utf-8")
        print(f"  Exported: {out_path.name}")
        exported += 1

    print(f"\nDone. {exported}/{len(jsonl_files)} sessions exported to {out_dir}/")


if __name__ == "__main__":
    main()
