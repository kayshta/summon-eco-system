import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ENV_PATH = path.join(__dirname, '../../.env');

export function maskSecret(value) {
  if (!value) {
    return '';
  }
  if (value.length <= 4) {
    return '****';
  }
  return `${'*'.repeat(Math.min(value.length - 4, 20))}${value.slice(-4)}`;
}

export function writeEnvValues(updates) {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  }

  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');

    if (pattern.test(content)) {
      content = content.replace(pattern, line);
    } else {
      if (content.length > 0 && !content.endsWith('\n')) {
        content += '\n';
      }
      content += `${line}\n`;
    }
  }

  fs.writeFileSync(ENV_PATH, content, 'utf8');

  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }
}
