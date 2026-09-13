import { parseConfig } from './parser.js';

const VENDORS = [
  { id: 'snr', name: 'SNR', marker: 'SNR', model: 'SNR-S2995G-24TX', syntax: 'interface ethernet' },
  { id: 'd-link', name: 'D-Link', marker: 'D-Link', model: 'DES-3200-28', syntax: 'interface ethernet' },
  { id: 'fiberhome', name: 'FiberHome', marker: 'FiberHome', model: 'AN5516-04', syntax: 'interface ethernet' },
  { id: 'edgecore', name: 'Edgecore', marker: 'Edgecore', model: 'ECS4120-28T', syntax: 'interface ethernet' },
  { id: 'eltex', name: 'Eltex', marker: 'Eltex', model: 'MES2424', syntax: 'interface ethernet' }
];

function configFor(vendor, index) {
  const host = `demo-${vendor.id}-${String(index + 1).padStart(2, '0')}`;
  return {
    name: `${host}.cfg`,
    text: `! Synthetic demo configuration; not a production export\n! vendor: ${vendor.marker}\nhostname ${host}\nmodel ${vendor.model}\nvlan 10 name management\nvlan 20 name users\nvlan 100 name demo-services\n${vendor.syntax} 1/0/1\n no shutdown\n switchport mode access\n switchport access vlan 20\n poe enable\n${vendor.syntax} 1/0/24\n no shutdown\n switchport mode trunk\n switchport trunk allowed vlan 10,20,100\nspanning-tree mode mstp\nstorm-control broadcast 2\n` ,
    origin: 'synthetic-demo'
  };
}

export function createDemoConfigs() {
  return VENDORS.flatMap(vendor => Array.from({ length: 10 }, (_, index) => configFor(vendor, index)));
}

export function createDemoDevices() {
  return createDemoConfigs().map(config => parseConfig(config));
}

export const demoVendors = VENDORS.map(vendor => vendor.name);
