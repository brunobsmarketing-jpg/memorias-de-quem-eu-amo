import { PageTemplateDef, MemoryBookPage } from '../types';
import { loadImage, drawImageCoverRect, wrapCanvasText } from './imageUtils';

/** Resolve o valor de texto salvo pra um bloco, caindo pro texto padrão do template se ainda
 * não foi editado pelo usuário. Substitui o placeholder {fatherName} pelo nome real do pai. */
export function resolveBookTextValue(
  template: PageTemplateDef,
  page: MemoryBookPage,
  blockId: string,
  fatherName: string
): string {
  const saved = page.textValues.find((t) => t.blockId === blockId)?.text;
  const block = template.textBlocks.find((b) => b.id === blockId);
  const raw = saved ?? block?.defaultText ?? '';
  return raw.replace('{fatherName}', fatherName || 'Meu Pai');
}

/** Desenha o fundo preto + furos de perfuração de cada tira de filme, colados nas bordas de
 * cada coluna de fotos (não nas bordas da página inteira) — os slots do template já vêm
 * organizados em colunas verticais, então agrupamos por posição X pra saber onde cada tira
 * começa e termina. */
function drawFilmstripBackground(ctx: CanvasRenderingContext2D, width: number, height: number, template: PageTemplateDef) {
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, width, height);

  const holeRadius = width * 0.01;
  const holeSpacingY = height * 0.045;
  const holeOffset = holeRadius * 2.4;

  const columns = new Map<string, { left: number; right: number; top: number; bottom: number }>();
  template.slots.forEach((slot) => {
    const key = slot.x.toFixed(3);
    const left = slot.x * width;
    const right = (slot.x + slot.width) * width;
    const top = slot.y * height;
    const bottom = (slot.y + slot.height) * height;
    const existing = columns.get(key);
    if (existing) {
      existing.top = Math.min(existing.top, top);
      existing.bottom = Math.max(existing.bottom, bottom);
    } else {
      columns.set(key, { left, right, top, bottom });
    }
  });

  ctx.fillStyle = '#f5f5f5';
  columns.forEach((col) => {
    const leftX = col.left - holeOffset;
    const rightX = col.right + holeOffset;
    for (let y = col.top + holeSpacingY / 2; y < col.bottom; y += holeSpacingY) {
      ctx.beginPath();
      ctx.arc(leftX, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(rightX, y, holeRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Desenha uma foto num slot, aplicando a moldura correspondente ao "shape" do slot
 * (retângulo simples, polaroid com borda branca, ou tira de filme). */
async function drawSlotPhoto(
  ctx: CanvasRenderingContext2D,
  slot: PageTemplateDef['slots'][number],
  photoUrl: string,
  canvasWidth: number,
  canvasHeight: number
) {
  const maxX = slot.x * canvasWidth;
  const maxY = slot.y * canvasHeight;
  const maxW = slot.width * canvasWidth;
  const maxH = slot.height * canvasHeight;

  const img = await loadImage(photoUrl);

  // Espaços "adaptiveFit" tratam x/y/width/height como limite máximo: a foto é encaixada
  // preservando a proporção original (retrato ou paisagem), em vez de cortada pra preencher
  // uma caixa de proporção fixa — o quadro (ex: moldura de polaroid) acompanha esse tamanho.
  let x = maxX;
  let y = maxY;
  let w = maxW;
  let h = maxH;
  if (slot.adaptiveFit) {
    const imgAspect = img.width / img.height;
    const maxAspect = maxW / maxH;
    if (imgAspect > maxAspect) {
      w = maxW;
      h = maxW / imgAspect;
    } else {
      h = maxH;
      w = maxH * imgAspect;
    }
    x = maxX + (maxW - w) / 2;
    y = maxY + (maxH - h) / 2;
  }

  ctx.save();
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  if (slot.rotationDeg) {
    ctx.translate(centerX, centerY);
    ctx.rotate((slot.rotationDeg * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  if (slot.shape === 'polaroid') {
    const border = w * 0.035;
    const bottomBorder = border * 3;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    ctx.fillRect(x, y, w, h);
    ctx.shadowColor = 'transparent';
    drawImageCoverRect(ctx, img, x + border, y + border, w - border * 2, h - border - bottomBorder);
  } else if (slot.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
    drawImageCoverRect(ctx, img, x, y, w, h);
  } else if (slot.shape === 'filmstrip') {
    drawImageCoverRect(ctx, img, x, y, w, h);
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = w * 0.006;
    ctx.strokeRect(x, y, w, h);
  } else {
    drawImageCoverRect(ctx, img, x, y, w, h);
  }

  ctx.restore();
}

function drawEmptySlotPlaceholder(ctx: CanvasRenderingContext2D, slot: PageTemplateDef['slots'][number], canvasWidth: number, canvasHeight: number) {
  const x = slot.x * canvasWidth;
  const y = slot.y * canvasHeight;
  const w = slot.width * canvasWidth;
  const h = slot.height * canvasHeight;
  ctx.save();
  ctx.fillStyle = 'rgba(120,113,108,0.12)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(120,113,108,0.4)';
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.restore();
}

/**
 * Desenha uma página completa do Livro de Memórias (fundo, decoração do template, fotos dos
 * slots e blocos de texto) — usado tanto na prévia ao vivo da montagem quanto na exportação
 * final em PNG de cada página.
 */
export async function drawBookPage(
  ctx: CanvasRenderingContext2D,
  template: PageTemplateDef,
  page: MemoryBookPage,
  fatherName: string
): Promise<void> {
  const width = template.canvasWidth;
  const height = template.canvasHeight;

  ctx.clearRect(0, 0, width, height);

  if (template.decoration === 'filmstrip') {
    drawFilmstripBackground(ctx, width, height, template);
  } else {
    ctx.fillStyle = template.backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }

  for (const slot of template.slots) {
    const photoUrl = page.slotValues.find((v) => v.slotId === slot.id)?.photoUrl;
    if (photoUrl) {
      try {
        await drawSlotPhoto(ctx, slot, photoUrl, width, height);
      } catch {
        drawEmptySlotPlaceholder(ctx, slot, width, height);
      }
    } else {
      drawEmptySlotPlaceholder(ctx, slot, width, height);
    }
  }

  for (const block of template.textBlocks) {
    const text = resolveBookTextValue(template, page, block.id, fatherName);
    if (!text) continue;

    const x = block.x * width;
    const blockWidth = block.width * width;
    const y = block.y * height;

    ctx.save();
    ctx.fillStyle = block.colorHex || '#1f2937';
    ctx.font = `${block.fontWeight || '400'} ${block.fontSizePx}px "${block.fontFamily || 'Poppins'}", sans-serif`;
    ctx.textAlign = block.align || 'center';
    ctx.textBaseline = 'top';

    const lines = wrapCanvasText(ctx, text, blockWidth);
    const lineHeight = block.fontSizePx * 1.3;
    const drawX = block.align === 'left' ? x : block.align === 'right' ? x + blockWidth : x + blockWidth / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, drawX, y + i * lineHeight);
    });
    ctx.restore();
  }
}

/** Renderiza a página num canvas fora da tela e devolve o PNG como data URL — usado ao gerar
 * o vídeo final, onde cada página composta vira um "slide" enviado ao servidor. */
export async function exportBookPageToPng(
  template: PageTemplateDef,
  page: MemoryBookPage,
  fatherName: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = template.canvasWidth;
  canvas.height = template.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível criar o contexto de canvas para exportar a página.');
  await drawBookPage(ctx, template, page, fatherName);
  return canvas.toDataURL('image/png');
}
