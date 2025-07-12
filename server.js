const express = require('express');
const cors = require('cors');
const axios = require('axios');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const walk = require('acorn-walk');
const multer = require('multer');
const upload = multer();
const Parser = acorn.Parser.extend(jsx());

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;

// Validate required environment variables
if (!GITHUB_TOKEN || !OWNER || !REPO) {
  console.error('Error: Missing required environment variables');
  console.error('Required: GITHUB_TOKEN, OWNER, REPO');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: { owner: OWNER, repo: REPO }
  });
});

// 1. อ่านไฟล์ README.md
app.get('/readme', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/README.md`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    // เนื้อหาไฟล์จะถูก base64 encode
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    res.send({ content, sha: response.data.sha });
  } catch (e) {
    res.status(500).send('อ่านไฟล์ README.md ไม่สำเร็จ: ' + e.message);
  }
});

// 2. แก้ไขไฟล์ README.md
app.post('/readme', async (req, res) => {
  const { content, sha } = req.body;
  if (!content || !sha) return res.status(400).send('ต้องระบุ content และ sha');

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/README.md`;
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    await axios.put(url, {
      message: 'แก้ไข README.md ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข README.md และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไขไฟล์ README.md ไม่สำเร็จ: ' + e.message);
  }
});

app.get('/file', async (req, res) => {
  const { path: filePath } = req.query;
  if (!filePath) return res.status(400).send('ต้องระบุ path');

  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    res.send({ content, sha: response.data.sha });
  } catch (e) {
    res.status(500).send('อ่านไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

// Endpoint สำหรับอ่าน buyVoucherButton object
app.get('/buy-voucher-button', async (req, res) => {
  const filePath = 'src/components/Slider/Slider.jsx';
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    // หา buyVoucherButton object
    const btnRegex = /const\s+buyVoucherButton\s*=\s*\{\s*text:\s*'([^']+)',\s*link:\s*'([^']+)'\s*\}/m;
    const match = content.match(btnRegex);
    if (match) {
      res.send({ text: match[1], url: match[2], sha });
    } else {
      res.status(404).send('ไม่พบ buyVoucherButton object ในไฟล์นี้');
    }
  } catch (e) {
    res.status(500).send('อ่านไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

// Endpoint สำหรับแก้ไข buyVoucherButton object
app.post('/buy-voucher-button', async (req, res) => {
  const filePath = 'src/components/Slider/Slider.jsx';
  const { text, url, sha } = req.body;
  if (!text || !url || !sha) return res.status(400).send('ต้องระบุ text, url และ sha');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    // หา buyVoucherButton object
    const btnRegex = /(const\s+buyVoucherButton\s*=\s*\{\s*text:\s*')[^']+(',\s*link:\s*')[^']+('\s*\})/m;
    if (!btnRegex.test(content)) {
      return res.status(404).send('ไม่พบ buyVoucherButton object ในไฟล์นี้');
    }
    // แทนที่ข้อความและลิงก์ใหม่
    content = content.replace(btnRegex, `$1${text}$2${url}$3`);
    // push กลับเข้า git
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(putUrl, {
      message: 'แก้ไข buyVoucherButton object ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข buyVoucherButton object และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไขไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

// Endpoint สำหรับอ่าน/แก้ไข headline ของแต่ละสไลด์
app.get('/slider-headlines', async (req, res) => {
  const filePath = 'src/components/Slider/Slider.jsx';
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    // ดึง headline ทั้งหมดจาก slideTexts
    const slideTextsRegex = /const\s+slideTexts\s*=\s*\[([\s\S]*?)\];/m;
    const match = content.match(slideTextsRegex);
    if (match) {
      // แปลงเป็น array ของ headline
      const arr = Array.from(match[1].matchAll(/headline:\s*'([^']+)'/g)).map(m => m[1]);
      res.send({ headlines: arr, sha });
    } else {
      res.status(404).send('ไม่พบ slideTexts ในไฟล์นี้');
    }
  } catch (e) {
    res.status(500).send('อ่านไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

app.post('/slider-headlines', async (req, res) => {
  const filePath = 'src/components/Slider/Slider.jsx';
  const { headlines, sha } = req.body;
  if (!Array.isArray(headlines) || !sha) return res.status(400).send('ต้องระบุ headlines (array) และ sha');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    // สร้าง slideTexts ใหม่
    const newSlideTexts = 'const slideTexts = [\n' + headlines.map(h => `    { headline: '${h}' },`).join('\n') + '\n  ];';
    // แทนที่ slideTexts เดิม
    const slideTextsRegex = /const\s+slideTexts\s*=\s*\[[\s\S]*?\];/m;
    if (!slideTextsRegex.test(content)) {
      return res.status(404).send('ไม่พบ slideTexts ในไฟล์นี้');
    }
    content = content.replace(slideTextsRegex, newSlideTexts);
    // push กลับเข้า git
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(putUrl, {
      message: 'แก้ไข slideTexts (headline) ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข headline ของสไลด์และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไขไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

// Endpoint สำหรับอัปโหลดไฟล์ SVG (slide1.svg, slide2.svg, slide3.svg)

app.post('/upload-svg', upload.single('svgfile'), async (req, res) => {
  const { filename } = req.body;
  if (!req.file || !filename || !filename.endsWith('.svg')) {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg และระบุชื่อไฟล์ .svg');
  }
  try {
    // อ่านไฟล์ svg เป็น base64
    const encodedContent = req.file.buffer.toString('base64');
    const filePath = `src/components/Slider/${filename}`; // <-- แก้ path
    // ตรวจสอบ sha เดิม (ถ้ามี)
    let sha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      sha = response.data.sha;
    } catch (e) {
      // ถ้าไฟล์ยังไม่มี sha จะ undefined (สร้างใหม่)
    }
    // push svg เข้า git
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} ผ่าน admin tool`,
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('อัปโหลดไฟล์ SVG และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('อัปโหลดไฟล์ไม่สำเร็จ: ' + e.message);
  }
});

// Utility: อ่าน slideTexts ปัจจุบันจาก Slider.jsx
async function getSlideTexts() {
  const filePath = 'src/components/Slider/Slider.jsx';
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
  const response = await axios.get(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const content = Buffer.from(response.data.content, 'base64').toString('utf8');
  const sha = response.data.sha;
  // ดึง slideTexts array
  const slideTextsRegex = /const\s+slideTexts\s*=\s*\[([\s\S]*?)\];/m;
  const match = content.match(slideTextsRegex);
  let slides = [];
  if (match) {
    slides = Array.from(match[1].matchAll(/\{\s*headline:\s*'([^']+)',\s*image:\s*'([^']+)'\s*\}/g)).map(m => ({ headline: m[1], image: m[2] }));
  }
  return { slides, sha, content, filePath };
}

// GET /slides: ส่ง slideTexts (headline + image) ทั้งหมด
app.get('/slides', async (req, res) => {
  try {
    const { slides } = await getSlideTexts();
    res.send({ slides });
  } catch (e) {
    res.status(500).send('อ่าน slideTexts ไม่สำเร็จ: ' + e.message);
  }
});

// POST /slides/add: อัปโหลด SVG + headline ใหม่, backend ตั้งชื่อไฟล์ slideN.svg อัตโนมัติ, เพิ่ม slide ใหม่
app.post('/slides/add', upload.single('svgfile'), async (req, res) => {
  const { headline } = req.body;
  if (!req.file || !headline) {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg และระบุ headline');
  }
  try {
    // อ่าน slideTexts เดิม
    const { slides, sha, content, filePath } = await getSlideTexts();
    const newIndex = slides.length + 1;
    const filename = `slide${newIndex}.svg`;
    // อัปโหลดไฟล์ svg ใหม่
    const encodedContent = req.file.buffer.toString('base64');
    const svgPath = `src/components/Slider/${filename}`; // <-- แก้ path
    // push svg เข้า git
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} (เพิ่ม slide ใหม่) ผ่าน admin tool`,
      content: encodedContent,
      sha: svgSha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    // เพิ่ม slide ใหม่ใน slideTexts
    const newSlides = [...slides, { headline, image: filename }];
    const newSlideTexts = 'const slideTexts = [\n' + newSlides.map(s => `  { headline: '${s.headline}', image: '${s.image}' },`).join('\n') + '\n];';
    const slideTextsRegex = /const\s+slideTexts\s*=\s*\[[\s\S]*?\];/m;
    const newContent = content.replace(slideTextsRegex, newSlideTexts);
    // push Slider.jsx
    const encodedSlider = Buffer.from(newContent, 'utf8').toString('base64');
    const sliderUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(sliderUrl, {
      message: 'เพิ่ม slide ใหม่ผ่าน admin tool',
      content: encodedSlider,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('เพิ่ม slide ใหม่และอัปโหลด SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('เพิ่ม slide ไม่สำเร็จ: ' + e.message);
  }
});

// POST /slides/update-image: อัปโหลด SVG ใหม่สำหรับ slide ที่เลือก (index), เขียนทับไฟล์เดิม
app.post('/slides/update-image', upload.single('svgfile'), async (req, res) => {
  const { index } = req.body;
  if (!req.file || typeof index === 'undefined') {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg และระบุ index');
  }
  try {
    const { slides } = await getSlideTexts();
    if (index < 0 || index >= slides.length) return res.status(400).send('index ไม่ถูกต้อง');
    const filename = slides[index].image;
    const encodedContent = req.file.buffer.toString('base64');
    const svgPath = `src/components/Slider/${filename}`; // <-- แก้ path
    // ตรวจสอบ sha เดิม
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    // push svg เข้า git (เขียนทับ)
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} (อัปเดตรูป slide) ผ่าน admin tool`,
      content: encodedContent,
      sha: svgSha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('อัปเดตรูปภาพ slide สำเร็จ!');
  } catch (e) {
    res.status(500).send('อัปเดตรูปภาพ slide ไม่สำเร็จ: ' + e.message);
  }
});

// POST /slides/update-headline: แก้ไข headline ของ slide ที่เลือก (index)
app.post('/slides/update-headline', async (req, res) => {
  const { index, headline } = req.body;
  if (typeof index === 'undefined' || typeof headline !== 'string') {
    return res.status(400).send('ต้องระบุ index และ headline');
  }
  try {
    const { slides, sha, content, filePath } = await getSlideTexts();
    if (index < 0 || index >= slides.length) return res.status(400).send('index ไม่ถูกต้อง');
    const newSlides = slides.map((s, i) => i === Number(index) ? { ...s, headline } : s);
    const newSlideTexts = 'const slideTexts = [\n' + newSlides.map(s => `  { headline: '${s.headline}', image: '${s.image}' },`).join('\n') + '\n];';
    const slideTextsRegex = /const\s+slideTexts\s*=\s*\[[\s\S]*?\];/m;
    const newContent = content.replace(slideTextsRegex, newSlideTexts);
    // push Slider.jsx
    const encodedSlider = Buffer.from(newContent, 'utf8').toString('base64');
    const sliderUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(sliderUrl, {
      message: 'แก้ไข headline slide ผ่าน admin tool',
      content: encodedSlider,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข headline slide สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข headline slide ไม่สำเร็จ: ' + e.message);
  }
});

// POST /slides/delete: ลบ slide ตาม index
app.post('/slides/delete', async (req, res) => {
  const { index } = req.body;
  if (typeof index === 'undefined') {
    return res.status(400).send('ต้องระบุ index');
  }
  try {
    const { slides, sha, content, filePath } = await getSlideTexts();
    if (index < 0 || index >= slides.length) return res.status(400).send('index ไม่ถูกต้อง');
    // --- เพิ่มส่วนลบไฟล์ SVG จริง ---
    const removedSlide = slides[index];
    const svgFilename = removedSlide.image; // เช่น slide2.svg
    const svgPath = `src/components/Slider/${svgFilename}`;
    // หา sha ของไฟล์ SVG ก่อนลบ
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {
      // ถ้าไฟล์ไม่มี sha แปลว่าไฟล์ไม่มีจริง ไม่ต้องลบ
    }
    if (svgSha) {
      // ลบไฟล์ SVG จริงผ่าน GitHub API
      const delUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      await axios.delete(delUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
        data: {
          message: `ลบไฟล์ SVG ${svgFilename} ผ่าน admin tool (ลบ slide)`,
          sha: svgSha
        }
      });
    }
    // --- ลบ object ใน slideTexts และ push Slider.jsx ---
    const newSlides = slides.filter((_, i) => i !== Number(index));
    const newSlideTexts = 'const slideTexts = [\n' + newSlides.map(s => `  { headline: '${s.headline}', image: '${s.image}' },`).join('\n') + '\n];';
    const slideTextsRegex = /const\s+slideTexts\s*=\s*\[[\s\S]*?\];/m;
    const newContent = content.replace(slideTextsRegex, newSlideTexts);
    // push Slider.jsx
    const encodedSlider = Buffer.from(newContent, 'utf8').toString('base64');
    const sliderUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`;
    await axios.put(sliderUrl, {
      message: 'ลบ slide ออกผ่าน admin tool',
      content: encodedSlider,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('ลบ slide และไฟล์ SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('ลบ slide ไม่สำเร็จ: ' + e.message);
  }
});

// robust JS parsing: acorn + acorn-jsx + acorn-walk (ไม่ใช้ @acorn-jsx/walk)

const NEST_WELCOME_PATH = 'src/components/NestWelcome/NestWelcome.jsx';

function extractNestWelcomeObject(content) {
  // ดึง object แบบ greedy (หยุดที่ }; ที่ขึ้นต้นบรรทัด)
  const match = content.match(/const\s+nestWelcomeContent\s*=\s*({[\s\S]*?^};)/m);
  if (!match) return null;
  const objCode = match[1];
  try {
    // ใช้ Function constructor เพื่อรองรับ template string/backtick
    const obj = Function('return ' + objCode)();
    return obj;
  } catch (e) {
    console.error('extractNestWelcomeObject error:', e, objCode);
    return null;
  }
}

function replaceNestWelcomeObject(content, newObj) {
  // stringify object (ใช้ 2 space เพื่อความอ่านง่าย)
  const newObjStr = JSON.stringify(newObj, null, 2);
  // แทนที่ object เดิม
  return content.replace(
    /const\s+nestWelcomeContent\s*=\s*{[\s\S]*?^};/m,
    `const nestWelcomeContent = ${newObjStr};`
  );
}

// GET /nestwelcome-content: อ่าน config object
app.get('/nestwelcome-content', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${NEST_WELCOME_PATH}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    const config = extractNestWelcomeObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    res.send({ ...config, sha });
  } catch (e) {
    res.status(500).send('อ่าน NestWelcome.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /nestwelcome-content: แก้ไข config object
app.post('/nestwelcome-content', async (req, res) => {
  const { title, subtitle, description, bookButton, viewAllButton, sha } = req.body;
  if (!sha) return res.status(400).send('ต้องระบุ sha');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${NEST_WELCOME_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractNestWelcomeObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    // อัปเดตค่าตาม req.body
    if (title !== undefined) config.title = title;
    if (subtitle !== undefined) config.subtitle = subtitle;
    if (description !== undefined) config.description = description;
    if (bookButton !== undefined) config.bookButton = bookButton;
    if (viewAllButton !== undefined) config.viewAllButton = viewAllButton;
    // สร้างไฟล์ใหม่
    const newContent = replaceNestWelcomeObject(content, config);
    // push กลับเข้า git
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${NEST_WELCOME_PATH}`;
    await axios.put(putUrl, {
      message: 'แก้ไข nestWelcomeContent ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข NestWelcome.jsx (config) และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข NestWelcome.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// === Aboutus.jsx Config ===
const ABOUTUS_PATH = 'src/components/Aboutus/Aboutus.jsx';

function extractAboutusObject(content) {
  // ดึง object แบบ greedy (หยุดที่ }; ที่ขึ้นต้นบรรทัด)
  const match = content.match(/const\s+aboutusContent\s*=\s*({[\s\S]*?^};)/m);
  if (!match) return null;
  const objCode = match[1];
  try {
    // ใช้ Function constructor เพื่อรองรับ template string/backtick
    const obj = Function('return ' + objCode)();
    return obj;
  } catch (e) {
    console.error('extractAboutusObject error:', e, objCode);
    return null;
  }
}

function replaceAboutusObject(content, newObj) {
  // stringify object (ใช้ 2 space เพื่อความอ่านง่าย)
  const newObjStr = JSON.stringify(newObj, null, 2);
  // แทนที่ object เดิม
  return content.replace(
    /const\s+aboutusContent\s*=\s*{[\s\S]*?^};/m,
    `const aboutusContent = ${newObjStr};`
  );
}

// GET /aboutus-content: อ่าน config object
app.get('/aboutus-content', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    const config = extractAboutusObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    res.send({ ...config, sha });
  } catch (e) {
    res.status(500).send('อ่าน Aboutus.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /aboutus-content: แก้ไข config object
app.post('/aboutus-content', async (req, res) => {
  const { aboutusContent, sha } = req.body;
  if (!sha || !aboutusContent) return res.status(400).send('ต้องระบุ sha และ aboutusContent');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractAboutusObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    // อัปเดตค่าทั้ง object
    Object.assign(config, aboutusContent);
    // สร้างไฟล์ใหม่
    const newContent = replaceAboutusObject(content, config);
    // push กลับเข้า git
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    await axios.put(putUrl, {
      message: 'แก้ไข aboutusContent ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข Aboutus.jsx (config) และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข Aboutus.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// === Utility สำหรับ import และ imageMap ใน Aboutus.jsx ===
function extractImports(content) {
  // ดึง import SVG ทั้งหมด (เช่น import FacialMas1 from './facialmas1.svg';)
  const importRegex = /import\s+(\w+)\s+from\s+'\.\/(facialmas\d+\.svg)';/g;
  let match, imports = [];
  while ((match = importRegex.exec(content))) {
    imports.push({ varName: match[1], filename: match[2] });
  }
  return imports;
}
function addImport(content, varName, filename) {
  // เพิ่ม import ใหม่ก่อนบรรทัดแรกที่ไม่ใช่ import
  const importLine = `import ${varName} from './${filename}';\n`;
  const importEnd = content.lastIndexOf('import');
  const nextLine = content.indexOf('\n', importEnd);
  return content.slice(0, nextLine + 1) + importLine + content.slice(nextLine + 1);
}
function removeImport(content, filename) {
  // ลบ import ที่มี filename ตรง
  const importRegex = new RegExp(`^import\\s+\\w+\\s+from\\s+'\\.\/${filename}';\\s*$`, 'm');
  return content.replace(importRegex, '');
}
function extractImageMap(content) {
  // ดึง object imageMap (key: 'facialmasX.svg', value: FacialMasX)
  const mapRegex = /const\s+imageMap\s*=\s*\{([\s\S]*?)\};/m;
  const match = content.match(mapRegex);
  if (!match) return {};
  const objStr = match[1];
  const entryRegex = /'([^']+)'\s*:\s*(\w+)/g;
  let m, map = {};
  while ((m = entryRegex.exec(objStr))) {
    map[m[1]] = m[2];
  }
  return map;
}
function addImageMapEntry(content, filename, varName) {
  // ดึง imageMap เดิม
  const mapRegex = /const\s+imageMap\s*=\s*\{([\s\S]*?)\};/m;
  const match = content.match(mapRegex);
  let entries = [];
  if (match) {
    const objStr = match[1];
    // แยกแต่ละ entry (multi-line หรือ inline)
    const entryRegex = /['"]([^'"]+)['"]\s*:\s*(\w+)/g;
    let m;
    while ((m = entryRegex.exec(objStr))) {
      entries.push({ key: m[1], value: m[2] });
    }
  }
  // เพิ่ม entry ใหม่
  entries.push({ key: filename, value: varName });
  // สร้าง object ใหม่แบบ multi-line
  const newObjStr = entries.map(e => `  '${e.key}': ${e.value},`).join('\n');
  const newMap = `const imageMap = {\n${newObjStr}\n};`;
  // แทนที่ imageMap เดิม
  return content.replace(mapRegex, newMap);
}
function removeImageMapEntry(content, filename) {
  // ดึง imageMap เดิม
  const mapRegex = /const\s+imageMap\s*=\s*\{([\s\S]*?)\};/m;
  const match = content.match(mapRegex);
  let entries = [];
  if (match) {
    const objStr = match[1];
    // แยกแต่ละ entry (multi-line หรือ inline)
    const entryRegex = /['"]([^'"]+)['"]\s*:\s*(\w+)/g;
    let m;
    while ((m = entryRegex.exec(objStr))) {
      if (m[1] !== filename) {
        entries.push({ key: m[1], value: m[2] });
      }
    }
  }
  // สร้าง object ใหม่แบบ multi-line
  const newObjStr = entries.map(e => `  '${e.key}': ${e.value},`).join('\n');
  const newMap = `const imageMap = {\n${newObjStr}\n};`;
  // แทนที่ imageMap เดิม
  return content.replace(mapRegex, newMap);
}

// ปรับ endpoint /aboutus/service-card/add
app.post('/aboutus/service-card/add', upload.single('svgfile'), async (req, res) => {
  const { alt, buttonText, link, sha } = req.body;
  if (!req.file || !alt || !buttonText || !link || !sha) {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg, ระบุ alt, buttonText, link, sha');
  }
  try {
    // อ่านไฟล์ Aboutus.jsx เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractAboutusObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    // หาลำดับใหม่ (X)
    const cards = config.serviceCards || [];
    const newIndex = cards.length + 1;
    const filename = `facialmas${newIndex}.svg`;
    const varName = `FacialMas${newIndex}`;
    // อัปโหลดไฟล์ SVG
    const encodedContent = req.file.buffer.toString('base64');
    const svgPath = `src/components/Aboutus/${filename}`;
    // push svg เข้า git
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} (เพิ่ม service card) ผ่าน admin tool`,
      content: encodedContent,
      sha: svgSha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    // เพิ่ม service card ใหม่
    cards.push({ image: filename, alt, buttonText, link });
    config.serviceCards = cards;
    // --- เพิ่ม import และ imageMap ---
    content = addImport(content, varName, filename);
    content = addImageMapEntry(content, filename, varName);
    // สร้างไฟล์ใหม่
    const newContent = replaceAboutusObject(content, config);
    // push Aboutus.jsx
    const encodedAboutus = Buffer.from(newContent, 'utf8').toString('base64');
    const aboutusUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    await axios.put(aboutusUrl, {
      message: 'เพิ่ม service card ใหม่ + import + imageMap ผ่าน admin tool',
      content: encodedAboutus,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('เพิ่ม service card ใหม่, import, imageMap และอัปโหลด SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('เพิ่ม service card ไม่สำเร็จ: ' + e.message);
  }
});

// ปรับ endpoint /aboutus/service-card/delete
app.post('/aboutus/service-card/delete', async (req, res) => {
  const { index, sha } = req.body;
  if (typeof index === 'undefined' || !sha) {
    return res.status(400).send('ต้องระบุ index และ sha');
  }
  try {
    // อ่านไฟล์ Aboutus.jsx เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractAboutusObject(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    const cards = config.serviceCards || [];
    if (index < 0 || index >= cards.length) return res.status(400).send('index ไม่ถูกต้อง');
    // ลบไฟล์ SVG ที่เกี่ยวข้อง
    const removedCard = cards[index];
    const svgFilename = removedCard.image; // เช่น slide2.svg
    const svgPath = `src/components/Aboutus/${svgFilename}`;
    // หา sha ของไฟล์ SVG ก่อนลบ
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    if (svgSha) {
      // ลบไฟล์ SVG จริงผ่าน GitHub API
      const delUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      await axios.delete(delUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
        data: {
          message: `ลบไฟล์ SVG ${svgFilename} ผ่าน admin tool (ลบ service card)` ,
          sha: svgSha
        }
      });
    }
    // ลบ object ใน serviceCards
    cards.splice(index, 1);
    config.serviceCards = cards;
    // --- ลบ import และ imageMap ---
    // หา varName จาก import เดิม
    const imports = extractImports(content);
    const found = imports.find(i => i.filename === svgFilename);
    if (found) {
      content = removeImport(content, svgFilename);
      content = removeImageMapEntry(content, svgFilename);
    }
    // สร้างไฟล์ใหม่
    const newContent = replaceAboutusObject(content, config);
    // push Aboutus.jsx
    const encodedAboutus = Buffer.from(newContent, 'utf8').toString('base64');
    const aboutusUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${ABOUTUS_PATH}`;
    await axios.put(aboutusUrl, {
      message: 'ลบ service card, import, imageMap และไฟล์ SVG ผ่าน admin tool',
      content: encodedAboutus,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('ลบ service card, import, imageMap และไฟล์ SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('ลบ service card ไม่สำเร็จ: ' + e.message);
  }
});


// === BlogSection.jsx Config ===
const BLOGSECTION_PATH = 'src/components/Blog/BlogSection.jsx';

function extractBlogSectionConfig(content) {
  // ดึง object แบบ greedy (หยุดที่ }; ที่ขึ้นต้นบรรทัด)
  const match = content.match(/const\s+blogSectionConfig\s*=\s*({[\s\S]*?^};)/m);
  if (!match) return null;
  const objCode = match[1];
  try {
    // ใช้ Function constructor เพื่อรองรับ template string/backtick
    const obj = Function('return ' + objCode)();
    return obj;
  } catch (e) {
    console.error('extractBlogSectionConfig error:', e, objCode);
    return null;
  }
}

function replaceBlogSectionConfig(content, newObj) {
  // stringify object (ใช้ 2 space เพื่อความอ่านง่าย)
  const newObjStr = JSON.stringify(newObj, null, 2);
  // แทนที่ object เดิม
  return content.replace(
    /const\s+blogSectionConfig\s*=\s*{[\s\S]*?^};/m,
    `const blogSectionConfig = ${newObjStr};`
  );
}

function extractBlogImports(content) {
  // ดึง import SVG ทั้งหมด (เช่น import blog1 from './blog1.svg';)
  const importRegex = /import\s+(\w+)\s+from\s+'\.\/(blog\d+\.svg)';/g;
  let match, imports = [];
  while ((match = importRegex.exec(content))) {
    imports.push({ varName: match[1], filename: match[2] });
  }
  return imports;
}
function addBlogImport(content, varName, filename) {
  // เพิ่ม import ใหม่ก่อนบรรทัดแรกที่ไม่ใช่ import
  const importLine = `import ${varName} from './${filename}';\n`;
  const importEnd = content.lastIndexOf('import');
  const nextLine = content.indexOf('\n', importEnd);
  return content.slice(0, nextLine + 1) + importLine + content.slice(nextLine + 1);
}
function removeBlogImport(content, filename) {
  // ลบ import ที่มี filename ตรง
  const importRegex = new RegExp(`^import\\s+\\w+\\s+from\\s+'\\.\/${filename}';\\s*$`, 'm');
  return content.replace(importRegex, '');
}
function removeBlogImageMapEntry(content, filename) {
  // ดึง imageMap เดิม
  const mapRegex = /const\s+imageMap\s*=\s*\{([\s\S]*?)\};/m;
  const match = content.match(mapRegex);
  let entries = [];
  if (match) {
    const objStr = match[1];
    // แยกแต่ละ entry (multi-line หรือ inline)
    const entryRegex = /['"]([^'"]+)['"]\s*:\s*(\w+)/g;
    let m;
    while ((m = entryRegex.exec(objStr))) {
      if (m[1] !== filename) {
        entries.push({ key: m[1], value: m[2] });
      }
    }
  }
  // สร้าง object ใหม่แบบ multi-line
  const newObjStr = entries.map(e => `  '${e.key}': ${e.value},`).join('\n');
  const newMap = `const imageMap = {\n${newObjStr}\n};`;
  // แทนที่ imageMap เดิม
  return content.replace(mapRegex, newMap);
}

// GET /blogsection-config: อ่าน config object
app.get('/blogsection-config', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    const config = extractBlogSectionConfig(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    res.send({ ...config, sha });
  } catch (e) {
    res.status(500).send('อ่าน BlogSection.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /blogsection-config: แก้ไข config object (ทุก field)
app.post('/blogsection-config', async (req, res) => {
  const { blogSectionConfig, sha } = req.body;
  if (!sha || !blogSectionConfig) return res.status(400).send('ต้องระบุ sha และ blogSectionConfig');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractBlogSectionConfig(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    // อัปเดตค่าทั้ง object
    Object.assign(config, blogSectionConfig);
    // สร้างไฟล์ใหม่
    const newContent = replaceBlogSectionConfig(content, config);
    // push กลับเข้า git
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    await axios.put(putUrl, {
      message: 'แก้ไข blogSectionConfig ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข BlogSection.jsx (config) และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข BlogSection.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /blogsection/blogpost/add: เพิ่ม blog post (อัปโหลด SVG + ข้อมูล)
app.post('/blogsection/blogpost/add', upload.single('svgfile'), async (req, res) => {
  const { alt, title, link, sha } = req.body;
  if (!req.file || !alt || !title || !link || !sha) {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg, ระบุ alt, title, link, sha');
  }
  try {
    // อ่านไฟล์ BlogSection.jsx เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractBlogSectionConfig(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    // หาลำดับใหม่ (X)
    const posts = config.blogPosts || [];
    const newIndex = posts.length + 1;
    const filename = `blog${newIndex}.svg`;
    const varName = `blog${newIndex}`;
    // อัปโหลดไฟล์ SVG
    const encodedContent = req.file.buffer.toString('base64');
    const svgPath = `src/components/Blog/${filename}`;
    // push svg เข้า git
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} (เพิ่ม blog post) ผ่าน admin tool`,
      content: encodedContent,
      sha: svgSha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    // เพิ่ม blog post ใหม่
    posts.push({ image: filename, alt, title, link });
    config.blogPosts = posts;
    // --- เพิ่ม import และ imageMap ---
    content = addBlogImport(content, varName, filename);
    content = addImageMapEntry(content, filename, varName);
    // สร้างไฟล์ใหม่
    const newContent = replaceBlogSectionConfig(content, config);
    // push BlogSection.jsx
    const encodedBlog = Buffer.from(newContent, 'utf8').toString('base64');
    const blogUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    await axios.put(blogUrl, {
      message: 'เพิ่ม blog post ใหม่ + import + imageMap ผ่าน admin tool',
      content: encodedBlog,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('เพิ่ม blog post ใหม่, import, imageMap และอัปโหลด SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('เพิ่ม blog post ไม่สำเร็จ: ' + e.message);
  }
});

// POST /blogsection/blogpost/delete: ลบ blog post ตาม index
app.post('/blogsection/blogpost/delete', async (req, res) => {
  const { index, sha } = req.body;
  if (typeof index === 'undefined' || !sha) {
    return res.status(400).send('ต้องระบุ index และ sha');
  }
  try {
    // อ่านไฟล์ BlogSection.jsx เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractBlogSectionConfig(content);
    if (!config) return res.status(500).send('อ่าน config object ไม่สำเร็จ');
    const posts = config.blogPosts || [];
    if (index < 0 || index >= posts.length) return res.status(400).send('index ไม่ถูกต้อง');
    // ลบไฟล์ SVG ที่เกี่ยวข้อง
    const removedPost = posts[index];
    const filename = removedPost.image; // เช่น 'blog3.svg'
    const varName = filename.replace('.svg', '');
    const svgPath = `src/components/Blog/${filename}`;
    // หา sha ของไฟล์ SVG ก่อนลบ
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    if (svgSha) {
      // ลบไฟล์ SVG จริงผ่าน GitHub API
      const delUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      await axios.delete(delUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
        data: {
          message: `ลบไฟล์ SVG ${filename} ผ่าน admin tool (ลบ blog post)` ,
          sha: svgSha
        }
      });
    }
    // ลบ object ใน blogPosts
    posts.splice(index, 1);
    config.blogPosts = posts;
    // --- ลบ import และ imageMap ---
    content = removeBlogImport(content, filename);
    content = removeBlogImageMapEntry(content, filename);
    // สร้างไฟล์ใหม่
    const newContent = replaceBlogSectionConfig(content, config);
    // push BlogSection.jsx
    const encodedBlog = Buffer.from(newContent, 'utf8').toString('base64');
    const blogUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${BLOGSECTION_PATH}`;
    await axios.put(blogUrl, {
      message: 'ลบ blog post, import, imageMap และไฟล์ SVG ผ่าน admin tool',
      content: encodedBlog,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('ลบ blog post, import, imageMap และไฟล์ SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('ลบ blog post ไม่สำเร็จ: ' + e.message);
  }
});

// --- Blog SVG Preview Proxy ---
const BLOG_SVG_RAW_BASE = 'https://raw.githubusercontent.com/PtrwTg/Thainest/main/src/components/Blog/';

app.get('/blog-svg-preview/:filename', async (req, res) => {
  const filename = req.params.filename;
  const svgUrl = BLOG_SVG_RAW_BASE + filename;
  try {
    // ดึง SVG จาก GitHub
    const response = await axios.get(svgUrl);
    const svg = response.data;
    // extract base64 PNG
    const match = svg.match(/xlink:href="data:image\/png;base64,([^"]+)"/);
    if (match) {
      // ถ้ามี base64 PNG ให้ส่งเป็น PNG
      const b64 = match[1];
      const imgBuffer = Buffer.from(b64, 'base64');
      res.set('Content-Type', 'image/png');
      return res.send(imgBuffer);
    } else {
      // ถ้าไม่มี base64 PNG ให้ส่ง SVG เดิม
      res.set('Content-Type', 'image/svg+xml');
      return res.send(svg);
    }
  } catch (e) {
    res.status(500).send('โหลดหรือแปลง SVG ไม่สำเร็จ: ' + e.message);
  }
});


// === Contact.jsx Config ===
const CONTACT_PATH = 'src/components/Contact/Contact.jsx';

function extractContactConfig(content) {
  // ดึง object แบบ greedy (หยุดที่ }; ที่ขึ้นต้นบรรทัด)
  const match = content.match(/const\s+contactConfig\s*=\s*({[\s\S]*?^};)/m);
  if (!match) return null;
  const objCode = match[1];
  try {
    // ใช้ Function constructor เพื่อรองรับ template string/backtick
    const obj = Function('return ' + objCode)();
    return obj;
  } catch (e) {
    console.error('extractContactConfig error:', e, objCode);
    return null;
  }
}

function replaceContactConfig(content, newObj) {
  // stringify object (ใช้ 2 space เพื่อความอ่านง่าย)
  const newObjStr = JSON.stringify(newObj, null, 2);
  // แทนที่ object เดิม
  return content.replace(
    /const\s+contactConfig\s*=\s*{[\s\S]*?^};/m,
    `const contactConfig = ${newObjStr};`
  );
}

// GET /contact-config: อ่าน contactConfig object
app.get('/contact-config', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONTACT_PATH}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    const config = extractContactConfig(content);
    if (!config) return res.status(500).send('อ่าน contactConfig object ไม่สำเร็จ');
    res.send({ ...config, sha });
  } catch (e) {
    res.status(500).send('อ่าน Contact.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /contact-config: แก้ไข contactConfig object
app.post('/contact-config', async (req, res) => {
  const { contactConfig, sha } = req.body;
  if (!sha || !contactConfig) return res.status(400).send('ต้องระบุ sha และ contactConfig');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONTACT_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractContactConfig(content);
    if (!config) return res.status(500).send('อ่าน contactConfig object ไม่สำเร็จ');
    // อัปเดตค่าทั้ง object
    Object.assign(config, contactConfig);
    // สร้างไฟล์ใหม่
    const newContent = replaceContactConfig(content, config);
    // push กลับเข้า git
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${CONTACT_PATH}`;
    await axios.put(putUrl, {
      message: 'แก้ไข contactConfig ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข Contact.jsx (contactConfig) และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข Contact.jsx ไม่สำเร็จ: ' + e.message);
  }
});


// === Services.jsx Config ===
const SERVICES_PATH = 'src/page/Services.jsx';
const PUBLIC_IMAGES_PATH = 'public/assets/images/';

function extractServicesConfig(content) {
  // ดึง object แบบ greedy (หยุดที่ }; ที่ขึ้นต้นบรรทัด)
  const match = content.match(/const\s+servicesConfig\s*=\s*({[\s\S]*?^};)/m);
  if (!match) return null;
  const objCode = match[1];
  try {
    // ใช้ Function constructor เพื่อรองรับ template string/backtick
    const obj = Function('return ' + objCode)();
    return obj;
  } catch (e) {
    console.error('extractServicesConfig error:', e, objCode);
    return null;
  }
}

function replaceServicesConfig(content, newObj) {
  // stringify object (ใช้ 2 space เพื่อความอ่านง่าย)
  const newObjStr = JSON.stringify(newObj, null, 2);
  // แทนที่ object เดิม
  return content.replace(
    /const\s+servicesConfig\s*=\s*{[\s\S]*?^};/m,
    `const servicesConfig = ${newObjStr};`
  );
}

// GET /services-config: อ่าน servicesConfig object
app.get('/services-config', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${SERVICES_PATH}`;
    const response = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const sha = response.data.sha;
    const config = extractServicesConfig(content);
    if (!config) return res.status(500).send('อ่าน servicesConfig object ไม่สำเร็จ');
    res.send({ ...config, sha });
  } catch (e) {
    res.status(500).send('อ่าน Services.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /services-config: แก้ไข servicesConfig object (ทุก field)
app.post('/services-config', async (req, res) => {
  const { servicesConfig, sha } = req.body;
  if (!sha || !servicesConfig) return res.status(400).send('ต้องระบุ sha และ servicesConfig');
  try {
    // อ่านไฟล์เดิม
    const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${SERVICES_PATH}`;
    const response = await axios.get(getUrl, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    let content = Buffer.from(response.data.content, 'base64').toString('utf8');
    let config = extractServicesConfig(content);
    if (!config) return res.status(500).send('อ่าน servicesConfig object ไม่สำเร็จ');
    // อัปเดตค่าทั้ง object
    Object.assign(config, servicesConfig);
    // สร้างไฟล์ใหม่
    const newContent = replaceServicesConfig(content, config);
    // push กลับเข้า git
    const encodedContent = Buffer.from(newContent, 'utf8').toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${SERVICES_PATH}`;
    await axios.put(putUrl, {
      message: 'แก้ไข servicesConfig ผ่าน admin tool',
      content: encodedContent,
      sha: sha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('แก้ไข Services.jsx (servicesConfig) และ push ขึ้น GitHub สำเร็จ!');
  } catch (e) {
    res.status(500).send('แก้ไข Services.jsx ไม่สำเร็จ: ' + e.message);
  }
});

// POST /services/upload-svg: อัปโหลด/เปลี่ยนไฟล์ SVG (heroImg, centerImages, cardlist)
app.post('/services/upload-svg', upload.single('svgfile'), async (req, res) => {
  const { type, index, filename } = req.body;
  if (!req.file || !type || !filename) {
    return res.status(400).send('ต้องอัปโหลดไฟล์ svg, ระบุ type และ filename');
  }
  try {
    // กำหนด path ปลายทาง
    let svgPath = PUBLIC_IMAGES_PATH + filename;
    // หา sha ของไฟล์ SVG เดิม (ถ้ามี)
    let svgSha = undefined;
    try {
      const getUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
      const response = await axios.get(getUrl, {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      });
      svgSha = response.data.sha;
    } catch (e) {}
    // push svg เข้า git
    const encodedContent = req.file.buffer.toString('base64');
    const putUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${svgPath}`;
    await axios.put(putUrl, {
      message: `อัปโหลดไฟล์ SVG ${filename} (${type}) ผ่าน admin tool`,
      content: encodedContent,
      sha: svgSha
    }, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    res.send('อัปโหลดไฟล์ SVG สำเร็จ!');
  } catch (e) {
    res.status(500).send('อัปโหลดไฟล์ SVG ไม่สำเร็จ: ' + e.message);
  }
});


// Static file serving (ถ้าต้องการ serve local asset)
app.use('/assets', express.static('public/assets'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Thainest Admin Server started on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
});
