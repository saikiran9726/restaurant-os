/**
 * Pure ESC/POS Command Builder for 58mm and 80mm thermal receipt printers.
 * Generates standards-compliant Uint8Array byte sequences without native dependencies.
 */

export interface EscPosOptions {
  widthMm?: 58 | 80;
  charsPerLine?: number; // 58mm: usually 32 (or 30-36); 80mm: usually 48 (or 42-48)
  rupeeMode?: 'text_rs' | 'symbol' | 'image';
  codePage?: number; // ESC/POS code page table (0 = CP437, 16 = WPC1252)
}

export interface TableColumn {
  text: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export class EscPosBuilder {
  private chunks: Uint8Array[] = [];
  public readonly widthMm: 58 | 80;
  public readonly charsPerLine: number;
  public readonly rupeeMode: 'text_rs' | 'symbol' | 'image';
  public readonly codePage: number;

  constructor(options: EscPosOptions = {}) {
    this.widthMm = options.widthMm ?? 80;
    this.charsPerLine = options.charsPerLine ?? (this.widthMm === 58 ? 32 : 48);
    this.rupeeMode = options.rupeeMode ?? 'text_rs';
    this.codePage = options.codePage ?? 0;
  }

  private append(bytes: number[] | Uint8Array): this {
    if (bytes instanceof Uint8Array) {
      this.chunks.push(bytes);
    } else {
      this.chunks.push(new Uint8Array(bytes));
    }
    return this;
  }

  /**
   * Initializes printer hardware (ESC @: 0x1B 0x40).
   * Clears buffer, resets print mode and alignment.
   */
  public init(): this {
    this.append([0x1b, 0x40]);
    if (this.codePage !== 0) {
      this.selectCodePage(this.codePage);
    }
    return this;
  }

  /**
   * Selects code page table (ESC t n).
   */
  public selectCodePage(page: number): this {
    return this.append([0x1b, 0x74, page & 0xff]);
  }

  /**
   * Sets text alignment (ESC a n: 0=Left, 1=Center, 2=Right).
   */
  public align(alignment: 'left' | 'center' | 'right'): this {
    const n = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    return this.append([0x1b, 0x61, n]);
  }

  /**
   * Toggles bold mode (ESC E n).
   */
  public bold(enable = true): this {
    return this.append([0x1b, 0x45, enable ? 1 : 0]);
  }

  /**
   * Toggles double width & double height (GS ! n).
   */
  public doubleSize(enable = true): this {
    return this.append([0x1d, 0x21, enable ? 0x11 : 0x00]);
  }

  /**
   * Toggles double height only.
   */
  public doubleHeight(enable = true): this {
    return this.append([0x1d, 0x21, enable ? 0x01 : 0x00]);
  }

  /**
   * Toggles double width only.
   */
  public doubleWidth(enable = true): this {
    return this.append([0x1d, 0x21, enable ? 0x10 : 0x00]);
  }

  /**
   * Toggles underline (ESC - n).
   */
  public underline(enable = true): this {
    return this.append([0x1b, 0x2d, enable ? 1 : 0]);
  }

  /**
   * Toggles reverse / white-on-black printing (GS B n).
   */
  public invert(enable = true): this {
    return this.append([0x1d, 0x42, enable ? 1 : 0]);
  }

  /**
   * Feeds n lines (LF: 0x0A or ESC d n).
   */
  public feed(lines = 1): this {
    if (lines <= 0) return this;
    if (lines === 1) {
      return this.append([0x0a]);
    }
    return this.append([0x1b, 0x64, Math.min(lines, 255)]);
  }

  /**
   * Encodes a string into byte array, respecting Rupee symbol configuration.
   */
  public text(str: string): this {
    if (!str) return this;
    let formatted = str;
    if (this.rupeeMode === 'text_rs') {
      formatted = formatted.replace(/₹/g, 'Rs.');
    }
    const encoder = new TextEncoder();
    return this.append(encoder.encode(formatted));
  }

  /**
   * Prints text followed by a line feed.
   */
  public textLine(str = ''): this {
    this.text(str);
    return this.append([0x0a]);
  }

  /**
   * Prints a divider line filled with char (e.g. '---', '===') matching charsPerLine.
   */
  public horizontalLine(char = '-'): this {
    const singleChar = char[0] || '-';
    return this.textLine(singleChar.repeat(this.charsPerLine));
  }

  /**
   * Formats two columns across the width (Left-aligned col1, Right-aligned col2).
   * Automatically handles wrapping when col1 is long.
   */
  public twoColumn(left: string, right: string): this {
    let cleanLeft = left;
    let cleanRight = right;
    if (this.rupeeMode === 'text_rs') {
      cleanLeft = cleanLeft.replace(/₹/g, 'Rs.');
      cleanRight = cleanRight.replace(/₹/g, 'Rs.');
    }

    const rightLen = cleanRight.length;
    const maxLeftLen = this.charsPerLine - rightLen - 1;

    if (cleanLeft.length <= maxLeftLen) {
      const spaces = this.charsPerLine - cleanLeft.length - rightLen;
      return this.textLine(cleanLeft + ' '.repeat(Math.max(1, spaces)) + cleanRight);
    }

    // Left column is longer than available single line space:
    // Wrap left column lines, printing right on the final line or on a separate right-aligned line
    const firstLineLeft = cleanLeft.slice(0, maxLeftLen);
    const remainderLeft = cleanLeft.slice(maxLeftLen).trim();
    const spaces = this.charsPerLine - firstLineLeft.length - rightLen;
    this.textLine(firstLineLeft + ' '.repeat(Math.max(1, spaces)) + cleanRight);

    if (remainderLeft.length > 0) {
      this.textLine('  ' + remainderLeft);
    }
    return this;
  }

  /**
   * Formats a row of multiple columns with fixed widths and alignment.
   */
  public tableRow(cols: TableColumn[]): this {
    let line = '';
    for (const col of cols) {
      let t = col.text;
      if (this.rupeeMode === 'text_rs') {
        t = t.replace(/₹/g, 'Rs.');
      }
      const width = col.width;
      const align = col.align ?? 'left';

      if (t.length > width) {
        t = t.slice(0, width);
      }

      const diff = width - t.length;
      if (align === 'right') {
        line += ' '.repeat(diff) + t;
      } else if (align === 'center') {
        const leftPad = Math.floor(diff / 2);
        const rightPad = diff - leftPad;
        line += ' '.repeat(leftPad) + t + ' '.repeat(rightPad);
      } else {
        line += t + ' '.repeat(diff);
      }
    }
    return this.textLine(line);
  }

  /**
   * Generates native ESC/POS QR code commands using Model 2 (GS ( k).
   */
  public qrCode(
    data: string,
    options: { size?: number; errorCorrection?: 'L' | 'M' | 'Q' | 'H' } = {},
  ): this {
    const size = Math.min(Math.max(options.size ?? 4, 1), 16);
    const ecCode =
      options.errorCorrection === 'H'
        ? 51
        : options.errorCorrection === 'Q'
          ? 50
          : options.errorCorrection === 'M'
            ? 49
            : 48; // 'L' is default

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const storeLen = dataBytes.length + 3;
    const pL = storeLen & 0xff;
    const pH = (storeLen >> 8) & 0xff;

    // 1. Function 165: Select QR Model 2
    this.append([0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]);

    // 2. Function 167: Set QR Module Size
    this.append([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]);

    // 3. Function 169: Set Error Correction Level
    this.append([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecCode]);

    // 4. Function 180: Store QR Data in Symbol Storage Area
    const storeHeader = [0x1d, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30];
    const storePacket = new Uint8Array(storeHeader.length + dataBytes.length);
    storePacket.set(storeHeader, 0);
    storePacket.set(dataBytes, storeHeader.length);
    this.append(storePacket);

    // 5. Function 181: Print QR code from storage
    this.append([0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]);

    return this;
  }

  /**
   * Prints ESC/POS raster bit image (GS v 0).
   * Useful as a fallback for printers lacking native GS ( k QR support or for non-Latin item names.
   */
  public rasterImage(widthPx: number, heightPx: number, bitmapData: Uint8Array): this {
    const widthBytes = Math.ceil(widthPx / 8);
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightPx & 0xff;
    const yH = (heightPx >> 8) & 0xff;

    const header = [0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH];
    this.append(header);
    this.append(bitmapData);
    return this;
  }

  /**
   * Sends cash drawer kick pulse (ESC p m t1 t2).
   * @param pin 2 for Drawer Pin 2 (standard), 5 for Drawer Pin 5
   */
  public pulseDrawer(pin: 2 | 5 = 2): this {
    const m = pin === 2 ? 0 : 1;
    return this.append([0x1b, 0x70, m, 0x19, 0xfa]);
  }

  /**
   * Cuts paper (GS V m n).
   * @param partial True for partial cut (leaving tab), False for full cut.
   */
  public cut(partial = true): this {
    // Feed 3 blank lines before cutting so text is past the cutter blade
    this.feed(3);
    const cutMode = partial ? 66 : 65;
    return this.append([0x1d, 0x56, cutMode, 0x00]);
  }

  /**
   * Compiles and outputs complete binary Uint8Array command stream.
   */
  public build(): Uint8Array {
    let totalLength = 0;
    for (const chunk of this.chunks) {
      totalLength += chunk.length;
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  /**
   * Helper to return Base64 string for transmission over native bridges or JSON payloads.
   */
  public toBase64(): string {
    const bytes = this.build();
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  }
}
