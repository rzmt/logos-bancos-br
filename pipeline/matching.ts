/**
 * Matching between the Central Bank backbone (ISPB/COMPE) and the Open
 * Finance directory logos (CNPJ).
 *
 * Bridge: ISPB == first 8 digits of the CNPJ. Strong, but not absolute —
 * hence the safety nets: hand-reviewed forced matches, direct URLs, local
 * overrides, and name similarity demoted to report-only suggestions.
 */

import { jaccard, tokenize } from './text';
import type {
  DirectoryIndex,
  DirectoryOrganisation,
  DirectoryServer,
  MatchEntry,
  NameSuggestion,
  PipelineConfig,
  RawOrganisation,
  StrParticipant,
} from './types';

/** Indexes directory organisations that have at least one usable logo. */
export function indexDirectory(
  rawOrgs: RawOrganisation[],
  { denylistUris = [] }: { denylistUris?: string[] } = {},
): DirectoryIndex {
  const deny = new Set(denylistUris);
  const orgs: DirectoryOrganisation[] = [];
  const byCnpjRoot = new Map<string, DirectoryOrganisation[]>();
  const byCnpj = new Map<string, DirectoryOrganisation>();

  for (const raw of rawOrgs) {
    if (raw?.Status !== 'Active') continue;

    const digits = String(raw.RegistrationNumber ?? '').replace(/\D/g, '');
    if (!digits || digits.length > 14) continue;
    const cnpj = digits.padStart(14, '0');

    const servers: DirectoryServer[] = [];
    for (const server of raw.AuthorisationServers ?? []) {
      const uri = String(server?.CustomerFriendlyLogoUri ?? '').trim();
      if (!uri || deny.has(uri) || !/^https:\/\//i.test(uri)) continue;
      servers.push({
        id: String(server.AuthorisationServerId ?? ''),
        name: server.CustomerFriendlyName ?? '',
        uri,
      });
    }
    if (servers.length === 0) continue;

    const name = raw.OrganisationName || raw.LegalEntityName || '';
    const org: DirectoryOrganisation = {
      organisationId: String(raw.OrganisationId ?? ''),
      name,
      nameTokens: tokenize(name),
      cnpj,
      cnpjRoot: cnpj.slice(0, 8),
      servers,
    };
    orgs.push(org);
    const bucket = byCnpjRoot.get(org.cnpjRoot);
    if (bucket) {
      bucket.push(org);
    } else {
      byCnpjRoot.set(org.cnpjRoot, [org]);
    }
    byCnpj.set(cnpj, org);
  }

  return { orgs, byCnpjRoot, byCnpj };
}

/**
 * Among organisations sharing the same CNPJ root (conglomerates): the head
 * office (branch "0001") wins; then highest name similarity; then
 * organisationId ascending. Deterministic.
 */
export function pickOrganisation(
  candidates: DirectoryOrganisation[],
  participant: StrParticipant,
): DirectoryOrganisation {
  const target = tokenize(`${participant.fullName} ${participant.shortName}`);
  const sorted = [...candidates].sort((a, b) => {
    const headA = a.cnpj.slice(8, 12) === '0001' ? 1 : 0;
    const headB = b.cnpj.slice(8, 12) === '0001' ? 1 : 0;
    if (headA !== headB) return headB - headA;
    const scoreA = jaccard(a.nameTokens, target);
    const scoreB = jaccard(b.nameTokens, target);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.organisationId.localeCompare(b.organisationId);
  });
  return sorted[0] as DirectoryOrganisation;
}

/** Among the organisation's servers: highest name similarity; then id ascending. */
export function pickServer(
  org: DirectoryOrganisation,
  participant: StrParticipant,
): DirectoryServer {
  const target = tokenize(`${participant.shortName} ${participant.fullName}`);
  const sorted = [...org.servers].sort((a, b) => {
    const scoreA = jaccard(tokenize(a.name), target);
    const scoreB = jaccard(tokenize(b.name), target);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.id.localeCompare(b.id);
  });
  return sorted[0] as DirectoryServer;
}

function bestByName(
  index: DirectoryIndex,
  participant: StrParticipant,
  threshold: number,
): { org: DirectoryOrganisation; score: number } | null {
  const target = tokenize(`${participant.shortName} ${participant.fullName}`);
  let best: DirectoryOrganisation | null = null;
  let bestScore = 0;
  for (const org of index.orgs) {
    const score = jaccard(org.nameTokens, target);
    if (score > bestScore) {
      bestScore = score;
      best = org;
    }
  }
  return best && bestScore >= threshold ? { org: best, score: bestScore } : null;
}

export interface MatchResult {
  entries: MatchEntry[];
  suggestions: NameSuggestion[];
  /** Override files whose ISPB is not in the STR backbone (likely stale). */
  unusedOverrides: string[];
}

/**
 * Builds one entry per STR participant. Logo source precedence:
 * local override -> forced URI -> forced match (CNPJ) -> automatic ISPB match.
 * Name similarity never assigns a logo — it only produces suggestions.
 */
export function buildMatches({
  participants,
  directory,
  config,
  overrides,
}: {
  participants: StrParticipant[];
  directory: RawOrganisation[];
  config: PipelineConfig;
  overrides: Map<string, string>;
}): MatchResult {
  const index = indexDirectory(directory, { denylistUris: config.denylistUris });
  const ignore = new Set(config.ignoreIspb ?? []);
  const forcedUris = config.forcedUris ?? {};
  const forcedMatches = config.forcedMatches ?? {};
  const threshold = config.nameSuggestionThreshold ?? 0.5;

  const entries: MatchEntry[] = [];
  const suggestions: NameSuggestion[] = [];
  const seen = new Set<string>();

  for (const participant of participants) {
    const { ispb } = participant;
    if (ignore.has(ispb) || seen.has(ispb)) continue;
    seen.add(ispb);

    const base = {
      ispb,
      compe: participant.compe,
      compe4: participant.compe4,
      shortName: participant.shortName,
      fullName: participant.fullName,
    };

    if (overrides.has(ispb)) {
      entries.push({ ...base, source: 'override', uri: null, orgName: null, orgCnpj: null });
      continue;
    }

    const forcedUri = forcedUris[ispb];
    if (forcedUri) {
      entries.push({ ...base, source: 'forced-uri', uri: forcedUri, orgName: null, orgCnpj: null });
      continue;
    }

    const forcedCnpj = forcedMatches[ispb];
    if (forcedCnpj) {
      const cnpj = String(forcedCnpj).replace(/\D/g, '').padStart(14, '0');
      const org = index.byCnpj.get(cnpj);
      if (org) {
        const server = pickServer(org, participant);
        entries.push({
          ...base,
          source: 'forced-match',
          uri: server.uri,
          orgName: org.name,
          orgCnpj: org.cnpj,
        });
        continue;
      }
      // Forced CNPJ no longer in the directory: fall through to the automatic match.
    }

    const candidates = index.byCnpjRoot.get(ispb);
    if (candidates && candidates.length > 0) {
      const org = pickOrganisation(candidates, participant);
      const server = pickServer(org, participant);
      entries.push({
        ...base,
        source: 'ispb',
        uri: server.uri,
        orgName: org.name,
        orgCnpj: org.cnpj,
      });
      continue;
    }

    // No safe match. Record a name-based suggestion for human review, but the
    // institution ships without a logo until someone promotes it to forcedMatches.
    const byName = bestByName(index, participant, threshold);
    if (byName) {
      const server = pickServer(byName.org, participant);
      suggestions.push({
        ispb,
        compe4: participant.compe4,
        strName: participant.shortName || participant.fullName,
        orgName: byName.org.name,
        cnpj: byName.org.cnpj,
        uri: server.uri,
        score: Number(byName.score.toFixed(2)),
      });
    }
    entries.push({ ...base, source: null, uri: null, orgName: null, orgCnpj: null });
  }

  const unusedOverrides = [...overrides.keys()].filter((ispb) => !seen.has(ispb)).sort();
  suggestions.sort((a, b) => b.score - a.score);
  return { entries, suggestions, unusedOverrides };
}
