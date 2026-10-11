/**
 * Original media extracted from approved KP DOCX (kp2705 / kp2699).
 * Binaries also kept under src/assets/kp-template/ — see mapping.json for SHA-256.
 * Runtime loads from embedded base64 so browser + vitest both work without fetch/fs.
 */
import { KP_TEMPLATE_PNG_BASE64, pngBase64ToBytes } from './kpTemplatePngBase64';

export type KpTemplateImages = {
  logo: Uint8Array;
  redLine: Uint8Array;
  signature: Uint8Array;
  stamp: Uint8Array;
};

let cached: KpTemplateImages | null = null;

export async function loadKpTemplateImages(): Promise<KpTemplateImages> {
  if (cached) return cached;
  cached = {
    logo: pngBase64ToBytes(KP_TEMPLATE_PNG_BASE64.logo),
    redLine: pngBase64ToBytes(KP_TEMPLATE_PNG_BASE64.redLine),
    signature: pngBase64ToBytes(KP_TEMPLATE_PNG_BASE64.signature),
    stamp: pngBase64ToBytes(KP_TEMPLATE_PNG_BASE64.stamp),
  };
  return cached;
}

/** Display sizes from kp2705 OOXML (approx). */
export const KP_IMAGE_SIZES = {
  logo: { width: 119.25, height: 24.22 },
  redLine: { width: 480, height: 1 },
  signature: { width: 119.5, height: 51.4 },
  stamp: { width: 103, height: 99.5 },
} as const;

/** Table column widths in twips (kp2705 canonical). */
export const KP_TABLE_COL_TWIPS = [465, 1688, 3517, 990, 1560, 1665] as const;
