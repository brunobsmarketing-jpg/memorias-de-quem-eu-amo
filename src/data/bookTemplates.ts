import { PageTemplateDef } from '../types';

// Todas as páginas do Livro de Memórias usam o mesmo tamanho de canvas (proporção 4:5, formato
// "página de revista") — isso simplifica o render final em vídeo, que trata cada página como um
// slide de mesmo tamanho, sem precisar reescalar de forma diferente por template.
export const BOOK_PAGE_WIDTH = 1080;
export const BOOK_PAGE_HEIGHT = 1350;

/**
 * Catálogo estático dos templates de página do MVP (mesmo espírito de data/presets.ts).
 * Slots e blocos de texto são definidos em frações (0-1) do canvas, para o mesmo template
 * funcionar tanto na prévia em canvas quanto no export final em PNG.
 */
export const BOOK_PAGE_TEMPLATES: PageTemplateDef[] = [
  {
    id: 'cover',
    name: 'Capa',
    description: 'Uma foto de destaque com o título da homenagem.',
    canvasWidth: BOOK_PAGE_WIDTH,
    canvasHeight: BOOK_PAGE_HEIGHT,
    backgroundColor: '#faf6ee',
    slots: [{ id: 'main', x: 0, y: 0, width: 1, height: 0.72, shape: 'rect' }],
    textBlocks: [
      {
        id: 'title',
        x: 0.08,
        y: 0.78,
        width: 0.84,
        label: 'Título da capa',
        defaultText: 'Homenagem para {fatherName}',
        maxChars: 60,
        fontSizePx: 58,
        fontWeight: '700',
        fontFamily: 'Playfair Display',
        align: 'center',
        colorHex: '#1f2937',
      },
      {
        id: 'subtitle',
        x: 0.1,
        y: 0.9,
        width: 0.8,
        label: 'Subtítulo',
        defaultText: 'Um álbum de memórias feito com carinho',
        maxChars: 80,
        fontSizePx: 26,
        fontWeight: '500',
        fontFamily: 'Poppins',
        align: 'center',
        colorHex: '#57534e',
      },
    ],
  },
  {
    id: 'mosaic',
    name: 'Colagem em Mosaico',
    description: 'Cinco fotos em um mosaico estilo álbum de família.',
    canvasWidth: BOOK_PAGE_WIDTH,
    canvasHeight: BOOK_PAGE_HEIGHT,
    backgroundColor: '#ffffff',
    slots: [
      { id: 'slot1', x: 0.05, y: 0.06, width: 0.52, height: 0.36, shape: 'polaroid', rotationDeg: -2 },
      { id: 'slot2', x: 0.6, y: 0.05, width: 0.35, height: 0.22, shape: 'polaroid', rotationDeg: 3 },
      { id: 'slot3', x: 0.6, y: 0.29, width: 0.35, height: 0.18, shape: 'polaroid', rotationDeg: -1.5 },
      { id: 'slot4', x: 0.05, y: 0.46, width: 0.43, height: 0.3, shape: 'polaroid', rotationDeg: 2 },
      { id: 'slot5', x: 0.51, y: 0.5, width: 0.44, height: 0.26, shape: 'polaroid', rotationDeg: -2.5 },
    ],
    textBlocks: [
      {
        id: 'heading',
        x: 0.08,
        y: 0.86,
        width: 0.84,
        label: 'Título da página',
        defaultText: 'Nossa Família',
        maxChars: 40,
        fontSizePx: 40,
        fontWeight: '700',
        fontFamily: 'Playfair Display',
        align: 'center',
        colorHex: '#1f2937',
      },
    ],
  },
  {
    id: 'filmstrip',
    name: 'Tiras de Filme',
    description: 'Quatro fotos verticais dispostas em duas tiras de filme lado a lado.',
    canvasWidth: BOOK_PAGE_WIDTH,
    canvasHeight: BOOK_PAGE_HEIGHT,
    backgroundColor: '#111111',
    decoration: 'filmstrip',
    // Cada quadro é vertical (retrato), como uma foto de celular normal — duas tiras lado a
    // lado, cada uma com 2 fotos empilhadas, em vez de uma única tira horizontal larga (que
    // cortava demais fotos verticais ao preencher o quadro).
    slots: [
      { id: 'slot1', x: 0.08, y: 0.12, width: 0.38, height: 0.41, shape: 'filmstrip' },
      { id: 'slot2', x: 0.08, y: 0.55, width: 0.38, height: 0.41, shape: 'filmstrip' },
      { id: 'slot3', x: 0.54, y: 0.12, width: 0.38, height: 0.41, shape: 'filmstrip' },
      { id: 'slot4', x: 0.54, y: 0.55, width: 0.38, height: 0.41, shape: 'filmstrip' },
    ],
    textBlocks: [
      {
        id: 'heading',
        x: 0.08,
        y: 0.02,
        width: 0.84,
        label: 'Título da página',
        defaultText: 'Nossa Linha do Tempo',
        maxChars: 40,
        fontSizePx: 32,
        fontWeight: '700',
        fontFamily: 'Poppins',
        align: 'center',
        colorHex: '#ffffff',
      },
    ],
  },
  {
    id: 'letter',
    name: 'Carta/Citação',
    description: 'Uma foto ao lado de um texto de homenagem.',
    canvasWidth: BOOK_PAGE_WIDTH,
    canvasHeight: BOOK_PAGE_HEIGHT,
    backgroundColor: '#fdf6e9',
    slots: [{ id: 'main', x: 0.08, y: 0.08, width: 0.84, height: 0.42, shape: 'polaroid' }],
    textBlocks: [
      {
        id: 'heading',
        x: 0.1,
        y: 0.55,
        width: 0.8,
        label: 'Título da página',
        defaultText: 'O Que Eu Aprendi Com Você',
        maxChars: 50,
        fontSizePx: 38,
        fontWeight: '700',
        fontFamily: 'Playfair Display',
        align: 'center',
        colorHex: '#78350f',
      },
      {
        id: 'quote',
        x: 0.1,
        y: 0.64,
        width: 0.8,
        label: 'Texto da homenagem',
        defaultText: 'Pai, obrigado por cada conselho, cada abraço e cada momento de carinho.',
        maxChars: 320,
        fontSizePx: 26,
        fontWeight: '400',
        fontFamily: 'Poppins',
        align: 'center',
        colorHex: '#44403c',
      },
    ],
  },
];

export function getBookTemplateById(id: string): PageTemplateDef {
  return BOOK_PAGE_TEMPLATES.find((t) => t.id === id) || BOOK_PAGE_TEMPLATES[0];
}
