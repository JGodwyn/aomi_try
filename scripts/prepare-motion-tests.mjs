import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

mkdirSync('dist/tests', { recursive: true });
cpSync('tests/motion-regression.html', 'dist/tests/motion-regression.html');
cpSync('tests/mobile-regression.html', 'dist/tests/mobile-regression.html');
const html = readFileSync('index.html', 'utf8');
// Exercise the application's reduced-motion branch without changing OS settings.
const reducedSetup = `<script>
const nativeMatchMedia = window.matchMedia.bind(window);
window.matchMedia = query => {
  const result = nativeMatchMedia(query);
  if (query === '(prefers-reduced-motion: reduce)') {
    Object.defineProperty(result, 'matches', { value: true });
  }
  return result;
};
</script>`;
writeFileSync('dist/tests/reduced.html', html.replace('<head>', `<head>${reducedSetup}`));
if (process.argv.includes('--baseline')) {
  writeFileSync('dist/tests/original-app.js', execFileSync('git', ['show', 'HEAD:src/app.js']));
  writeFileSync('dist/tests/baseline.html', html.replace(/\/src\/app\.js\?v=\d+/, '/tests/original-app.js'));
}
console.log('Serve dist and open /tests/motion-regression.html (or ?reduced).');
