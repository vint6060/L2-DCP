import assert from 'node:assert/strict';
import test from 'node:test';
import { detectVendor, parseConfig, summarize, toCsv } from './parser.js';

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
