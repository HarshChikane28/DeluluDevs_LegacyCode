"""COBOL parser — supports both fixed-format (sequence numbers) and free-format files."""
import re
from typing import List, Dict, Any
from utils.logger import logger

# COBOL reserved words that look like paragraph names but aren't
_COBOL_KEYWORDS = {
    "IF", "ELSE", "END-IF", "PERFORM", "MOVE", "ADD", "SUBTRACT", "MULTIPLY",
    "DIVIDE", "DISPLAY", "ACCEPT", "STOP", "GOBACK", "EXIT", "CALL", "COMPUTE",
    "EVALUATE", "WHEN", "END-EVALUATE", "READ", "WRITE", "OPEN", "CLOSE",
    "END-READ", "END-CALL", "END-PERFORM", "STRING", "UNSTRING", "INSPECT",
    "INITIALIZE", "SET", "SEARCH", "SORT", "MERGE", "RELEASE", "RETURN",
    "NOT", "AND", "OR", "TO", "FROM", "BY", "GIVING", "INTO", "USING",
    "VARYING", "UNTIL", "TIMES", "THRU", "THROUGH", "WITH", "ON", "SIZE",
    "ERROR", "OVERFLOW", "INVALID", "KEY", "AT", "END", "NEXT", "SENTENCE",
}

# Paragraph name pattern: word chars and hyphens, ending with a period
_PARA_PATTERN = re.compile(r'^([\w][\w-]*)\s*\.\s*$', re.IGNORECASE)
_SECTION_PATTERN = re.compile(r'^([\w][\w-]*)\s+SECTION\s*\.', re.IGNORECASE)


def parse_cobol_file(file_path: str, file_content: str) -> List[Dict[str, Any]]:
    """Parse a COBOL file and extract paragraph/section nodes."""
    raw_lines = file_content.split("\n")

    # Detect and normalise fixed-format COBOL (strip cols 1-6 + indicator col 7)
    fixed = _is_fixed_format(raw_lines)
    norm_lines = [_normalise_line(l, fixed) for l in raw_lines]

    # Locate PROCEDURE DIVISION
    proc_start = None
    for i, line in enumerate(norm_lines):
        if re.search(r'PROCEDURE\s+DIVISION', line, re.IGNORECASE):
            proc_start = i
            break

    if proc_start is None:
        logger.warning(f"No PROCEDURE DIVISION found in {file_path}")
        return []

    functions = []
    current_para = None
    current_code = []

    for i in range(proc_start + 1, len(norm_lines)):
        norm = norm_lines[i]
        raw = raw_lines[i]
        stripped = norm.strip()

        # Skip blank / comment lines (keep them in current paragraph body though)
        if not stripped or stripped.startswith("*"):
            if current_para is not None:
                current_code.append(raw)
            continue

        # --- Section header? ---
        sec_m = _SECTION_PATTERN.match(stripped)
        if sec_m and sec_m.group(1).upper() not in _COBOL_KEYWORDS:
            _flush(functions, file_path, current_para, current_code)
            current_para = sec_m.group(1)
            current_code = [raw]
            continue

        # --- Paragraph header?
        # Must NOT be indented into Area B (≥ 4 spaces relative to Area A).
        # After fixed-format stripping, Area A content starts at col 0;
        # free-format paragraph names are typically ≤ 8 spaces in.
        indent = len(norm) - len(norm.lstrip())
        if indent <= 8:
            para_m = _PARA_PATTERN.match(stripped)
            if para_m:
                name = para_m.group(1)
                if name.upper() not in _COBOL_KEYWORDS:
                    _flush(functions, file_path, current_para, current_code)
                    current_para = name
                    current_code = [raw]
                    continue

        if current_para is not None:
            current_code.append(raw)

    # Flush last paragraph
    _flush(functions, file_path, current_para, current_code)

    if not functions:
        logger.warning(f"No paragraphs extracted from {file_path} "
                       f"({'fixed' if fixed else 'free'}-format)")
    else:
        logger.info(f"Parsed {file_path}: {len(functions)} paragraphs "
                    f"({'fixed' if fixed else 'free'}-format)")

    return functions


# ── helpers ───────────────────────────────────────────────────────────────────

def _flush(functions, file_path, para_name, code_lines):
    """Save the current paragraph if it has content."""
    if para_name is None:
        return
    code = "\n".join(code_lines)
    callees = _extract_cobol_calls(code)
    functions.append(_make_cobol_node(file_path, para_name, code, callees))


def _is_fixed_format(lines: list) -> bool:
    """Return True if the file uses fixed-format COBOL (sequence numbers in cols 1-6)."""
    hits = 0
    for line in lines[:40]:
        if len(line) >= 7 and line[:6].strip().isdigit() and line[:6].strip() != "":
            hits += 1
    return hits >= 3


def _normalise_line(line: str, fixed: bool) -> str:
    """Strip fixed-format overhead (sequence + indicator columns) if applicable."""
    if not fixed or len(line) < 7:
        return line
    prefix = line[:6]
    if prefix.replace(" ", "").isdigit():
        indicator = line[6]
        rest = line[7:] if len(line) > 7 else ""
        if indicator == "*":
            return "* " + rest      # preserve comment marker
        return rest                  # normal code line — drop seq num + indicator
    return line


def _make_cobol_node(file_path: str, name: str, code: str,
                     callees: List[str]) -> Dict[str, Any]:
    qualified = _to_snake(name)
    return {
        "id": f"{file_path}::{qualified}",
        "language": "cobol",
        "file": file_path,
        "qualified_name": qualified,
        "params": [],
        "return_type": None,
        "code": code,
        "callees": callees,
        "called_by": [],
        "status": "untranslated",
        "translated_code": None,
        "notes": "",
    }


def _to_snake(name: str) -> str:
    return name.replace("-", "_").lower()


def _extract_cobol_calls(code: str) -> List[str]:
    """Extract PERFORM and CALL targets from COBOL paragraph code."""
    callees = []
    _SKIP = {"UNTIL", "VARYING", "TIMES", "THRU", "THROUGH"}

    for m in re.finditer(r'PERFORM\s+([\w][\w-]*)', code, re.IGNORECASE):
        if m.group(1).upper() not in _SKIP:
            callees.append(_to_snake(m.group(1)))

    for m in re.finditer(r"CALL\s+['\"]?([\w][\w-]*)['\"]?", code, re.IGNORECASE):
        callees.append(_to_snake(m.group(1)))

    return list(set(callees))
