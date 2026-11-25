const maxBytes = 512 * 1024;
const maxPlanDepth = 24;
const maxPlanNodes = 256;
const measurements = ['Actual Rows', 'Actual Loops', 'Rows Removed by Filter',
  'Shared Hit Blocks', 'Shared Read Blocks'];
const label = value => typeof value === 'string' && value.length <= 512;
const text = value => typeof value === 'string' && value.length <= 128 * 1024;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const number = value => Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
const time = value => number(value) && value <= 600_000;
const hash = (value, length) => typeof value === 'string'
  && value.length === length && /^[a-f0-9]+$/.test(value);

function validPlan(root) {
  let nodes = 0;
  function visit(node, depth) {
    if (++nodes > maxPlanNodes || depth > maxPlanDepth || !object(node)
      || !label(node['Node Type']) || !node['Node Type'].length) return false;
    if (!measurements.every(key => node[key] === undefined || number(node[key]))) return false;
    if (!['Relation Name', 'Index Name'].every(key => node[key] === undefined || label(node[key]))) return false;
    const sort = node['Sort Key'];
    if (sort !== undefined && (!Array.isArray(sort) || sort.length > 64 || !sort.every(label))) return false;
    const children = node.Plans;
    return children === undefined || (Array.isArray(children) && children.length < maxPlanNodes
      && children.every(child => visit(child, depth + 1)));
  }
  return visit(root, 1);
}

function validSide(side) {
  return object(side) && time(side.medianMs) && Array.isArray(side.samples)
    && side.samples.length === 5 && side.samples.every(time) && validPlan(side.plan);
}

export async function readReport(response) {
  if (!response.ok || !response.body) throw new Error('Report unavailable.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let json = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error('Report exceeds the size limit.');
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }

  const data = JSON.parse(json);
  if (!object(data) || data.version !== 1 || !label(data.engine)
    || !label(data.capturedAt) || !Number.isFinite(Date.parse(data.capturedAt))
    || !count(data.fixtureRows) || !count(data.resultRows) || data.resultRows > data.fixtureRows
    || !text(data.query) || !text(data.change)
    || (data.runner !== undefined && (!label(data.runner) || !hash(data.fixtureHash, 64)))
    || (data.revisions !== undefined && (!object(data.revisions)
      || !hash(data.revisions.base, 40) || !hash(data.revisions.head, 40)))
    || (data.baselineMigration !== undefined && !text(data.baselineMigration))
    || !validSide(data.baseline) || !validSide(data.candidate)) {
    throw new Error('Invalid benchmark report.');
  }
  return data;
}
