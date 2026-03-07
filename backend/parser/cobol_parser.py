"""COBOL parser using regex-based extraction for PROCEDURE DIVISION paragraphs."""
import re
from pathlib import Path
from typing import List, Dict, Any
from utils.logger import logger


def parse_cobol_file(file_path: str, file_content: str) -> List[Dict[str, Any]]:
    """Parse a COBOL file and extract paragraph/section nodes with PERFORM/CALL relationships."""
    functions = []
    lines = file_content.split("\n")

    # Find PROCEDURE DIVISION
    proc_start = None
    for i, line in enumerate(lines):
        if re.search(r'PROCEDURE\s+DIVISION', line, re.IGNORECASE):
            proc_start = i
            break

    if proc_start is None:
        logger.warning(f"No PROCEDURE DIVISION found in {file_path}")
        return functions

    # Extract paragraphs/sections from PROCEDURE DIVISION onward
    current_para = None
    current_code_lines = []
    para_pattern = re.compile(r'^[\s]{0,6}(\w[\w-]*)\s*\.\s*$')
    section_pattern = re.compile(r'^[\s]{0,6}(\w[\w-]*)\s+SECTION\s*\.\s*$', re.IGNORECASE)

    for i in range(proc_start + 1, len(lines)):
        line = lines[i]
        raw_line = line

        # Check for section header
        sec_match = section_pattern.match(line)
        if sec_match:
            if current_para:
                code = "\n".join(current_code_lines)
                callees = _extract_cobol_calls(code)
                functions.append(_make_cobol_node(
                    file_path, current_para, code, callees
                ))
            current_para = sec_match.group(1)
            current_code_lines = [raw_line]
            continue

        # Check for paragraph header
        para_match = para_pattern.match(line)
        if para_match and not line.strip().startswith("*"):
            name = para_match.group(1)
            # Skip COBOL keywords that look like paragraphs
            if name.upper() in ("IF", "ELSE", "END-IF", "PERFORM", "MOVE", "ADD",
                                 "SUBTRACT", "MULTIPLY", "DIVIDE", "DISPLAY",
                                 "ACCEPT", "STOP", "GOBACK", "EXIT"):
                current_code_lines.append(raw_line)
                continue

            if current_para:
                code = "\n".join(current_code_lines)
                callees = _extract_cobol_calls(code)
                functions.append(_make_cobol_node(
                    file_path, current_para, code, callees
                ))
            current_para = name
            current_code_lines = [raw_line]
            continue

        if current_para:
            current_code_lines.append(raw_line)

    # Flush last paragraph
    if current_para:
        code = "\n".join(current_code_lines)
        callees = _extract_cobol_calls(code)
        functions.append(_make_cobol_node(file_path, current_para, code, callees))

    return functions


def _make_cobol_node(file_path: str, name: str, code: str, callees: List[str]) -> Dict[str, Any]:
    """Create a function node dict for a COBOL paragraph/section."""
    qualified = _normalize_cobol_name(name)
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


def _normalize_cobol_name(name: str) -> str:
    """Convert COBOL paragraph name to Python-friendly snake_case."""
    name = name.replace("-", "_").lower()
    return name


def _extract_cobol_calls(code: str) -> List[str]:
    """Extract PERFORM and CALL targets from COBOL code."""
    callees = []

    # PERFORM paragraph-name
    perform_pattern = re.compile(
        r'PERFORM\s+(\w[\w-]*)',
        re.IGNORECASE
    )
    for m in perform_pattern.finditer(code):
        target = m.group(1)
        if target.upper() not in ("UNTIL", "VARYING", "TIMES", "THRU", "THROUGH"):
            callees.append(_normalize_cobol_name(target))

    # CALL 'program-name' or CALL identifier
    call_pattern = re.compile(
        r"CALL\s+['\"]?(\w[\w-]*)['\"]?",
        re.IGNORECASE
    )
    for m in call_pattern.finditer(code):
        callees.append(_normalize_cobol_name(m.group(1)))

    return list(set(callees))
