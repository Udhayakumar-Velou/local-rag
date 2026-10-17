const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath || !fs.existsSync(imagePath)) {
    console.error('Usage: node extract_image_ocr.js <image-path>');
    process.exit(1);
  }

  const tessDir = path.resolve(__dirname, '..', 'data', 'tessdata');
  const hasLocalEng = fs.existsSync(path.join(tessDir, 'eng.traineddata'));
  const hasLocalFra = fs.existsSync(path.join(tessDir, 'fra.traineddata'));

  const options = {};
  if (hasLocalEng) {
    options.langPath = tessDir;
    options.cachePath = tessDir;
    options.gzip = false;
  }

  const langs = hasLocalEng && hasLocalFra ? ['eng', 'fra'] : 'eng';
  const worker = await createWorker(langs, 1, options);

  try {
    const buffer = fs.readFileSync(imagePath);
    const ret = await worker.recognize(buffer);
    process.stdout.write(ret.data.text || '');
  } finally {
    await worker.terminate();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
