function assessCitations(answer, sources) {
  // Code array indices are not citations.
  const prose = answer.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
  const cited = [...prose.matchAll(/\[(\d+)\]/g)].map(match => Number(match[1]));
  const known = new Set(sources.map(source => source.id));
  const unknown = [...new Set(cited.filter(id => !known.has(id)))];
  const warnings = [];
  if (sources.length && !cited.some(id => known.has(id))) warnings.push('Web references were retrieved, but the answer does not cite them. Its claims are not verified.');
  if (unknown.length) warnings.push(`Unrecognized source citations: ${unknown.map(id=>`[${id}]`).join(', ')}. These references were not retrieved.`);
  return warnings;
}
module.exports = {assessCitations};
