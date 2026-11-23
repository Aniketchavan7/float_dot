# Code request regression — 9 October 2026

User report: after attaching a LeetCode screenshot and requesting code, the response explained Remove Outermost Parentheses using Answer/Screen evidence/Next step without an implementation. The cited decomposition was also wrong: `(()())(())` decomposes into `(()())` and `(())`.

## Implemented

- Explicit code/solution requests now take precedence in general, DSA and debug modes. Previously the solution branch was reachable only in DSA mode. Short requests such as “code” and “give code” are recognized; “explain this code” remains an explanation, and “without code” stays prose-only.
- Code policy requires a fenced runnable implementation, the requested or visible editor language, and the problem's starter signature. If no language is identifiable, it states a Python 3 assumption instead of refusing to supply code solely over language choice.
- Main question-box submissions can reuse the already attached screenshot when the now-explicit attachment checkbox is checked. They still never trigger a new screenshot. Uncheck it to send text-only chat.
- Explanation-only responses to a code request are marked incomplete with a recovery error and excluded from conversation memory. No automatic second provider call is added. Detecting a code block is not correctness certification.

## Evidence

94 automated tests passed; Electron smoke passed. The actual “give code” UI request preserves attached evidence with zero capture calls. Plain chat with attachment disabled sends no image/evidence. Capture remains button/shortcut-only.

A live local qwen3:1.7b request using a synthetic text version of this problem now returned a JavaScript code block. Manual review found an algorithm error, and executing that reviewed snippet failed all three sample/edge checks, including returning `()()` instead of `()()()` for the reported input. Saved locally as `.artifacts/parentheses-code-answer.json` and `.artifacts/parentheses-code-validation.json`. No arbitrary generated code is executed by the application.

The independently written depth-counter reference in `tests/code-request.test.cjs` passes samples and all balanced inputs through six pairs against a separate primitive-splitting oracle. This verifies the reference, not the model's output. General model correctness remains an open M05 gate; do not label a formatted solution “verified.”

A separate local experiment enabling reasoning on the same model reached the existing output-token limit without a completed answer. User settings were not changed. Neither experiment justifies claiming model correctness has been fixed. The updated application package built successfully.
