/**
 * Shared types for the logo collection pipeline.
 *
 * Data flow: official sources (sources.ts) -> matching (matching.ts) ->
 * download/rasterize (images.ts) -> dataset/preview/react-native map generators.
 */

/** One row of the Central Bank STR participants CSV that has a COMPE number. */
export interface StrParticipant {
  /** 8-digit ISPB, zero-padded. */
  ispb: string;
  /** COMPE number as published (digits only, e.g. "1", "341"). */
  compe: string;
  /** COMPE zero-padded to 4 digits (e.g. "0001", "0341"). */
  compe4: string;
  shortName: string;
  fullName: string;
}

/**
 * Pix participation attributes, verbatim from the Central Bank's daily
 * "participantes ativos do Pix" CSV (values kept in Portuguese as published).
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

/** One row of the active section of the Pix participants CSV. */
export interface PixParticipant {
  /** 8-digit ISPB, zero-padded. */
  ispb: string;
  shortName: string;
  /** 14-digit CNPJ, zero-padded. */
  cnpj: string;
  pix: PixInfo;
}

/** Merged backbone entry: STR (COMPE) ∪ Pix participants, keyed by ISPB. */
export interface BackboneParticipant {
  ispb: string;
  /** null for Pix-only institutions (no COMPE number). */
  compe: string | null;
  compe4: string | null;
  shortName: string;
  fullName: string;
  /** 14-digit CNPJ — known only for Pix-only institutions (from the Pix CSV). */
  cnpj: string | null;
  /** null for institutions that are not active Pix participants. */
  pix: PixInfo | null;
}

/** Raw organisation as returned by the Open Finance Brasil participants directory. */
export interface RawOrganisation {
  Status?: string;
  OrganisationId?: string;
  OrganisationName?: string;
  LegalEntityName?: string;
  RegistrationNumber?: string;
  AuthorisationServers?: Array<{
    AuthorisationServerId?: string;
    CustomerFriendlyName?: string;
    CustomerFriendlyLogoUri?: string;
  }>;
}

export interface DirectoryServer {
  id: string;
  name: string;
  uri: string;
}

export interface DirectoryOrganisation {
  organisationId: string;
  name: string;
  nameTokens: Set<string>;
  /** 14-digit CNPJ, zero-padded. */
  cnpj: string;
  /** First 8 digits of the CNPJ — matches the ISPB in the vast majority of cases. */
  cnpjRoot: string;
  servers: DirectoryServer[];
}

export interface DirectoryIndex {
  orgs: DirectoryOrganisation[];
  byCnpjRoot: Map<string, DirectoryOrganisation[]>;
  byCnpj: Map<string, DirectoryOrganisation>;
}

export interface PipelineConfig {
  pngSizePx: number;
  maxDownloadBytes: number;
  timeoutMs: number;
  concurrency: number;
  /** Minimum Jaccard score for a name-based match to appear as a suggestion. */
  nameSuggestionThreshold: number;
  /** Logo URLs to ignore even when published by the institution. */
  denylistUris: string[];
  /** ISPB -> direct logo URL (bypasses the directory). */
  forcedUris: Record<string, string>;
  /** ISPB -> 14-digit CNPJ of the directory organisation to use (reviewed by hand). */
  forcedMatches: Record<string, string>;
  /**
   * Single-brand cooperative systems: BRAND TOKEN -> CNPJ of the system's
   * organisation in the directory. Applies when the token appears as a whole
   * word in the institution's official name (e.g. "CC SICOOB CREDIVALE" ->
   * Sicoob). Curated by hand — this is an explicit brand rule, not fuzzy
   * name similarity.
   */
  brandMatches: Record<string, string>;
  /** ISPBs to skip entirely. */
  ignoreIspb: string[];
}

/**
 * Where a logo comes from. Name similarity is deliberately NOT a source:
 * a wrong logo is worse than no logo, so name matches only become
 * suggestions for a human to review and promote to `forcedMatches`.
 */
export type MatchSource = 'override' | 'forced-uri' | 'forced-match' | 'ispb' | 'brand-match';

export interface MatchEntry {
  ispb: string;
  compe: string | null;
  compe4: string | null;
  shortName: string;
  fullName: string;
  cnpj: string | null;
  pix?: PixInfo | null;
  source: MatchSource | null;
  /** Logo URL when source is directory/forced-uri based; null for overrides. */
  uri: string | null;
  orgName: string | null;
  orgCnpj: string | null;
  /**
   * Brand-matched entries share one asset file instead of getting their own
   * copy: the file is keyed by the brand organisation's CNPJ root. Absent for
   * every other source (the file is keyed by the institution's own ISPB).
   */
  assetIspb?: string;
  /** Brand token that matched (e.g. "SICOOB") for `brand-match` entries. */
  brandToken?: string;
}

export interface NameSuggestion {
  ispb: string;
  compe4: string | null;
  strName: string;
  orgName: string;
  cnpj: string;
  uri: string;
  score: number;
}

export interface ManifestEntry {
  compe4: string | null;
  org: string | null;
  cnpj: string | null;
  uri: string;
  sourceSha256: string;
  /** Whether the original source file is an SVG shipped under logos/svg/. */
  svg: boolean;
  updatedAt: string;
}

/** Keyed by ISPB. Committed state used for idempotency and clean diffs. */
export type Manifest = Record<string, ManifestEntry>;

export interface BankLogoSource {
  /**
   * `brand` = the logo is inherited from the institution's cooperative
   * system (Sicoob, Sicredi, …) via a curated rule — not the institution's
   * own artwork.
   */
  type: 'openfinance' | 'direct-uri' | 'override' | 'brand';
  org: string | null;
  cnpj: string | null;
  /** System brand token when type is `brand` (e.g. "SICOOB"). */
  brand?: string;
  uri: string;
  sha256: string;
  updatedAt: string;
}

export interface BankLogo {
  png: string;
  svg: string | null;
  source: BankLogoSource;
}

/** Main-list institution (has a COMPE code; STR participant). */
export interface Bank {
  ispb: string;
  /** COMPE number as published (digits only, e.g. "1", "341"). */
  compe: string;
  /** COMPE zero-padded to 4 digits (e.g. "0001", "0341"). */
  compe4: string;
  name: string;
  shortName: string;
  /** Pix participation attributes; null when not an active Pix participant. */
  pix: PixInfo | null;
  logo: BankLogo | null;
}

/** Pix-only institution (no COMPE code) — shipped in a separate dataset. */
export interface PixInstitution {
  ispb: string;
  /** Discriminants vs Bank. */
  compe: null;
  compe4: null;
  /** 14-digit CNPJ from the Pix participants list. */
  cnpj: string;
  name: string;
  shortName: string;
  pix: PixInfo;
  logo: BankLogo | null;
}

export interface Dataset {
  banks: Bank[];
}

export interface PixDataset {
  institutions: PixInstitution[];
}
