import JSZip from "jszip";

export type DetectorConfig = {
  filter: string;
  fluorophores: string[];
  commonFluorophore: string | null;
};

export type CytometerConfig = {
  name: string;
  detectors: DetectorConfig[];
};

export type ConfigBootstrap = {
  defaultConfig: string;
  configs: CytometerConfig[];
};

export type ChannelRecord = {
  index: number;
  detector: string;
  originalPrimaryName: string;
  primaryName: string;
  secondaryName: string;
  fluorescence: boolean;
};

export type MetadataEntry = {
  key: string;
  value: string;
};

type ParsedOffsets = {
  textStart: number;
  textEnd: number;
  dataStart: number;
  dataEnd: number;
  analysisStart: number;
  analysisEnd: number;
};

type RawFcsFile = {
  bytes: Uint8Array;
  version: string;
  delimiter: string;
  keywordOrder: string[];
  keywords: Map<string, string>;
  offsets: ParsedOffsets;
};

export type FcsFileRecord = {
  path: string;
  directory: string;
  fileName: string;
  originalBaseName: string;
  outputBaseName: string;
  sizeBytes: number;
  eventCount: number;
  parameterCount: number;
  channels: ChannelRecord[];
  parameters: MetadataEntry[];
  raw: RawFcsFile;
};

export type ChannelEdit = {
  originalPrimaryName: string;
  primaryName: string;
  secondaryName: string;
};

export type ExportBundle = {
  zipBlob: Blob;
  zipName: string;
  createdFiles: string[];
  warnings: string[];
};

const DEFAULT_CONFIG = "BD Fortessa 3L";

function detector(filter: string, fluorophores: string[]): DetectorConfig {
  return {
    filter,
    fluorophores,
    commonFluorophore: fluorophores[0] ?? null,
  };
}

const CYTOMETER_CONFIGS: CytometerConfig[] = [
  {
    name: "BD Fortessa 3L",
    detectors: [
      detector("450/50-V-A", ["BV421", "Alexa 405", "eFluor 450", "Hoechst", "Pacific Blue", "DAPI", "Sytox"]),
      detector("525/50-V-A", ["BV510", "AmCyan", "V500", "Qdot 525", "Krome Orange", "Pacific Orange"]),
      detector("610/20-V-A", ["BV605", "eFluor 605NC", "Qdot 605"]),
      detector("670/30-V-A", ["BV650", "eFluor 650NC", "Qdot 655"]),
      detector("710/50-V-A", ["BV711", "eFluor 700NC", "Qdot 705"]),
      detector("780/60-V-A", ["BV786", "Qdot 800"]),
      detector("488/10-B-A", ["SSC"]),
      detector("525/50-B-A", ["FITC", "GFP", "Alexa 488", "CFSE"]),
      detector("575/26-B-A", ["PE", "PKH26"]),
      detector("610/20-B-A", ["PE-CF594", "Texas Red", "PE-Texas Red", "PI"]),
      detector("695/40-B-A", ["PerCP-Cy5.5", "PerCP", "PE-Cy5", "7AAD", "PE-Cy5.5", "PerCP eFluor 710"]),
      detector("780/60-B-A", ["PE-Cy7", "PE-CY7", "PC7", "PE-Vio 7"]),
      detector("670/30-R-A", ["APC", "Alexa 647", "TOPRO-3", "TOTO-3", "eFluor 660"]),
      detector("730/45-R-A", ["Alexa Fluor 700", "Alexa 700", "eFluor 710", "APC-Alexa 700"]),
      detector("780/60-R-A", ["APC-Cy7", "Alexa Fluor 750", "APC-Vio 770", "APC-eFluor 780", "APC-H7"]),
    ],
  },
  {
    name: "BD Fortessa 4L",
    detectors: [
      detector("450/50-V-A", ["BV421", "Alexa 405", "eFluor 450", "Pacific Blue", "DAPI", "Sytox"]),
      detector("525/50-V-A", ["BV510"]),
      detector("610/20-V-A", ["BV605"]),
      detector("670/30-V-A", ["BV650"]),
      detector("710/50-V-A", ["BV711"]),
      detector("780/60-V-A", ["BV786"]),
      detector("488/10-B-A", ["SSC"]),
      detector("529/24-B-A", ["FITC", "Alexa 488", "GFP"]),
      detector("695/40-B-A", ["PerCP-Cy5.5", "PerCP", "PerCP eFluor 710"]),
      detector("582/15-YG-A", ["PE"]),
      detector("610/20-YG-A", ["PE-CF 594", "mCherry", "PE-Texas Red", "PI", "7AAD"]),
      detector("670/14-YG-A", ["PE-Cy5"]),
      detector("710/50-YG-A", ["PE-Cy5.5"]),
      detector("780/60-YG-A", ["PE-CY7"]),
      detector("670/30-R-A", ["APC", "Alexa Fluor 647", "eFluor 660"]),
      detector("730/45-R-A", ["Alexa Fluor 700"]),
      detector("780/60-R-A", ["APC-Cy7", "Alexa Fluor 750", "APC-eFluor 780", "APC-H7"]),
    ],
  },
];

function decodeLatin1(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let output = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    output += String.fromCharCode(...chunk);
  }
  return output;
}

function encodeLatin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function parseOffset(value: string): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sliceInclusive(bytes: Uint8Array, start: number, end: number): Uint8Array {
  if (start < 0 || end < start || end >= bytes.length) {
    throw new Error(`Invalid segment range ${start}-${end} for file size ${bytes.length}`);
  }
  return bytes.subarray(start, end + 1);
}

function splitEscaped(text: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== delimiter) {
      current += char;
      continue;
    }

    const next = text[index + 1];
    if (next === delimiter) {
      current += delimiter;
      index += 1;
      continue;
    }

    result.push(current);
    current = "";
  }

  if (current.length > 0) {
    result.push(current);
  }

  return result;
}

function unescapeText(value: string, delimiter: string): string {
  return value.replaceAll(`${delimiter}${delimiter}`, delimiter);
}

function escapeText(value: string, delimiter: string): string {
  return value.replaceAll(delimiter, `${delimiter}${delimiter}`);
}

function parseTextSegment(textBytes: Uint8Array): {
  delimiter: string;
  keywordOrder: string[];
  keywords: Map<string, string>;
} {
  if (textBytes.length === 0) {
    throw new Error("Missing TEXT segment");
  }

  const delimiter = String.fromCharCode(textBytes[0]);
  const body = decodeLatin1(textBytes.subarray(1));
  const tokens = splitEscaped(body, delimiter);
  const keywordOrder: string[] = [];
  const keywords = new Map<string, string>();

  for (let index = 0; index + 1 < tokens.length; index += 2) {
    const key = unescapeText(tokens[index], delimiter);
    const value = unescapeText(tokens[index + 1], delimiter);
    if (!keywords.has(key)) {
      keywordOrder.push(key);
    }
    keywords.set(key, value);
  }

  return { delimiter, keywordOrder, keywords };
}

function isFluorescenceChannel(channelName: string): boolean {
  const upper = channelName.toUpperCase();
  return !upper.includes("FSC") && !upper.includes("SSC") && !upper.includes("TIME");
}

function fileIdentity(file: File): string {
  const relative = file.webkitRelativePath || file.name;
  return `${relative}::${file.lastModified}::${file.size}`;
}

function parseHeaderOffsets(bytes: Uint8Array): { version: string; offsets: ParsedOffsets } {
  if (bytes.length < 58) {
    throw new Error("File is too small to be a valid FCS file.");
  }

  const header = decodeLatin1(bytes.subarray(0, 58));
  const version = header.slice(0, 6).trim() || "FCS3.0";
  const offsets: ParsedOffsets = {
    textStart: parseOffset(header.slice(10, 18)),
    textEnd: parseOffset(header.slice(18, 26)),
    dataStart: parseOffset(header.slice(26, 34)),
    dataEnd: parseOffset(header.slice(34, 42)),
    analysisStart: parseOffset(header.slice(42, 50)),
    analysisEnd: parseOffset(header.slice(50, 58)),
  };

  return { version, offsets };
}

function upsertKeyword(keywords: Map<string, string>, keywordOrder: string[], key: string, value: string) {
  if (!keywords.has(key)) {
    keywordOrder.push(key);
  }
  keywords.set(key, value);
}

function formatHeaderOffset(value: number): string {
  const safeValue = value > 99_999_999 ? 0 : Math.max(value, 0);
  return safeValue.toString().padStart(8, " ");
}

function buildTextSegment(
  delimiter: string,
  keywordOrder: string[],
  keywords: Map<string, string>,
): Uint8Array {
  let output = delimiter;
  for (const key of keywordOrder) {
    const value = keywords.get(key) ?? "";
    output += `${escapeText(key, delimiter)}${delimiter}${escapeText(value, delimiter)}${delimiter}`;
  }
  return encodeLatin1(output);
}

function buildHeader(
  version: string,
  textStart: number,
  textEnd: number,
  dataStart: number,
  dataEnd: number,
  analysisStart: number,
  analysisEnd: number,
): Uint8Array {
  const headerText = [
    version.slice(0, 6).padEnd(6, " "),
    "    ",
    formatHeaderOffset(textStart),
    formatHeaderOffset(textEnd),
    formatHeaderOffset(dataStart),
    formatHeaderOffset(dataEnd),
    formatHeaderOffset(analysisStart),
    formatHeaderOffset(analysisEnd),
  ].join("");

  if (headerText.length !== 58) {
    throw new Error("Failed to generate a valid FCS header.");
  }

  return encodeLatin1(headerText);
}

function mergeBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function buildEditedBytes(file: FcsFileRecord, channelTemplate: ChannelEdit[], outputFileName: string): Uint8Array {
  const { raw } = file;
  const templateByOriginal = new Map(
    channelTemplate.map((entry) => [entry.originalPrimaryName, entry] as const),
  );

  const keywords = new Map(raw.keywords);
  const keywordOrder = [...raw.keywordOrder];

  for (const channel of file.channels) {
    const edit = templateByOriginal.get(channel.originalPrimaryName);
    if (!edit) continue;

    if (edit.primaryName.trim().length > 0) {
      upsertKeyword(keywords, keywordOrder, `$P${channel.index}N`, edit.primaryName.trim());
    }
    upsertKeyword(keywords, keywordOrder, `$P${channel.index}S`, edit.secondaryName);
  }

  upsertKeyword(keywords, keywordOrder, "$FIL", outputFileName);

  const dataBytes = sliceInclusive(raw.bytes, raw.offsets.dataStart, raw.offsets.dataEnd);
  const hasAnalysis = raw.offsets.analysisStart > 0 && raw.offsets.analysisEnd >= raw.offsets.analysisStart;
  const analysisBytes = hasAnalysis
    ? sliceInclusive(raw.bytes, raw.offsets.analysisStart, raw.offsets.analysisEnd)
    : new Uint8Array();

  let textSegment = new Uint8Array();
  let textStart = 58;
  let textEnd = 0;
  let dataStart = 0;
  let dataEnd = 0;
  let analysisStart = 0;
  let analysisEnd = 0;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    textSegment = new Uint8Array(buildTextSegment(raw.delimiter, keywordOrder, keywords));
    textEnd = textStart + textSegment.length - 1;
    dataStart = textEnd + 1;
    dataEnd = dataStart + dataBytes.length - 1;
    analysisStart = analysisBytes.length > 0 ? dataEnd + 1 : 0;
    analysisEnd = analysisBytes.length > 0 ? analysisStart + analysisBytes.length - 1 : 0;

    const previousBeginData = keywords.get("$BEGINDATA") ?? "";
    const previousEndData = keywords.get("$ENDDATA") ?? "";
    const previousBeginAnalysis = keywords.get("$BEGINANALYSIS") ?? "";
    const previousEndAnalysis = keywords.get("$ENDANALYSIS") ?? "";

    upsertKeyword(keywords, keywordOrder, "$BEGINDATA", String(dataStart));
    upsertKeyword(keywords, keywordOrder, "$ENDDATA", String(dataEnd));
    upsertKeyword(keywords, keywordOrder, "$BEGINANALYSIS", String(analysisStart));
    upsertKeyword(keywords, keywordOrder, "$ENDANALYSIS", String(analysisEnd));

    const stable =
      previousBeginData === String(dataStart) &&
      previousEndData === String(dataEnd) &&
      previousBeginAnalysis === String(analysisStart) &&
      previousEndAnalysis === String(analysisEnd);
    if (stable) break;
  }

  const header = buildHeader(raw.version, textStart, textEnd, dataStart, dataEnd, analysisStart, analysisEnd);
  return mergeBytes([header, textSegment, dataBytes, analysisBytes]);
}

export function getCytometerConfigs(): ConfigBootstrap {
  return {
    defaultConfig: DEFAULT_CONFIG,
    configs: CYTOMETER_CONFIGS,
  };
}

export async function parseFcsInputFiles(
  inputFiles: File[],
): Promise<{ records: FcsFileRecord[]; failed: string[] }> {
  const records: FcsFileRecord[] = [];
  const failed: string[] = [];

  const fcsFiles = inputFiles.filter((file) => file.name.toLowerCase().endsWith(".fcs"));
  for (const file of fcsFiles) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { version, offsets } = parseHeaderOffsets(bytes);
      const textBytes = sliceInclusive(bytes, offsets.textStart, offsets.textEnd);
      const { delimiter, keywordOrder, keywords } = parseTextSegment(textBytes);

      const keywordDataStart = parseOffset(keywords.get("$BEGINDATA") ?? "");
      const keywordDataEnd = parseOffset(keywords.get("$ENDDATA") ?? "");
      const keywordAnalysisStart = parseOffset(keywords.get("$BEGINANALYSIS") ?? "");
      const keywordAnalysisEnd = parseOffset(keywords.get("$ENDANALYSIS") ?? "");

      const resolvedOffsets: ParsedOffsets = {
        textStart: offsets.textStart,
        textEnd: offsets.textEnd,
        dataStart: offsets.dataStart > 0 ? offsets.dataStart : keywordDataStart,
        dataEnd: offsets.dataEnd > 0 ? offsets.dataEnd : keywordDataEnd,
        analysisStart: offsets.analysisStart > 0 ? offsets.analysisStart : keywordAnalysisStart,
        analysisEnd: offsets.analysisEnd > 0 ? offsets.analysisEnd : keywordAnalysisEnd,
      };

      if (resolvedOffsets.dataStart <= 0 || resolvedOffsets.dataEnd < resolvedOffsets.dataStart) {
        throw new Error("Data segment offsets are missing or invalid.");
      }

      const parameterCount = parseOffset(keywords.get("$PAR") ?? "");
      const eventCount = parseOffset(keywords.get("$TOT") ?? "");

      const channels: ChannelRecord[] = [];
      for (let index = 1; index <= parameterCount; index += 1) {
        const primary = keywords.get(`$P${index}N`) ?? "";
        const secondary = keywords.get(`$P${index}S`) ?? "";
        channels.push({
          index,
          detector: primary,
          originalPrimaryName: primary,
          primaryName: primary,
          secondaryName: secondary,
          fluorescence: isFluorescenceChannel(primary),
        });
      }

      const parameters = [...keywords.entries()]
        .map(([key, value]) => ({ key, value }))
        .sort((left, right) => left.key.localeCompare(right.key));

      const fileName = file.name;
      const dotIndex = fileName.lastIndexOf(".");
      const baseName = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
      const relativePath = file.webkitRelativePath || file.name;
      const slashIndex = relativePath.lastIndexOf("/");
      const directory = slashIndex >= 0 ? relativePath.slice(0, slashIndex) : "";

      records.push({
        path: fileIdentity(file),
        directory,
        fileName,
        originalBaseName: baseName,
        outputBaseName: baseName,
        sizeBytes: file.size,
        eventCount,
        parameterCount,
        channels,
        parameters,
        raw: {
          bytes,
          version,
          delimiter,
          keywordOrder,
          keywords,
          offsets: resolvedOffsets,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push(`${file.name}: ${message}`);
    }
  }

  return { records, failed };
}

export async function createExportZip(
  files: FcsFileRecord[],
  channelTemplate: ChannelEdit[],
): Promise<ExportBundle> {
  const zip = new JSZip();
  const createdFiles: string[] = [];
  const warnings: string[] = [];
  const usedNames = new Set<string>();

  function reserveUniqueName(baseName: string): string {
    if (!usedNames.has(baseName)) {
      usedNames.add(baseName);
      return baseName;
    }

    const dotIndex = baseName.toLowerCase().endsWith(".fcs") ? baseName.length - 4 : -1;
    const root = dotIndex >= 0 ? baseName.slice(0, dotIndex) : baseName;
    const extension = dotIndex >= 0 ? baseName.slice(dotIndex) : "";

    for (let suffix = 2; suffix < 10_000; suffix += 1) {
      const candidate = `${root}_${String(suffix).padStart(3, "0")}${extension}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
    }

    throw new Error(`Unable to create unique output file name for ${baseName}`);
  }

  for (const file of files) {
    const requestedName = `${file.outputBaseName.trim()}.fcs`;
    const safeName = reserveUniqueName(requestedName);
    if (safeName !== requestedName) {
      warnings.push(`${requestedName} renamed to ${safeName} to avoid a duplicate file name.`);
    }
    const bytes = buildEditedBytes(file, channelTemplate, safeName);
    zip.file(safeName, bytes);
    createdFiles.push(safeName);
  }

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    zipBlob,
    zipName: `fcs-manager-export-${stamp}.zip`,
    createdFiles,
    warnings,
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
