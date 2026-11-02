const { createCanvas } = require("@napi-rs/canvas");
const { createWorker } = require("tesseract.js");

async function main() {
  const canvas = createCanvas(400, 100);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, 400, 100);
  ctx.fillStyle = "black";
  ctx.font = "24px sans-serif";
  ctx.fillText("Hello OCR 123", 20, 60);
  const buffer = canvas.toBuffer("image/png");
  require("fs").writeFileSync("C:/job ai/data/test-ocr.png", buffer);

  const worker = await createWorker("eng");
  const { data } = await worker.recognize(buffer);
  console.log("OCR:", JSON.stringify(data.text));
  await worker.terminate();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
