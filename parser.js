const VENDOR_PATTERNS = [
  { id: 'snr', name: 'SNR', patterns: [/\bsnr\b/i, /snr-s/i, /snr-c/i] },
  { id: 'd-link', name: 'D-Link', patterns: [/d-link/i, /des-\d/i, /dxs-\d/i] },
  { id: 'fiberhome', name: 'FiberHome', patterns: [/fiberhome/i, /an5\d/i, /onu-profile/i] },
  { id: 'edgecore', name: 'Edgecore', patterns: [/edgecore/i, /ecs\d/i, /ecs-\d/i] },
  { id: 'eltex', name: 'Eltex', patterns: [/\beltex\b/i, /mes\d/i, /mes-\d/i] }
];

const unique = values => [...new Set(values.filter(Boolean))];
const confidence = (value, source = 'heuristic') => ({ value, confidence: value === 'unknown' ? 'unknown' : source });
const clean = value => String(value || '').replace(/^['"]|['"]$/g, '').trim();

export function detectVendor(text, filename = '') {
  const sample = `${filename}\n${text.slice(0, 8000)}`;
  const match = VENDOR_PATTERNS.find(v => v.patterns.some(pattern => pattern.test(sample)));
  return match ? match.name : 'Generic';
}

function extractHostname(lines, filename) {
  const patterns = [/^\s*(?:hostname|sysname)\s+([^\s#]+)/im, /^\s*set hostname\s+([^\s#]+)/im, /^\s*system name\s+([^\s#]+)/im];
  for (const pattern of patterns) { const match = textMatch(lines, pattern); if (match) return clean(match[1]); }
  return filename.replace(/\.(cfg|conf|txt)$/i, '').replace(/[_-]+/g, '-').slice(0, 80) || 'unnamed-device';
}
function textMatch(text, pattern) { const match = text.match(pattern); return match ? match : null; }

function parseVlans(text) {
  const vlans = [];
  for (const match of text.matchAll(/\b(?:vlan|vlan-id|vid)\s+([0-9]{1,4})(?:\s+name\s+([^\n#]+))?/ig)) vlans.push({ id: Number(match[1]), name: clean(match[2]) || null, confidence: 'heuristic' });
  for (const line of text.split(/\r?\n/).filter(item => /(?:allowed|add|tagged|untagged)/i.test(item))) {
    const payload = line.match(/(?:allowed|add|tagged|untagged)[^\d]*(.*)$/i)?.[1] || '';
    for (const token of payload.matchAll(/(\d{1,4})(?:-(\d{1,4}))?/g)) { const start = Number(token[1]); const end = Number(token[2] || start); if (start <= 4094 && end <= 4094) for (let id = start; id <= Math.min(end, start + 128); id++) vlans.push({ id, name: null, confidence: 'inferred' }); }
  }
  return vlans.filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).sort((a, b) => a.id - b.id);
}

function parsePorts(text) {
  const ports = []; let current = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const iface = line.match(/^\s*(?:interface\s+ethernet|interface|port)\s+([^\s#]+)/i);
    if (iface) { current = { name: clean(iface[1]), state: 'unknown', mode: 'unknown', speed: null, vlan: null, confidence: 'heuristic' }; ports.push(current); continue; }
    if (!current) continue;
    if (/^\s*no\s+shutdown\s*$/i.test(line)) current.state = 'up'; else if (/^\s*(?:shutdown|disable)\s*$/i.test(line)) current.state = 'down';
    if (/^\s*(?:switchport\s+)?(?:mode\s+)?(?:trunk|tagged|hybrid)(?:\s|$)/i.test(line)) current.mode = 'trunk'; else if (/^\s*(?:switchport\s+)?(?:mode\s+)?(?:access|untagged)(?:\s|$)/i.test(line)) current.mode = 'access';
    const vlan = line.match(/(?:switchport\s+)?(?:access|untagged|pvid|native|default)\D+(\d{1,4})/i); if (vlan) current.vlan = Number(vlan[1]);
    const speed = line.match(/(?:speed|bandwidth)\s+(\d+(?:\.\d+)?)\s*(g|m)?/i); if (speed) current.speed = `${speed[1]}${speed[2] || 'M'}`;
  }
  return ports;
}

function extractSettings(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const find = (patterns, label) => { const found = lines.filter(line => patterns.some(pattern => pattern.test(line))); return { label, enabled: found.length > 0, entries: found.slice(0, 20), confidence: found.length ? 'heuristic' : 'unknown' }; };
  return {
    stormControl: find([/storm-control|broadcast-suppression|storm control/i], 'Storm control'),
    isolation: find([/port-isolation|protected-port|isolate-port/i], 'Port isolation'),
    stp: find([/\bstp\b|spanning-tree|spanning tree/i], 'STP / MSTP'),
    acl: find([/\bacl\b|access-list|traffic-filter/i], 'ACL'),
    poe: find([/\bpoe\b|power inline/i], 'PoE')
  };
}

function unknownDirectives(text, ports, vlans) {
  const known = /^(hostname|sysname|interface|port|vlan|description|switchport|spanning-tree|stp|storm-control|broadcast-suppression|poe|power|acl|access-list|traffic-filter|ip|ipv6|exit|end|!|#|version|configure|enable|no |undo |username|line |snmp|logging|ntp|interface ethernet)/i;
  return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !known.test(line) && !/^[-=]+$/.test(line) && /[a-z]/i.test(line)).filter((line, i, all) => all.indexOf(line) === i).slice(0, 30);
}

export function parseConfig({ name = 'config.cfg', text = '' }) {
  const vendor = detectVendor(text, name); const ports = parsePorts(text); const vlans = parseVlans(text); const settings = extractSettings(text);
  const hostname = extractHostname(text, name); const warnings = []; if (vendor === 'Generic') warnings.push('Вендор не определён уверенно'); if (!ports.length) warnings.push('Интерфейсы не распознаны'); if (!vlans.length) warnings.push('VLAN не найдены');
  const attention = Object.values(settings).filter(setting => setting.enabled).length + warnings.length;
  return { id: `${name}-${text.length}`, source: name, hostname: confidence(hostname), vendor: confidence(vendor, vendor === 'Generic' ? 'unknown' : 'heuristic'), model: confidence((text.match(/(?:model|product|hardware)\s*[:=]?\s*([^\s#]+)/i) || [])[1] || 'unknown', 'heuristic'), ports, vlans, settings, unknown: unknownDirectives(text, ports, vlans), warnings, status: attention ? 'attention' : 'healthy', parsedAt: new Date().toISOString(), bytes: text.length };
}

export function summarize(devices) {
  const vlanIds = unique(devices.flatMap(device => device.vlans.map(vlan => vlan.id)));
  return { devices: devices.length, healthy: devices.filter(device => device.status === 'healthy').length, attention: devices.filter(device => device.status === 'attention').length, vlans: vlanIds.length, ports: devices.reduce((sum, device) => sum + device.ports.length, 0) };
}

export function toCsv(devices) {
  const columns = ['source', 'hostname', 'vendor', 'model', 'status', 'ports', 'vlans', 'stormControl', 'isolation', 'stp', 'acl', 'poe', 'warnings'];
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = devices.map(device => [device.source, device.hostname.value, device.vendor.value, device.model.value, device.status, device.ports.length, device.vlans.map(v => v.id).join('|'), ...Object.values(device.settings).map(setting => setting.enabled ? 'enabled' : 'not found'), device.warnings.join('|')]);
  return [columns, ...rows].map(row => row.map(quote).join(',')).join('\n');
}
