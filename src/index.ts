/**
 * logos-bancos-br — Brazilian bank logos and data from official sources only.
 *
 * Universal entry point: works in Node, bundlers (web) and React Native.
 * The dataset is inlined at build time; no filesystem or network access.
 *
 * - Node filesystem paths for the shipped assets: `logos-bancos-br/node`.
 * - React Native static require() map: `logos-bancos-br/react-native`.
 */

import rawData from '../data/bancos.json';
import rawPixData from '../data/instituicoes-pix.json';

export interface BankLogoSource {
  /**
   * Where the logo came from:
   * - `openfinance`: published by the institution in the Open Finance Brasil
   *   participants directory (matched by ISPB/CNPJ);
   * - `direct-uri`: a hand-reviewed direct URL;
   * - `override`: a manually maintained file in the repository;
   * - `brand`: inherited from the institution's cooperative system
   *   (Sicoob, Sicredi, …) via a curated rule — shared asset, one file per brand.
   */
  type: 'openfinance' | 'direct-uri' | 'override' | 'brand';
  /** Open Finance organisation name, when type is `openfinance`. */
  org: string | null;
  /** Organisation CNPJ (14 digits), when type is `openfinance`. */
  cnpj: string | null;
  /** System brand token when type is `brand` (e.g. "SICOOB"). */
  brand?: string;
  /** Source URI of the original artwork. */
  uri: string;
  /** SHA-256 of the original artwork (provenance / change detection). */
  sha256: string;
  /** ISO date (YYYY-MM-DD) of the last time the artwork changed. */
  updatedAt: string;
}

export interface BankLogo {
  /** Package-relative path of the normalized 256×256 PNG. */
  png: string;
  /** Package-relative path of the original SVG, when safely redistributable. */
  svg: string | null;
  source: BankLogoSource;
}

/**
 * Pix participation attributes, verbatim from the Central Bank's daily
 * "participantes ativos do Pix" list (values kept in Portuguese as published).
 */
export interface PixInfo {
  /** "Direta" | "Indireta" — participation in the SPI settlement system. */
  spiParticipationType: string;
  /** "Obrigatória" | "Facultativa". */
  pixParticipationType: string;
  /** e.g. "Provedor de Conta Transacional", "Iniciador". */
  modality: string;
  institutionType: string;
  authorizedByBcb: boolean;
}

/** Main-list institution: has a COMPE code (Central Bank STR participant). */
export interface Bank {
  /** 8-digit ISPB (Central Bank identifier). */
  ispb: string;
  /** COMPE number as published by the Central Bank (e.g. "1", "341"). */
  compe: string;
  /** COMPE zero-padded to 4 digits (e.g. "0001", "0341"). */
  compe4: string;
  /** Official full name (Nome Extenso). */
  name: string;
  /** Official short name (Nome Reduzido). */
  shortName: string;
  /** Pix participation attributes; null when not an active Pix participant. */
  pix: PixInfo | null;
  /** Logo info, or null when the institution has no logo in the official sources. */
  logo: BankLogo | null;
}

/**
 * Pix-only institution (no COMPE code) — shipped in the separate
 * `data/instituicoes-pix.json` dataset so the main list stays clean.
 */
export interface PixInstitution {
  /** 8-digit ISPB (Central Bank identifier). */
  ispb: string;
  /** Discriminant vs Bank: Pix-only institutions have no COMPE code. */
  compe: null;
  compe4: null;
  /** 14-digit CNPJ from the Pix participants list. */
  cnpj: string;
  name: string;
  shortName: string;
  pix: PixInfo;
  logo: BankLogo | null;
}

/** Any institution from either dataset. */
export type Institution = Bank | PixInstitution;

const data = rawData as { banks: Bank[] };
const pixData = rawPixData as { institutions: PixInstitution[] };

/** Package version (used to pin CDN URLs). */
export const version: string = __PKG_VERSION__;

/** Normalizes a COMPE code ("341", 341, "0341") to the 4-digit form. */
export function normalizeCompe(code: string | number): string {
  return String(code).replace(/\D/g, '').padStart(4, '0');
}

/** Normalizes an ISPB (number or string) to the 8-digit form. */
export function normalizeIspb(ispb: string | number): string {
  return String(ispb).replace(/\D/g, '').padStart(8, '0');
}

let compeIndex: Map<string, Bank> | null = null;
let ispbIndex: Map<string, Institution> | null = null;

function ensureIndexes(): void {
  if (compeIndex && ispbIndex) return;
  compeIndex = new Map();
  ispbIndex = new Map();
  for (const bank of data.banks) {
    compeIndex.set(bank.compe4, bank);
    ispbIndex.set(bank.ispb, bank);
  }
  for (const institution of pixData.institutions) {
    ispbIndex.set(institution.ispb, institution);
  }
}

/**
 * The main list: every institution with a COMPE code in the Central Bank STR
 * participants list. Pix-only institutions live in `pixInstitutions()`.
 */
export function banks(): readonly Bank[] {
  return data.banks;
}

/**
 * Pix-only institutions (active Pix participants without a COMPE code) —
 * fintechs, payment institutions and cooperative-system affiliates. Kept in a
 * separate dataset so the main list stays clean.
 */
export function pixInstitutions(): readonly PixInstitution[] {
  return pixData.institutions;
}

/** Every institution from both datasets (main list + Pix-only). */
export function allInstitutions(): readonly Institution[] {
  return [...data.banks, ...pixData.institutions];
}

/** Looks a bank up by COMPE code ("341", 341 and "0341" are equivalent). */
export function byCompe(code: string | number): Bank | undefined {
  ensureIndexes();
  return compeIndex?.get(normalizeCompe(code));
}

/** Looks any institution (main list or Pix-only) up by 8-digit ISPB. */
export function byIspb(ispb: string | number): Institution | undefined {
  ensureIndexes();
  return ispbIndex?.get(normalizeIspb(ispb));
}

/**
 * Convenience lookup: digits with more than 4 characters are treated as an
 * ISPB, anything else as a COMPE code.
 */
export function findBank(code: string | number | Institution): Institution | undefined {
  if (typeof code === 'object') return code;
  const digits = String(code).replace(/\D/g, '');
  return digits.length > 4 ? byIspb(digits) : byCompe(digits);
}

export interface LogoCdnUrlOptions {
  /** Which asset to link. Defaults to `png`; `svg` returns null when there is no safe SVG. */
  format?: 'png' | 'svg';
  /** Package version for the pinned URL. Defaults to this build's version. */
  version?: string;
}

/**
 * URL of the logo served by the jsDelivr CDN (no install required), pinned to
 * this package version. Returns null when the bank is unknown or has no logo.
 *
 * Example: https://cdn.jsdelivr.net/npm/logos-bancos-br@0.1.0/logos/png/60701190.png
 */
export function logoCdnUrl(
  code: string | number | Institution,
  { format = 'png', version: pinnedVersion = version }: LogoCdnUrlOptions = {},
): string | null {
  const bank = findBank(code);
  if (!bank?.logo) return null;
  const path = format === 'svg' ? bank.logo.svg : bank.logo.png;
  if (!path) return null;
  return `https://cdn.jsdelivr.net/npm/logos-bancos-br@${pinnedVersion}/${path}`;
}
