import { summarize } from './parser.js';

export const MAX_PAYLOAD_BYTES = 12000;

const limit = (value, max = 120) => String(value ?? '').slice(0, max);
const payloadBytes = payload => new TextEncoder().encode(JSON.stringify(payload)).length;

function compactDevice(device) {
  return {
    hostname: limit(device.hostname?.value, 80),
    vendor: limit(device.vendor?.value, 40),
    model: limit(device.model?.value, 60),
    status: device.status,
    ports: device.ports.slice(0, 80).map(port => ({ name: limit(port.name, 30), mode: port.mode, state: port.state, vlan: port.vlan, speed: port.speed })),
    vlans: device.vlans.slice(0, 128).map(vlan => ({ id: vlan.id, name: limit(vlan.name, 60), confidence: vlan.confidence })),
    controls: Object.fromEntries(Object.entries(device.settings).map(([key, setting]) => [key, setting.enabled])),
    warnings: device.warnings.slice(0, 12).map(warning => limit(warning)),
    unknownCount: device.unknown.length
  };
}

export function buildAnalysisPayload(devices, selected = null) {
  const stats = summarize(devices);
  const payload = {
    version: 1,
    scope: selected ? 'device' : 'summary',
    summary: stats,
    devices: selected ? [compactDevice(selected)] : devices.slice(0, 100).map(compactDevice),
    deviceCount: devices.length
  };
  while (payloadBytes(payload) > MAX_PAYLOAD_BYTES && payload.devices.length > 0) {
    payload.devices.pop();
    payload.truncated = true;
  }
  if (payloadBytes(payload) > MAX_PAYLOAD_BYTES) throw new Error('Нормализованный payload слишком большой');
  return payload;
}

export function getConfiguredEndpoint(documentRef = globalThis.document) {
  return globalThis.L2DCP_CONFIG?.llmEndpoint || documentRef?.documentElement?.dataset.llmEndpoint || '';
}

export function localAnalysis(payload) {
  const stats = payload.summary;
  if (payload.scope === 'device') {
    const device = payload.devices[0];
    return `Локальный demo-анализ\n\n${device.hostname}: ${device.vendor} ${device.model}.\n${device.ports.length} портов, ${device.vlans.length} VLAN.\nСостояние: ${device.status === 'healthy' ? 'без критических сигналов' : 'требует проверки'}.\nПредупреждения: ${device.warnings.length ? device.warnings.join('; ') : 'нет'}.`;
  }
  return `Локальный demo-анализ сводки\n\n${stats.devices} устройств, ${stats.ports} портов и ${stats.vlans} VLAN.\nHealthy: ${stats.healthy}; Attention: ${stats.attention}.\nИсходные конфигурации не передавались.`;
}

export async function analyzeWithLlm(payload, { endpoint = getConfiguredEndpoint(), fetchImpl = globalThis.fetch } = {}) {
  if (!endpoint) return { mode: 'local', text: localAnalysis(payload) };
  const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  const text = typeof result === 'string' ? result : result.text || result.analysis || result.answer;
  if (!text) throw new Error('Endpoint вернул пустой ответ');
  return { mode: 'remote', text: String(text) };
}
