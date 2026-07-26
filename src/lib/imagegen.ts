export interface VisualTheme {
  titlePt: string;
  promptEn: string;
}

const FALLBACK_THEMES: VisualTheme[] = [
  {
    titlePt: 'Silhueta de Pai e Filho ao Pôr do Sol',
    promptEn: 'Warm sunset silhouette of loving father and child holding hands',
  },
  {
    titlePt: 'Abraço Acolhedor em Família',
    promptEn: 'Warm emotional family embrace, gentle pastel lighting',
  },
  {
    titlePt: 'Árvore Forte de Proteção',
    promptEn: 'A strong sheltering oak tree symbolizing protection and guidance',
  },
  {
    titlePt: 'Casa Acolhedora com Luz Suave',
    promptEn: 'A cozy warmly lit home at dusk, symbol of family and belonging',
  },
  {
    titlePt: 'Coração e Mãos Entrelaçadas',
    promptEn: 'Two hands intertwined gently forming a heart shape, warm symbolic imagery',
  },
];

export async function extractVisualThemesFromText(
  text: string,
  fatherName: string,
  count: number = 2,
  memoryAge: string = 'auto',
  narratorGender: string = 'auto'
): Promise<VisualTheme[]> {
  try {
    const response = await fetch('/api/extract-visual-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fatherName, count, memoryAge, narratorGender }),
    });

    if (!response.ok) {
      throw new Error('Não foi possível extrair temas visuais');
    }

    const data = await response.json();
    return data.scenes || [];
  } catch (e) {
    console.error('Erro na extração de temas:', e);
    return FALLBACK_THEMES.slice(0, count);
  }
}

/**
 * Gera uma ilustração artística usando a API de geração de imagem da OpenAI, no estilo escolhido
 * pelo usuário (aquarela, realista, pintura a óleo, etc.). Retorna uma data URL (base64) da
 * imagem gerada. Em caso de falha, usa um canvas local como fallback.
 */
export async function generateAIIllustrationImage(
  title: string,
  themePrompt: string,
  style: string = 'watercolor'
): Promise<string> {
  try {
    const response = await fetch('/api/generate-ai-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: themePrompt, titlePt: title, style }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Falha na API de geração de imagem');
    }

    const data = await response.json();
    if (!data.imageDataUrl) {
      throw new Error('Resposta sem imagem válida');
    }

    return data.imageDataUrl;
  } catch (e) {
    console.warn('API de geração de imagem falhou, usando fallback canvas:', e);
    return generateCanvasFallback(title, themePrompt);
  }
}

/**
 * Fallback local: gera uma ilustração artística no canvas caso a API de imagem falhe.
 * Versão aprimorada com múltiplas camadas, gradientes e elementos visuais ricos.
 */
function generateCanvasFallback(title: string, themePrompt: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const isSunset = themePrompt.toLowerCase().includes('sunset') || themePrompt.toLowerCase().includes('pôr do sol') || themePrompt.toLowerCase().includes('father');
  const isNature = themePrompt.toLowerCase().includes('tree') || themePrompt.toLowerCase().includes('nature') || themePrompt.toLowerCase().includes('forest');

  // --- Background sky gradient ---
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 750);
  if (isSunset) {
    skyGrad.addColorStop(0, '#1a0533');
    skyGrad.addColorStop(0.3, '#7c2d67');
    skyGrad.addColorStop(0.6, '#f97316');
    skyGrad.addColorStop(0.85, '#fef08a');
    skyGrad.addColorStop(1, '#fde68a');
  } else {
    skyGrad.addColorStop(0, '#0c1445');
    skyGrad.addColorStop(0.4, '#1e3a8a');
    skyGrad.addColorStop(0.7, '#3b82f6');
    skyGrad.addColorStop(1, '#bae6fd');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  // --- Watercolor texture overlays ---
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * 1080;
    const y = Math.random() * 700;
    const r = 80 + Math.random() * 200;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    if (isSunset) {
      grad.addColorStop(0, `rgba(251,191,36,0.12)`);
      grad.addColorStop(1, `rgba(249,115,22,0.0)`);
    } else {
      grad.addColorStop(0, `rgba(147,197,253,0.15)`);
      grad.addColorStop(1, `rgba(59,130,246,0.0)`);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Stars/sparkles in the sky ---
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 30; i++) {
    const sx = Math.random() * 1080;
    const sy = Math.random() * 400;
    const sr = 0.8 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Sun / Moon glow ---
  const glowX = isSunset ? 820 : 200;
  const glowY = isSunset ? 320 : 180;
  const glowGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, 160);
  if (isSunset) {
    glowGrad.addColorStop(0, 'rgba(254,240,138,0.95)');
    glowGrad.addColorStop(0.3, 'rgba(251,191,36,0.5)');
    glowGrad.addColorStop(1, 'rgba(249,115,22,0.0)');
  } else {
    glowGrad.addColorStop(0, 'rgba(255,255,240,0.9)');
    glowGrad.addColorStop(0.3, 'rgba(186,230,253,0.4)');
    glowGrad.addColorStop(1, 'rgba(59,130,246,0.0)');
  }
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, 1080, 1080);

  // --- Horizon fog layer ---
  const fogGrad = ctx.createLinearGradient(0, 650, 0, 800);
  fogGrad.addColorStop(0, 'rgba(254,243,199,0.0)');
  fogGrad.addColorStop(0.5, 'rgba(254,243,199,0.35)');
  fogGrad.addColorStop(1, 'rgba(254,243,199,0.0)');
  ctx.fillStyle = fogGrad;
  ctx.fillRect(0, 650, 1080, 150);

  // --- Ground ---
  const groundGrad = ctx.createLinearGradient(0, 750, 0, 1080);
  if (isSunset) {
    groundGrad.addColorStop(0, '#78350f');
    groundGrad.addColorStop(0.4, '#451a03');
    groundGrad.addColorStop(1, '#1c0a00');
  } else {
    groundGrad.addColorStop(0, '#14532d');
    groundGrad.addColorStop(0.5, '#052e16');
    groundGrad.addColorStop(1, '#020f08');
  }
  ctx.fillStyle = groundGrad;
  ctx.beginPath();
  ctx.moveTo(0, 800);
  ctx.bezierCurveTo(270, 730, 810, 790, 1080, 750);
  ctx.lineTo(1080, 1080);
  ctx.lineTo(0, 1080);
  ctx.closePath();
  ctx.fill();

  // --- Tree (left side) ---
  if (!isSunset || isNature) {
    ctx.fillStyle = 'rgba(15, 30, 15, 0.8)';
    ctx.fillRect(140, 580, 18, 200);
    ctx.beginPath();
    ctx.moveTo(149, 380);
    ctx.lineTo(80, 590);
    ctx.lineTo(220, 590);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(149, 460);
    ctx.lineTo(90, 630);
    ctx.lineTo(210, 630);
    ctx.closePath();
    ctx.fill();
  }

  // --- Father silhouette ---
  ctx.fillStyle = 'rgba(15, 10, 5, 0.88)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  // Body
  ctx.beginPath();
  ctx.ellipse(470, 700, 52, 115, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(470, 560, 46, 0, Math.PI * 2);
  ctx.fill();
  // Arms
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(15, 10, 5, 0.88)';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(520, 660);
  ctx.quadraticCurveTo(580, 700, 600, 740);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(420, 660);
  ctx.quadraticCurveTo(360, 690, 340, 720);
  ctx.stroke();

  // --- Child silhouette ---
  // Body
  ctx.beginPath();
  ctx.ellipse(615, 750, 34, 75, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(615, 652, 30, 0, Math.PI * 2);
  ctx.fill();
  // Arm holding father
  ctx.beginPath();
  ctx.moveTo(594, 720);
  ctx.quadraticCurveTo(555, 730, 530, 745);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // --- Floating heart ---
  const heartX = 543, heartY = 420;
  ctx.fillStyle = isSunset ? 'rgba(251,113,133,0.9)' : 'rgba(252,165,165,0.85)';
  ctx.beginPath();
  ctx.moveTo(heartX, heartY + 14);
  ctx.bezierCurveTo(heartX, heartY + 8, heartX - 8, heartY, heartX - 14, heartY);
  ctx.bezierCurveTo(heartX - 22, heartY, heartX - 22, heartY + 10, heartX - 22, heartY + 10);
  ctx.bezierCurveTo(heartX - 22, heartY + 18, heartX - 14, heartY + 26, heartX, heartY + 36);
  ctx.bezierCurveTo(heartX + 14, heartY + 26, heartX + 22, heartY + 18, heartX + 22, heartY + 10);
  ctx.bezierCurveTo(heartX + 22, heartY + 10, heartX + 22, heartY, heartX + 14, heartY);
  ctx.bezierCurveTo(heartX + 8, heartY, heartX, heartY + 8, heartX, heartY + 14);
  ctx.fill();

  // --- Title badge ---
  ctx.fillStyle = 'rgba(10, 10, 20, 0.72)';
  const badgeY = 60;
  const badgeH = 130;
  if (ctx.roundRect) {
    ctx.roundRect(80, badgeY, 920, badgeH, 28);
  } else {
    ctx.fillRect(80, badgeY, 920, badgeH);
  }
  ctx.fill();

  ctx.fillStyle = isSunset ? '#fde68a' : '#bae6fd';
  ctx.font = 'bold 28px "Plus Jakarta Sans", Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦ Ilustração Poética — Dia dos Pais ✦', 540, badgeY + 38);

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '500 34px "Plus Jakarta Sans", Georgia, serif';
  const shortTitle = title.length > 44 ? title.slice(0, 44) + '…' : title;
  ctx.fillText(`"${shortTitle}"`, 540, badgeY + 92);

  return canvas.toDataURL('image/png');
}

