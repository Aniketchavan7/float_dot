const { answerPolicy } = require('./prompts');
function normalizeAnswer(value) {
  let answer = value.trim();
  const wrapped = answer.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```$/i);
  if (wrapped) answer = wrapped[1].trim();
  let fenced = false;
  const processed = answer.split('\n').map(line => {
    if (/^\s*```/.test(line)) { fenced = !fenced; return line; }
    if (fenced) return line;
    const inlineHeading = line.match(/^#{1,3}\s+(Hint|Answer|Screen evidence|Next step|Observed|Likely cause|Next check)[.:]\s+(.+)$/i);
    if (inlineHeading) return `### ${inlineHeading[1]}\n${inlineHeading[2]}`;
    const match = line.match(/^(?:\*\*)?(Answer|Screen evidence|Next step|Observed|Likely cause|Next check|Hint|Approach|Solution|Complexity|Edge cases)(?:\*\*)?\s*:\s*(.*)$/i);
    return match ? `### ${match[1]}${match[2] ? `\n${match[2]}` : ''}` : line;
  }).join('\n');

  // Strip conversational preamble before first section heading if present
  const firstHeadingIdx = processed.search(/^###\s+(Answer|Hint|Observed|Key Decisions|Approach)/m);
  if (firstHeadingIdx > 0) {
    const before = processed.slice(0, firstHeadingIdx);
    if (!before.includes('```')) {
      return processed.slice(firstHeadingIdx).trim();
    }
  }
  return processed;
}
function assessAnswer({ answer, mode, question, hintLevel = 0 }) {
  const policy = answerPolicy(mode, question, hintLevel);
  const issues = [];
  const headings = [...answer.matchAll(/^#{1,3}\s+(.+?)\s*$/gm)].map(match => match[1].toLowerCase());
  if (!policy.headings.every(heading => headings.includes(heading.toLowerCase()))) issues.push('The model did not follow the requested section format.');
  const words = answer.replace(/^#{1,3}.*$/gm, '').trim().split(/\s+/).filter(Boolean).length;
  const hintViolation = policy.hintOnly && (/```/.test(answer) || words > 45 || headings.some(h => h !== 'hint'));
  if (hintViolation) issues.push('The model gave more than one short hint.');
  if (/<\/?think>|\b(let me think|the user (?:wants|asks)|we need to (?:answer|respond))\b/i.test(answer)) issues.push('The model returned analysis instead of a clean final answer.');
  return { issues, hintViolation, structured: issues.length === 0, words };
}
module.exports = { normalizeAnswer, assessAnswer };
