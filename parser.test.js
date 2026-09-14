import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { detectVendor, parseConfig, summarize, toCsv } from './parser.js';
import { createDemoConfigs, createDemoDevices, demoVendors } from './demo-configs.js';
import { analyzeWithLlm, buildAnalysisPayload, MAX_PAYLOAD_BYTES } from './llm-adapter.js';
import { getPageCount, paginate } from './pagination.js';

const sample = `! SNR configuration
hostname ekb-snr-01
interface ethernet 1/0/1
 no shutdown
 switchport mode access
 switchport access vlan 100
interface ethernet 1/0/2
 shutdown
 switchport mode trunk
 switchport trunk allowed vlan 100,200
vlan 100 name customers
spanning-tree mode mstp
storm-control broadcast 2
port-isolation enable
access-list 10 permit 10.0.0.0/8
`;

test('detects vendor and normalizes core device data', () => {
  const device = parseConfig({ name: 'switch-a.cfg', text: sample });
  assert.equal(detectVendor(sample, 'switch-a.cfg'), 'SNR');
  assert.equal(device.hostname.value, 'ekb-snr-01');
  assert.equal(device.vendor.value, 'SNR');
  assert.equal(device.ports.length, 2);
  assert.equal(device.ports[0].vlan, 100);
  assert.equal(device.ports[1].mode, 'trunk');
  assert.deepEqual(device.vlans.map(vlan => vlan.id), [100, 200]);
  assert.equal(device.settings.stormControl.enabled, true);
  assert.equal(device.settings.stp.enabled, true);
});

test('uses explicit unknown state for generic incomplete configs', () => {
  const device = parseConfig({ name: 'mystery.conf', text: 'interface foo\n custom-vendor-command enable' });
  assert.equal(device.vendor.value, 'Generic');
  assert.equal(device.vendor.confidence, 'unknown');
  assert.ok(device.warnings.length >= 1);
  assert.ok(device.unknown.includes('custom-vendor-command enable'));
});

test('summarizes devices and emits escaped CSV', () => {
  const devices = [parseConfig({ name: 'a.cfg', text: sample }), parseConfig({ name: 'b.cfg', text: 'hostname clean\n' })];
  const summary = summarize(devices);
  assert.equal(summary.devices, 2);
  assert.equal(summary.vlans, 2);
  assert.match(toCsv(devices), /"source","hostname"/);
  assert.match(toCsv(devices), /"a.cfg"/);
});

test('startup demo payload contains 50 explicitly synthetic configurations across all vendors', () => {
  const configs = createDemoConfigs();
  const devices = createDemoDevices();
  assert.equal(configs.length, 50);
  assert.equal(devices.length, 50);
  assert.deepEqual([...new Set(devices.map(device => device.vendor.value))].sort(), [...demoVendors].sort());
  assert.ok(devices.every(device => device.origin === 'synthetic-demo'));
  assert.equal(devices.filter(device => device.vendor.value === 'SNR').length, 10);
  assert.equal(devices.filter(device => device.vendor.value === 'D-Link').length, 10);
  assert.equal(devices.filter(device => device.vendor.value === 'FiberHome').length, 10);
  assert.equal(devices.filter(device => device.vendor.value === 'Edgecore').length, 10);
  assert.equal(devices.filter(device => device.vendor.value === 'Eltex').length, 10);
});

test('app initializes demo devices before its first render', async () => {
  const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(app, /state = \{ devices: createDemoDevices\(\)/);
  assert.match(app, /populateVendors\(\); render\(\);/);
  assert.doesNotMatch(app, /render\(\); worker\.postMessage\(\{ demo: true/);
});

test('user uploads retain their non-demo origin', () => {
  const device = parseConfig({ name: 'uploaded.cfg', text: sample });
  assert.equal(device.origin, 'user-upload');
});

test('LLM payload is normalized, bounded, and excludes raw configuration text', () => {
  const devices = createDemoDevices();
  const payload = buildAnalysisPayload(devices);
  assert.equal(payload.scope, 'summary');
  assert.equal(payload.deviceCount, 50);
  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).length <= MAX_PAYLOAD_BYTES);
  assert.equal(Object.hasOwn(payload.devices[0], 'source'), false);
  assert.equal(Object.hasOwn(payload.devices[0], 'unknown'), false);
});

test('LLM adapter uses local fallback without an endpoint and sends only its payload', async () => {
  const payload = buildAnalysisPayload(createDemoDevices().slice(0, 1));
  const local = await analyzeWithLlm(payload, { endpoint: '' });
  assert.equal(local.mode, 'local');
  let request;
  const remote = await analyzeWithLlm(payload, { endpoint: 'https://proxy.example/analyze', fetchImpl: async (_url, options) => { request = JSON.parse(options.body); return { ok: true, json: async () => ({ text: 'safe response' }) }; } });
  assert.equal(remote.text, 'safe response');
  assert.equal(request.devices[0].hostname, payload.devices[0].hostname);
  assert.equal(Object.hasOwn(request.devices[0], 'source'), false);
});

test('paginates 50 devices per page and exposes the total page count', () => {
  const devices = Array.from({ length: 121 }, (_, id) => ({ id }));
  assert.equal(getPageCount(devices), 3);
  assert.equal(paginate(devices, 1).items.length, 50);
  assert.equal(paginate(devices, 3).items.length, 21);
});

test('clamps pagination at the first and last page boundaries', () => {
  const devices = Array.from({ length: 51 }, (_, id) => ({ id }));
  assert.equal(paginate(devices, 0).currentPage, 1);
  assert.equal(paginate(devices, 99).currentPage, 2);
  assert.equal(paginate(devices, 99).items[0].id, 50);
});

test('filters before pagination so a filtered result starts on page one', () => {
  const devices = Array.from({ length: 100 }, (_, id) => ({ id, vendor: id < 50 ? 'SNR' : 'D-Link' }));
  const filtered = devices.filter(device => device.vendor === 'D-Link');
  const page = paginate(filtered, 2);
  assert.equal(page.pageCount, 1);
  assert.equal(page.currentPage, 1);
  assert.equal(page.items.length, 50);
});

test('resets the UI page when a search or filter changes', async () => {
  const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(app, /addEventListener\('input', \(\) => \{ state\.page = 1; render\(\); \}\)/);
});
