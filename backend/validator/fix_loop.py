"""LLM-guided compilation fix loop (up to 3 attempts)."""
import json
import re
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Callable
from .compile_runner import compile_translated_files, compile_single_file
from translator.llm_client import LLMClient
from translator.prompt_builder import build_fix_prompt
from utils.logger import logger, log_compiler_error


async def run_fix_loop(
    translated_dir: str,
    llm_client: LLMClient,
    max_attempts: int = 3,
    progress_callback: Optional[Callable] = None,
) -> Tuple[str, List[Dict]]:
    """
    Run compile → fix → recompile loop up to max_attempts times.
    
    Returns:
        (status, remaining_errors) - "success", "partial", or "fail"
    """
    for attempt in range(1, max_attempts + 1):
        all_passed, errors = compile_translated_files(translated_dir)

        if all_passed:
            if progress_callback:
                await progress_callback(
                    "compiling", 1.0,
                    f"✓ All files compiled successfully!",
                    {"status": "success", "attempt": attempt},
                )
            return "success", []

        if progress_callback:
            await progress_callback(
                "fixing",
                attempt / max_attempts,
                f"Attempt {attempt}/{max_attempts}: Fixing {len(errors)} compile error(s)...",
                {"status": "fixing", "attempt": attempt, "error_count": len(errors)},
            )

        # Try to fix each error
        fixed_count = 0
        for err in errors:
            file_path = str(Path(translated_dir) / err["file"])
            error_text = err["error"]

            try:
                prompt = build_fix_prompt(err["file"], error_text)
                response = await llm_client.complete(prompt)

                # Parse JSON response
                clean = response.strip()
                # Remove markdown fences if present
                if clean.startswith("```"):
                    clean = re.sub(r"^```\w*\n?", "", clean)
                    clean = re.sub(r"\n?```$", "", clean)

                patch_data = json.loads(clean)

                if "missing" in patch_data:
                    logger.info(f"Missing symbols reported for {err['file']}: {patch_data['missing']}")
                    continue

                if "patches" in patch_data:
                    file_content = Path(file_path).read_text()
                    for patch in patch_data["patches"]:
                        find_text = patch.get("find", "")
                        replace_text = patch.get("replace", "")
                        if find_text and find_text in file_content:
                            file_content = file_content.replace(find_text, replace_text, 1)
                            fixed_count += 1

                    Path(file_path).write_text(file_content)

                    # Verify fix
                    ok, new_err = compile_single_file(file_path)
                    if ok:
                        if progress_callback:
                            await progress_callback(
                                "fixing",
                                attempt / max_attempts,
                                f"  ✓ Fixed {err['file']}",
                                {"file": err["file"], "fixed": True},
                            )
                    else:
                        log_compiler_error(file_path, new_err, attempt)

            except json.JSONDecodeError:
                logger.warning(f"LLM returned non-JSON response for fix of {err['file']}")
            except Exception as e:
                logger.error(f"Fix attempt failed for {err['file']}: {e}")

    # Final check
    all_passed, remaining = compile_translated_files(translated_dir)
    status = "success" if all_passed else ("partial" if len(remaining) < len(errors) else "fail")
    return status, remaining
