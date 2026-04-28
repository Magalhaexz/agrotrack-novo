import { initialDb } from '../data/mockData.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeValue(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const output = {};
    Object.entries(value).forEach(([key, current]) => {
      const sanitized = sanitizeValue(current);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    });
    return output;
  }

  return value;
}

function normalizeArrayCollection({
  source,
  template,
  currentUserId,
  counters,
}) {
  if (!Array.isArray(source)) {
    counters.nonArrayCollections += 1;
    return [];
  }

  const templateHasId = Array.isArray(template) && template.some((item) => isPlainObject(item) && Object.prototype.hasOwnProperty.call(item, 'id'));
  let nextLocalId = source.reduce((max, item) => {
    const id = Number(item?.id);
    if (Number.isFinite(id)) return Math.max(max, id);
    return max;
  }, 0) + 1;

  const normalized = [];
  source.forEach((item) => {
    if (!isPlainObject(item)) {
      counters.invalidRecords += 1;
      return;
    }

    if (currentUserId && item.owner_user_id && String(item.owner_user_id) !== String(currentUserId)) {
      counters.skippedByOwner += 1;
      return;
    }

    const sanitized = sanitizeValue(item);
    if (!isPlainObject(sanitized)) {
      counters.invalidRecords += 1;
      return;
    }

    if (templateHasId && (sanitized.id === undefined || sanitized.id === null || sanitized.id === '')) {
      sanitized.id = nextLocalId;
      nextLocalId += 1;
      counters.generatedIds += 1;
    }

    normalized.push(sanitized);
  });

  return normalized;
}

export function normalizeBackupPayload(rawPayload, { currentUserId = null } = {}) {
  if (!isPlainObject(rawPayload)) {
    return { ok: false, reason: 'invalid_root' };
  }

  const envelopeData = isPlainObject(rawPayload.data) ? rawPayload.data : null;
  const sourceData = envelopeData || rawPayload;
  if (!isPlainObject(sourceData)) {
    return { ok: false, reason: 'invalid_data' };
  }

  const templateKeys = Object.keys(initialDb);
  if (!templateKeys.length) {
    return { ok: false, reason: 'missing_template' };
  }

  const counters = {
    unknownTopLevelKeys: 0,
    nonArrayCollections: 0,
    invalidRecords: 0,
    skippedByOwner: 0,
    generatedIds: 0,
  };

  const normalizedData = {};
  templateKeys.forEach((key) => {
    const templateValue = initialDb[key];
    const sourceValue = sourceData[key];

    if (Array.isArray(templateValue)) {
      normalizedData[key] = normalizeArrayCollection({
        source: sourceValue,
        template: templateValue,
        currentUserId,
        counters,
      });
      return;
    }

    if (isPlainObject(templateValue)) {
      normalizedData[key] = isPlainObject(sourceValue)
        ? sanitizeValue(sourceValue)
        : sanitizeValue(templateValue);
      return;
    }

    normalizedData[key] = sourceValue ?? templateValue;
  });

  counters.unknownTopLevelKeys = Object.keys(sourceData).filter((key) => !templateKeys.includes(key)).length;

  return {
    ok: true,
    data: normalizedData,
    metadata: {
      app: rawPayload.app || 'Herdon',
      version: Number(rawPayload.version || 1),
      exportedAt: rawPayload.exportedAt || null,
      usedEnvelope: Boolean(envelopeData),
    },
    summary: counters,
  };
}
