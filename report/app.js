import { readReport } from './report-data.js';

const element = id => document.getElementById(id);
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const ms = value => `${value.toFixed(value < 1 ? 3 : 2)} ms`;

function create(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

const tabs = [element('comparison-tab'), element('sql-tab')];
function showTab(current) {
  for (const tab of tabs) {
    const active = tab === current;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    element(tab.getAttribute('aria-controls')).hidden = !active;
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => showTab(tab));
  tab.addEventListener('keydown', event => {
    const targets = { Home: tabs[0], End: tabs.at(-1), ArrowRight: tabs.find(other => other !== tab), ArrowLeft: tabs.find(other => other !== tab) };
    const target = targets[event.key];
    if (target) {
      event.preventDefault();
      showTab(target);
      target.focus();
    }
  });
}

function renderPlan(target, root) {
  const details = create('div', undefined, 'operator');
  let selected;
  function inspect(node, button) {
    selected?.setAttribute('aria-pressed', 'false');
    selected = button;
    button.setAttribute('aria-pressed', 'true');
    const fields = [
      ['Output rows per loop', node['Actual Rows']],
      ['Loops', node['Actual Loops']],
      ['Relation', node['Relation Name']],
      ['Index', node['Index Name']],
      ['Rows removed by filter', node['Rows Removed by Filter']],
      ['Shared blocks hit', node['Shared Hit Blocks']],
      ['Shared blocks read', node['Shared Read Blocks']],
      ['Sort key', node['Sort Key']?.join(', ')]
    ];
    const list = create('dl');
    for (const [label, value] of fields) {
      if (value === undefined) continue;
      const row = create('div');
      row.append(create('dt', label), create('dd', typeof value === 'number' ? number.format(value) : value));
      list.append(row);
    }
    details.replaceChildren(create('h4', node['Node Type']), list);
  }
  let defaultOperator;
  function makeTree(nodes) {
    const list = create('ul', undefined, 'nodes');
    for (const node of nodes) {
      const row = create('li');
      const button = create('button', node['Node Type']);
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => inspect(node, button));
      row.append(button);
      if (node['Relation Name']) defaultOperator = [node, button];
      if (!defaultOperator) defaultOperator = [node, button];
      if (node.Plans?.length) row.append(makeTree(node.Plans));
      list.append(row);
    }
    return list;
  }
  const tree = create('div', undefined, 'tree');
  tree.append(makeTree([root]));
  target.append(tree, details);
  inspect(...defaultOperator);
}

function render(data) {
  const { baseline, candidate } = data;
  const baselineMs = baseline.medianMs;
  const candidateMs = candidate.medianMs;
  const largest = Math.max(baselineMs, candidateMs);
  const order = 10 ** Math.floor(Math.log10(largest || 1));
  const max = Math.ceil((largest || 1) / order) * order;
  for (const [key, side] of [['base', baseline], ['candidate', candidate]]) {
    element(`${key}-bar`).max = max;
    element(`${key}-bar`).value = side.medianMs;
    element(`${key}-time`).textContent = ms(side.medianMs);
    const range = `${ms(Math.min(...side.samples))}–${ms(Math.max(...side.samples))}`;
    element(`${key}-samples`).textContent = `Range ${range}\n${side.samples.map(ms).join('   /   ')}`;
    renderPlan(element(`${key}-tree`), side.plan);
  }
  element('ticks').replaceChildren(...[0, max / 2, max].map(value =>
    create('span', value === 0 ? '0' : `${Number(value.toPrecision(3))}${value === max ? ' ms' : ''}`)
  ));
  const slower = candidateMs > baselineMs;
  const verdict = element('verdict');
  verdict.textContent = slower ? 'Candidate slower in this run' : 'No slowdown in this run';
  verdict.classList.toggle('neutral', !slower);
  verdict.hidden = false;
  const delta = element('delta');
  delta.textContent = `${slower ? '+' : candidateMs === baselineMs ? '' : '−'}${ms(Math.abs(candidateMs - baselineMs))}`;
  delta.classList.toggle('neutral', !slower);
  element('fixture').textContent = `${number.format(data.fixtureRows)} orders`;
  element('parity').textContent = `${number.format(data.resultRows)} rows matched`;
  element('engine').textContent = data.engine;
  element('query').textContent = data.query;
  element('change').textContent = data.change || 'No additional migration.';
  if (data.revisions) {
    element('description').textContent = 'Recent orders for one customer, compared across two revisions of the same database fixture.';
    element('base-label').textContent = data.revisions.base.slice(0, 7);
    element('candidate-label').textContent = data.revisions.head.slice(0, 7);
    element('base-migration').textContent = data.baselineMigration || 'No additional migration.';
    element('base-migration-panel').hidden = false;
  }
  const mode = data.engine.includes('PGlite') ? 'embedded PostgreSQL' : 'native PostgreSQL';
  element('method').textContent = `Both databases use the same synthetic fixture. After one warmup per side, the runner alternates measurement order across five pairs. Values are execution times reported by ${mode}. Network and application latency are outside this measurement.`;
  element('footer-engine').textContent = `Synthetic benchmark · ${data.engine}`;
  if (data.runner) {
    element('provenance').textContent = ` · ${data.runner} · Fixture ${data.fixtureHash.slice(0, 12)}`;
  }
  element('captured').dateTime = data.capturedAt;
  element('captured').textContent = new Date(data.capturedAt).toLocaleString();
}

try {
  render(await readReport(await fetch('./data.json')));
  element('loading').hidden = true;
  element('report').hidden = false;
} catch {
  element('loading').textContent = 'Could not load a valid benchmark report. Check data.json or generate a fresh report.';
}
