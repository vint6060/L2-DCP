import { parseConfig } from './parser.js';
import { createDemoConfigs } from './demo-configs.js';
self.onmessage = async ({ data }) => {
  const files = data.demo ? createDemoConfigs() : data.files || []; const devices = []; const batchSize = 40;
  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    const texts = await Promise.all(batch.map(file => typeof file.text === 'function' ? file.text() : file.text));
    texts.forEach((text, offset) => devices.push(parseConfig({ name: batch[offset].name, text, origin: batch[offset].origin || 'user-upload' })));
    self.postMessage({ type: 'progress', done: Math.min(index + batch.length, files.length), total: files.length, requestId: data.requestId });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  self.postMessage({ type: 'complete', devices, demo: Boolean(data.demo), requestId: data.requestId });
};
