import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { resolveChromeExecutablePath } from '../src/services/pdf-report.service.js';

const fontsDir = path.resolve('src/assets/fonts');
const fontArabic = fs.readFileSync(path.join(fontsDir, 'NotoSansArabic-Regular.ttf')).toString('base64');
const fontTamil = fs.readFileSync(path.join(fontsDir, 'NotoSansTamil-Regular.ttf')).toString('base64');
const fontSinhala = fs.readFileSync(path.join(fontsDir, 'NotoSansSinhala-Regular.ttf')).toString('base64');
const fontLatin = fs.readFileSync(path.join(fontsDir, 'NotoSans-Regular.ttf')).toString('base64');

async function run() {
  const execPath = resolveChromeExecutablePath();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: execPath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @font-face {
          font-family: 'Noto Sans Local';
          src: url('data:font/truetype;charset=utf-8;base64,${fontLatin}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Noto Sans Arabic Local';
          src: url('data:font/truetype;charset=utf-8;base64,${fontArabic}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Noto Sans Tamil Local';
          src: url('data:font/truetype;charset=utf-8;base64,${fontTamil}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        @font-face {
          font-family: 'Noto Sans Sinhala Local';
          src: url('data:font/truetype;charset=utf-8;base64,${fontSinhala}') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        body {
          font-family: 'Noto Sans Local', 'Noto Sans Arabic Local', 'Noto Sans Tamil Local', 'Noto Sans Sinhala Local', sans-serif;
          font-size: 22px;
          padding: 30px;
          color: #0F172A;
          background: #FFFFFF;
        }
        .item { margin-bottom: 20px; padding: 14px 18px; border: 1px solid #E2E8F0; border-radius: 8px; }
        .label { font-size: 13px; font-weight: bold; color: #64748B; margin-bottom: 8px; text-transform: uppercase; }
        .val { font-size: 26px; }
        .arabic-text { direction: rtl; unicode-bidi: isolate; display: inline-block; font-family: 'Noto Sans Arabic Local', sans-serif; }
        .tamil-text { font-family: 'Noto Sans Tamil Local', sans-serif; }
        .sinhala-text { font-family: 'Noto Sans Sinhala Local', sans-serif; }

        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        th, td { border: 1px solid #CBD5E1; padding: 10px 14px; text-align: left; }
        th { background: #F1F5F9; font-size: 14px; }
      </style>
    </head>
    <body>
      <h2 style="margin-bottom: 20px;">MadrasaNexa 100% Embedded Font Verification (Offline & Deterministic)</h2>

      <div class="item">
        <div class="label">English</div>
        <div class="val">Mohamed</div>
      </div>

      <div class="item">
        <div class="label">Arabic (محمد)</div>
        <div class="val"><span class="arabic-text">محمد</span></div>
      </div>

      <div class="item">
        <div class="label">Tamil (முஹம்மது)</div>
        <div class="val tamil-text">முஹம்மது</div>
      </div>

      <div class="item">
        <div class="label">Sinhala (මොහොමඩ්)</div>
        <div class="val sinhala-text">මොහොමඩ්</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Language</th>
            <th>Name</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>English</td>
            <td>Mohamed</td>
            <td>Latin script regular</td>
          </tr>
          <tr>
            <td>Arabic</td>
            <td><span class="arabic-text">محمد</span></td>
            <td>Arabic Noto Sans Local (RTL joined)</td>
          </tr>
          <tr>
            <td>Tamil</td>
            <td><span class="tamil-text">முஹம்மது</span></td>
            <td>Tamil Noto Sans Local (Complex conjuncts)</td>
          </tr>
          <tr>
            <td>Sinhala</td>
            <td><span class="sinhala-text">මොහොමඩ්</span></td>
            <td>Sinhala Noto Sans Local (Kombuva + Al-lakuna)</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const outPath = path.resolve('multilingual-font-embedded-verification.png');
  await page.screenshot({ path: outPath, fullPage: true });
  await browser.close();

  console.log(`Saved screenshot to: ${outPath}`);
}

run().catch(console.error);
