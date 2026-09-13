import { parseConfig } from './parser.js';
self.onmessage = async ({ data }) => {
  const files = data.files || []; const devices = []; const batchSize = 40;
  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    const texts = await Promise.all(batch.map(file => file.text()));
    texts.forEach((text, offset) => devices.push(parseConfig({ name: batch[offset].name, text })));
    self.postMessage({ type: 'progress', done: Math.min(index + batch.length, files.length), total: files.length });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  self.postMessage({ type: 'complete', devices });
};
