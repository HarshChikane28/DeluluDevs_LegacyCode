"""
Context Optimization: Comment Filter

Key technique for reducing LLM hallucinations by stripping noisy/misleading 
comments and dead code before feeding functions to the LLM.

Rules:
  KEEP:    Reasoning language (because, since, avoid, workaround, O(, trade-off)
  STRIP:   Boilerplate (auto-generated, TODO/FIXME, @param/@return, "Created by")
  STRIP:   Commented-out code (assignments, function calls, control-flow keywords)
  STRIP:   Trivial "what" comments (≤3 words: "loop", "get X", "set X")
  DEFAULT: Keep
"""
import re
from typing import Tuple, List
from utils.logger import log_filtering_report


# Patterns for reasoning comments (KEEP these)
REASONING_PATTERNS = re.compile(
    r'\b(because|since|avoid|per\b|workaround|due\s+to|intentional|O\(|'
    r'trade-?off|constraint|assumption|invariant|precondition|'
    r'edge\s+case|corner\s+case|important|must|required|ensure|'
    r'backwards?\s+compat|legacy|deprecated\s+but|migration|'
    r'performance|optimization|complexity|thread-?safe|concurrent|'
    r'security|sanitiz|validat|boundary)\b',
    re.IGNORECASE
)

# Patterns for boilerplate comments (STRIP these)
BOILERPLATE_PATTERNS = re.compile(
    r'(auto[- ]?generated|do not (edit|modify)|machine generated|'
    r'@author|@version|@date|@copyright|@license|'
    r'created by .+ on \d|copyright \(c\)|all rights reserved|'
    r'TODO|FIXME|HACK|XXX|NOSONAR|'
    r'@param\s+\w|@return\s|@throws\s|@exception\s|@see\s|@since\s|'
    r'@deprecated\s|@override|@suppress|'
    r'^\s*\*\s*$|^\s*\*\s*<p>|^\s*\*\s*</)',
    re.IGNORECASE
)

# Patterns suggesting commented-out code (STRIP these)
CODE_COMMENT_PATTERNS = re.compile(
    r'(=\s*\w|;\s*$|\w+\.\w+\(|\w+\(.*\)|'
    r'\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\breturn\s+\w|'
    r'\bint\s+\w|\bString\s+\w|\bboolean\s+\w|'
    r'System\.out|println|printf|'
    r'\bimport\s+\w|\bpackage\s+\w)',
    re.IGNORECASE
)

# Trivial "what" comments (STRIP these)
TRIVIAL_PATTERNS = re.compile(
    r'^\s*(//|#|\*|/\*)\s*(loop|get\s+\w+|set\s+\w+|increment|decrement|'
    r'initialize|init|constructor|destructor|getter|setter|'
    r'add|remove|delete|update|insert|create|close|open|start|stop|end)\s*$',
    re.IGNORECASE
)


def filter_comments(code: str, language: str, func_id: str = "") -> Tuple[str, dict]:
    """
    Filter comments from source code, keeping only semantically meaningful ones.
    
    Args:
        code: Source function code
        language: "java" or "cobol"
        func_id: Function identifier for logging
    
    Returns:
        (filtered_code, report) - Filtered code and a report of what was kept/stripped
    """
    if language == "cobol":
        return _filter_cobol_comments(code, func_id)
    else:
        return _filter_java_comments(code, func_id)


def _filter_java_comments(code: str, func_id: str) -> Tuple[str, dict]:
    """Filter Java comments (// and /* */ and /** */)."""
    lines = code.split("\n")
    filtered_lines = []
    kept_comments = []
    stripped_comments = []
    in_block_comment = False
    block_comment_lines = []

    for line in lines:
        stripped = line.strip()

        # Handle block comments
        if in_block_comment:
            block_comment_lines.append(stripped)
            if "*/" in stripped:
                in_block_comment = False
                block_text = " ".join(block_comment_lines)
                decision = _classify_comment(block_text)
                if decision == "keep":
                    filtered_lines.extend(
                        ["  " + bl for bl in block_comment_lines]
                    )
                    kept_comments.append(block_text[:80])
                else:
                    stripped_comments.append(block_text[:80])
                block_comment_lines = []
            continue

        if stripped.startswith("/*"):
            in_block_comment = True
            block_comment_lines = [stripped]
            if "*/" in stripped[2:]:
                in_block_comment = False
                block_text = stripped
                decision = _classify_comment(block_text)
                if decision == "keep":
                    filtered_lines.append(line)
                    kept_comments.append(block_text[:80])
                else:
                    stripped_comments.append(block_text[:80])
                block_comment_lines = []
            continue

        # Handle single-line comments
        if stripped.startswith("//"):
            comment_text = stripped[2:].strip()
            decision = _classify_comment(comment_text)
            if decision == "keep":
                filtered_lines.append(line)
                kept_comments.append(comment_text[:80])
            else:
                stripped_comments.append(comment_text[:80])
            continue

        # Handle inline comments
        if "//" in line and not line.strip().startswith("//"):
            code_part, comment_part = line.split("//", 1)
            comment_text = comment_part.strip()
            decision = _classify_comment(comment_text)
            if decision == "keep":
                filtered_lines.append(line)
                kept_comments.append(comment_text[:80])
            else:
                filtered_lines.append(code_part.rstrip())
                stripped_comments.append(comment_text[:80])
            continue

        # Non-comment line: always keep
        filtered_lines.append(line)

    # Log the filtering report
    if func_id:
        log_filtering_report(func_id, kept_comments, stripped_comments)

    report = {
        "kept": len(kept_comments),
        "stripped": len(stripped_comments),
        "kept_samples": kept_comments[:3],
        "stripped_samples": stripped_comments[:3],
    }

    return "\n".join(filtered_lines), report


def _filter_cobol_comments(code: str, func_id: str) -> Tuple[str, dict]:
    """Filter COBOL comments (column 7 asterisk and *> inline)."""
    lines = code.split("\n")
    filtered_lines = []
    kept_comments = []
    stripped_comments = []

    for line in lines:
        # COBOL comment: asterisk in column 7 (index 6)
        is_comment = False
        if len(line) > 6 and line[6] == "*":
            is_comment = True
            comment_text = line[7:].strip()
        elif "*>" in line:
            # Inline comment
            parts = line.split("*>", 1)
            comment_text = parts[1].strip() if len(parts) > 1 else ""
            if comment_text:
                decision = _classify_comment(comment_text)
                if decision == "keep":
                    filtered_lines.append(line)
                    kept_comments.append(comment_text[:80])
                else:
                    filtered_lines.append(parts[0].rstrip())
                    stripped_comments.append(comment_text[:80])
                continue
            else:
                filtered_lines.append(line)
                continue

        if is_comment:
            decision = _classify_comment(comment_text)
            if decision == "keep":
                filtered_lines.append(line)
                kept_comments.append(comment_text[:80])
            else:
                stripped_comments.append(comment_text[:80])
            continue

        # Non-comment line
        filtered_lines.append(line)

    if func_id:
        log_filtering_report(func_id, kept_comments, stripped_comments)

    report = {
        "kept": len(kept_comments),
        "stripped": len(stripped_comments),
        "kept_samples": kept_comments[:3],
        "stripped_samples": stripped_comments[:3],
    }

    return "\n".join(filtered_lines), report


def _classify_comment(text: str) -> str:
    """
    Classify a comment as 'keep' or 'strip'.
    
    Priority:
      1. KEEP if reasoning language detected
      2. STRIP if boilerplate detected
      3. STRIP if looks like commented-out code
      4. STRIP if trivial (≤3 words)
      5. DEFAULT: keep
    """
    if not text or not text.strip():
        return "strip"

    clean = text.strip().lstrip("/*").lstrip("*").strip()
    if not clean:
        return "strip"

    # Rule 1: Keep reasoning comments
    if REASONING_PATTERNS.search(clean):
        return "keep"

    # Rule 2: Strip boilerplate
    if BOILERPLATE_PATTERNS.search(clean):
        return "strip"

    # Rule 3: Strip commented-out code
    if CODE_COMMENT_PATTERNS.search(clean):
        return "strip"

    # Rule 4: Strip trivial comments (≤3 words)
    words = clean.split()
    if len(words) <= 3:
        if TRIVIAL_PATTERNS.search(f"// {clean}"):
            return "strip"
        # Still strip very short generic comments
        trivial_words = {"loop", "end", "start", "begin", "done", "next",
                         "continue", "break", "else", "default", "case"}
        if len(words) == 1 and words[0].lower() in trivial_words:
            return "strip"

    # Default: keep
    return "keep"
